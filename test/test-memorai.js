import { Database } from '../build/db/database.js';
import { MemoryService } from '../build/services/memory.js';
import { MessagingService } from '../build/services/messaging.js';
import { TaskService } from '../build/services/tasks.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMemorai() {
  const testDbPath = path.resolve(__dirname, 'test-memorai.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log('--- Starting Memorai Integration Tests ---');
  const db = new Database(testDbPath);
  await db.init();

  const memoryService = new MemoryService(db);
  const messagingService = new MessagingService(db);
  const taskService = new TaskService(db);

  // 1. Test Memory Storage & Search
  console.log('[1] Testing Memory Store & Search...');
  const mem1 = await memoryService.saveMemory('cursor', 'Auth Redesign', 'Switched to JWT with RSA keypairs in /src/auth/jwt.ts', ['auth', 'security']);
  console.log('  Saved Memory:', mem1.id, mem1.topic);

  const memSearchResults = await memoryService.searchMemory('RSA', undefined, 'security');
  if (memSearchResults.length !== 1 || memSearchResults[0].id !== mem1.id) {
    throw new Error('Memory search failed!');
  }
  console.log('  Search Memory PASSED');

  // 2. Test Messaging & Handoff
  console.log('[2] Testing Inter-Agent Messaging...');
  const msg1 = await messagingService.sendMessage('cursor', 'codex', 'Write Tests for Auth', 'Please write unit tests for /src/auth/jwt.ts', 'ACTION_REQUIRED');
  console.log('  Sent Message:', msg1.id, 'from', msg1.from_agent, 'to', msg1.to_agent);

  const codexInbox = await messagingService.fetchInbox('codex', 'ACTION_REQUIRED');
  if (codexInbox.length !== 1 || codexInbox[0].id !== msg1.id) {
    throw new Error('Inbox fetch failed!');
  }
  console.log('  Codex Inbox Fetch PASSED');

  const updatedMsg = await messagingService.markStatus(msg1.id, 'COMPLETED');
  if (updatedMsg.status !== 'COMPLETED') {
    throw new Error('Message markStatus failed!');
  }
  console.log('  Message Status Update PASSED');

  // 3. Test Task Board
  console.log('[3] Testing Task Board...');
  const task1 = await taskService.createTask('Implement Payment Gateway', 'Stripe integration in /src/payments', 'antigravity', 'TODO');
  console.log('  Created Task:', task1.id, task1.title);

  const updatedTask = await taskService.updateTask(task1.id, { status: 'IN_PROGRESS' });
  if (updatedTask.status !== 'IN_PROGRESS') {
    throw new Error('Task update failed!');
  }

  const board = await taskService.getTaskBoard('IN_PROGRESS');
  if (board.length !== 1 || board[0].id !== task1.id) {
    throw new Error('Task board query failed!');
  }
  console.log('  Task Board Operations PASSED');

  await db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

testMemorai().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
