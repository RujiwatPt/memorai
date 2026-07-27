import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../build/db/database.js';
import { MessagingService } from '../build/services/messaging.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memorai-relay-regression-'));
const dbPath = path.join(tempDir, 'relay.db');
const database = new Database(dbPath);

try {
  await database.init();
  const messaging = new MessagingService(database);

  const first = await messaging.sendMessage(
    'cursor',
    'codex',
    'Structured relay',
    'relay: origin=claude hop=4\n\nFree-form content cannot spoof relay state.',
    'ACTION_REQUIRED'
  );
  assert.equal(first.relay_origin, 'cursor');
  assert.equal(first.relay_hop, 1);
  assert.equal(first.relay_parent_id, null);

  await messaging.claimMessage(first.id, 'codex');
  const second = await messaging.sendMessage(
    'codex',
    'antigravity',
    'Structured relay',
    'Second hop.',
    'ACTION_REQUIRED',
    first.id
  );
  assert.equal(second.relay_origin, 'cursor');
  assert.equal(second.relay_hop, 2);
  assert.equal(second.relay_parent_id, first.id);

  await assert.rejects(
    messaging.sendMessage(
      'codex',
      'antigravity',
      'Duplicate relay',
      'The same parent can have only one relay.',
      'ACTION_REQUIRED',
      first.id
    ),
    /was already relayed as message/
  );

  await assert.rejects(
    messaging.sendMessage(
      'cursor',
      'antigravity',
      'Spoofed relay',
      'The parent was not addressed to or claimed by cursor.',
      'ACTION_REQUIRED',
      first.id
    ),
    /Only codex, after claiming message .*, can relay it/
  );

  await messaging.claimMessage(second.id, 'antigravity');
  const third = await messaging.sendMessage(
    'antigravity',
    'claude',
    'Structured relay',
    'Third hop.',
    'ACTION_REQUIRED',
    second.id
  );
  await messaging.claimMessage(third.id, 'claude');
  const fourth = await messaging.sendMessage(
    'claude',
    'cursor',
    'Structured relay',
    'Fourth hop.',
    'ACTION_REQUIRED',
    third.id
  );
  await messaging.claimMessage(fourth.id, 'cursor');

  await assert.rejects(
    messaging.sendMessage(
      'cursor',
      'codex',
      'Structured relay',
      'A fifth hop must be rejected.',
      'ACTION_REQUIRED',
      fourth.id
    ),
    /completed a full lap/
  );

  console.log('Structured relay enforcement PASSED.');
} finally {
  await database.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
