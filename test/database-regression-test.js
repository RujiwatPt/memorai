import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sqlite3 from 'sqlite3';
import { Database } from '../build/db/database.js';
import { MessagingService } from '../build/services/messaging.js';
import { TaskService } from '../build/services/tasks.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memorai-db-regression-'));

function execSql(dbPath, sql) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.exec(sql, (execError) => {
      db.close((closeError) => {
        if (execError) {
          reject(execError);
        } else if (closeError) {
          reject(closeError);
        } else {
          resolve();
        }
      });
    });
  });
}

async function closeAll(databases) {
  await Promise.all(databases.map((database) => database.close()));
}

async function assertConcurrentInit(dbPath, label) {
  const databases = Array.from({ length: 12 }, () => new Database(dbPath));
  const results = await Promise.allSettled(databases.map((database) => database.init()));
  await closeAll(databases);

  const failures = results.filter((result) => result.status === 'rejected');
  assert.equal(
    failures.length,
    0,
    `${label}: all concurrent init calls should succeed; errors=${failures
      .map((failure) => failure.reason?.message)
      .join(', ')}`
  );
}

async function testConcurrentInitialization() {
  const freshPath = path.join(tempDir, 'fresh.db');
  await assertConcurrentInit(freshPath, 'fresh database');

  const legacyPath = path.join(tempDir, 'legacy.db');
  await execSql(
    legacyPath,
    `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNREAD',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT 'unassigned',
        status TEXT NOT NULL DEFAULT 'TODO',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
  );
  await assertConcurrentInit(legacyPath, 'legacy database');
}

async function testPartialMigration() {
  const partialPath = path.join(tempDir, 'partial.db');
  await execSql(
    partialPath,
    `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNREAD',
        claimed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO messages (from_agent, to_agent, topic, content)
      VALUES ('cursor', 'codex', 'Legacy handoff', 'Backfill relay metadata.');
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT 'unassigned',
        status TEXT NOT NULL DEFAULT 'TODO',
        claimed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
  );

  const database = new Database(partialPath);
  await database.init();
  const messageColumns = await database.all('PRAGMA table_info(messages)');
  const taskColumns = await database.all('PRAGMA table_info(tasks)');
  const migratedMessage = await database.get(
    `SELECT relay_origin, relay_hop, relay_parent_id FROM messages LIMIT 1`
  );
  await database.close();

  assert(messageColumns.some((column) => column.name === 'claimed_at'));
  assert(messageColumns.some((column) => column.name === 'relay_origin'));
  assert(messageColumns.some((column) => column.name === 'relay_hop'));
  assert(messageColumns.some((column) => column.name === 'relay_parent_id'));
  assert.equal(migratedMessage.relay_origin, 'cursor');
  assert.equal(migratedMessage.relay_hop, 1);
  assert.equal(migratedMessage.relay_parent_id, null);
  assert(taskColumns.some((column) => column.name === 'claimed_at'));
}

async function testAtomicClaims() {
  const claimPath = path.join(tempDir, 'claims.db');
  const primary = new Database(claimPath);
  await primary.init();

  const messaging = new MessagingService(primary);
  const tasks = new TaskService(primary);
  const message = await messaging.sendMessage(
    'cursor',
    'codex',
    'Concurrent message claim',
    'Exactly one caller should win.',
    'ACTION_REQUIRED'
  );
  const task = await tasks.createTask(
    'Concurrent task claim',
    'Exactly one caller should win.',
    'codex',
    'TODO'
  );

  const databases = Array.from({ length: 12 }, () => new Database(claimPath));
  await Promise.all(databases.map((database) => database.init()));

  const messageClaims = await Promise.all(
    databases.map((database) =>
      new MessagingService(database).claimMessage(message.id, 'codex')
    )
  );
  const taskClaims = await Promise.all(
    databases.map((database) => new TaskService(database).claimTask(task.id, 'codex'))
  );

  assert.equal(messageClaims.filter((result) => result.claimed).length, 1);
  assert.equal(taskClaims.filter((result) => result.claimed).length, 1);

  const broadcast = await messaging.sendMessage(
    'cursor',
    'all',
    'Informational broadcast',
    'Broadcasts must remain unclaimable.',
    'UNREAD'
  );
  const broadcastClaim = await messaging.claimMessage(broadcast.id, 'codex');
  assert.equal(broadcastClaim.claimed, false);

  await assert.rejects(
    messaging.sendMessage(
      'cursor',
      'all',
      'Invalid actionable broadcast',
      'This must be rejected.',
      'ACTION_REQUIRED'
    ),
    /must name a single agent/
  );

  await closeAll(databases);
  await primary.close();
}

try {
  await testConcurrentInitialization();
  await testPartialMigration();
  await testAtomicClaims();
  console.log('Database concurrency and claim regressions PASSED.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
