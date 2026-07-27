import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUSY_TIMEOUT_MS = 5000;
const MIGRATION_LOCK_WAIT_MS = 50;
const MIGRATION_RETRY_DELAY_MS = 25;

export class Database {
  private db!: sqlite3.Database;

  constructor(dbPath?: string) {
    const targetPath = dbPath || process.env.MEMORAI_DB_PATH || path.resolve(__dirname, '../../memorai.db');
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(targetPath);
    this.db.configure('busyTimeout', MIGRATION_LOCK_WAIT_MS);
  }

  private async retryBusy<T>(operation: () => Promise<T>): Promise<T> {
    const deadline = Date.now() + BUSY_TIMEOUT_MS;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        const isBusy =
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === 'SQLITE_BUSY';
        if (!isBusy || Date.now() >= deadline) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, MIGRATION_RETRY_DELAY_MS));
      }
    }
  }

  private async migrate(): Promise<void> {
    // Long SQLite busy waits occupy libuv workers and can starve the connection
    // holding the migration lock. Retry asynchronously while acquiring the lock.
    await this.exec(`PRAGMA busy_timeout = ${MIGRATION_LOCK_WAIT_MS};`);

    try {
      await this.retryBusy(() => this.exec(`BEGIN IMMEDIATE`));

      try {
        const messageCols = await this.all<{ name: string }>(`PRAGMA table_info(messages)`);
        const messageNames = new Set(messageCols.map((column) => column.name));
        if (!messageNames.has('claimed_by')) {
          await this.exec(`ALTER TABLE messages ADD COLUMN claimed_by TEXT`);
        }
        if (!messageNames.has('claimed_at')) {
          await this.exec(`ALTER TABLE messages ADD COLUMN claimed_at DATETIME`);
        }
        if (!messageNames.has('relay_origin')) {
          await this.exec(`ALTER TABLE messages ADD COLUMN relay_origin TEXT`);
        }
        if (!messageNames.has('relay_hop')) {
          await this.exec(
            `ALTER TABLE messages ADD COLUMN relay_hop INTEGER NOT NULL DEFAULT 1`
          );
        }
        if (!messageNames.has('relay_parent_id')) {
          await this.exec(`ALTER TABLE messages ADD COLUMN relay_parent_id INTEGER`);
        }
        await this.exec(
          `UPDATE messages SET relay_origin = from_agent WHERE relay_origin IS NULL`
        );

        const taskCols = await this.all<{ name: string }>(`PRAGMA table_info(tasks)`);
        const taskNames = new Set(taskCols.map((column) => column.name));
        if (!taskNames.has('claimed_by')) {
          await this.exec(`ALTER TABLE tasks ADD COLUMN claimed_by TEXT`);
        }
        if (!taskNames.has('claimed_at')) {
          await this.exec(`ALTER TABLE tasks ADD COLUMN claimed_at DATETIME`);
        }

        await this.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_relay_parent
          ON messages(relay_parent_id)
          WHERE relay_parent_id IS NOT NULL;
        `);
        await this.exec(`COMMIT`);
      } catch (error) {
        try {
          await this.exec(`ROLLBACK`);
        } catch (rollbackError) {
          throw new Error('Database migration and rollback both failed', {
            cause: new AggregateError([error, rollbackError]),
          });
        }
        throw error;
      }
    } finally {
      await this.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
    }
  }

  public async init(): Promise<void> {
    await this.exec(`PRAGMA busy_timeout = ${MIGRATION_LOCK_WAIT_MS};`);
    await this.retryBusy(() => this.exec(`PRAGMA journal_mode = WAL;`));

    await this.retryBusy(() => this.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT NOT NULL,
        topic TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNREAD',
        claimed_by TEXT,
        claimed_at DATETIME,
        relay_origin TEXT NOT NULL,
        relay_hop INTEGER NOT NULL DEFAULT 1 CHECK (relay_hop BETWEEN 1 AND 4),
        relay_parent_id INTEGER REFERENCES messages(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT 'unassigned',
        status TEXT NOT NULL DEFAULT 'TODO',
        claimed_by TEXT,
        claimed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memories_topic ON memories(topic);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `));

    await this.migrate();
  }

  public run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  public get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row as T | undefined);
      });
    });
  }

  public all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []) as T[]);
      });
    });
  }

  public exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
}
