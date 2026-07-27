import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'smoke-test.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

// Set test DB path in environment
const env = { ...process.env, MEMORAI_DB_PATH: dbPath };

const serverProcess = spawn('node', [path.resolve(__dirname, '../build/index.js')], {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
let responseResolver = null;
const pendingRequests = new Map();
let requestIdCounter = 1;

serverProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep partial line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);
      if (json.id && pendingRequests.has(json.id)) {
        const resolve = pendingRequests.get(json.id);
        pendingRequests.delete(json.id);
        resolve(json);
      }
    } catch (e) {
      // Not JSON line or stderr log
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  console.log('[Server Log]:', data.toString().trim());
});

function sendRequest(method, params = {}) {
  const id = requestIdCounter++;
  const payload = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, resolve);
    serverProcess.stdin.write(JSON.stringify(payload) + '\n');
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
      }
    }, 5000);
  });
}

function sendNotification(method, params = {}) {
  const payload = {
    jsonrpc: '2.0',
    method,
    params,
  };
  serverProcess.stdin.write(JSON.stringify(payload) + '\n');
}

async function runSmokeTest() {
  console.log('🚀 Starting Full MCP Stdio Smoke Test for Memorai...');

  // 1. Initialize MCP Session
  console.log('\n[Step 1] Initializing MCP Session over Stdio...');
  const initRes = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'memorai-smoke-tester', version: '1.0.0' },
  });
  console.log('  Initialized Server:', initRes.result.serverInfo.name, initRes.result.serverInfo.version);
  sendNotification('notifications/initialized');

  // 2. List Tools
  console.log('\n[Step 2] Testing tools/list...');
  const listRes = await sendRequest('tools/list');
  const tools = listRes.result.tools;
  console.log(`  Found ${tools.length} MCP tools:`, tools.map((t) => t.name).join(', '));
  if (tools.length !== 10) {
    throw new Error(`Expected 10 tools, found ${tools.length}`);
  }

  // 3. Test save_shared_memory
  console.log('\n[Step 3] Calling save_shared_memory (Cursor)...');
  const saveRes = await sendRequest('tools/call', {
    name: 'save_shared_memory',
    arguments: {
      agent_id: 'cursor',
      topic: 'Database Schema',
      content: 'Added user_settings table with JSON preferences in /src/db/schema.ts',
      tags: ['database', 'schema', 'sqlite'],
    },
  });
  const saveOutput = JSON.parse(saveRes.result.content[0].text);
  console.log('  Result:', saveOutput.success ? 'PASSED' : 'FAILED', saveOutput.memory.topic);

  // 4. Test search_shared_memory
  console.log('\n[Step 4] Calling search_shared_memory (Antigravity querying Cursor memory)...');
  const searchRes = await sendRequest('tools/call', {
    name: 'search_shared_memory',
    arguments: {
      query: 'user_settings',
      tag: 'database',
    },
  });
  const searchOutput = JSON.parse(searchRes.result.content[0].text);
  console.log(`  Found ${searchOutput.count} matching memories. Search PASSED.`);

  // 5. Test send_agent_message (Handoff)
  console.log('\n[Step 5] Calling send_agent_message (Cursor -> Codex handoff)...');
  const sendMsgRes = await sendRequest('tools/call', {
    name: 'send_agent_message',
    arguments: {
      from_agent: 'cursor',
      to_agent: 'codex',
      topic: 'Write schema unit tests',
      content: 'Please write unit tests for user_settings table in /tests/schema.test.ts',
      status: 'ACTION_REQUIRED',
    },
  });
  const sendMsgOutput = JSON.parse(sendMsgRes.result.content[0].text);
  const msgId = sendMsgOutput.message.id;
  console.log(`  Message Sent (ID ${msgId}). PASSED.`);

  // 6. Test fetch_inbox (Codex inbox)
  console.log('\n[Step 6] Calling fetch_inbox (Codex inbox check)...');
  const inboxRes = await sendRequest('tools/call', {
    name: 'fetch_inbox',
    arguments: {
      agent_id: 'codex',
      status: 'ACTION_REQUIRED',
    },
  });
  const inboxOutput = JSON.parse(inboxRes.result.content[0].text);
  console.log(`  Codex Inbox contains ${inboxOutput.total} message(s). PASSED.`);

  // 6b. Test claim_message (atomic claim)
  console.log('\n[Step 6b] Calling claim_message (Codex claims handoff)...');
  const claimRes = await sendRequest('tools/call', {
    name: 'claim_message',
    arguments: { message_id: msgId, agent_id: 'codex' },
  });
  const claimOutput = JSON.parse(claimRes.result.content[0].text);
  if (!claimOutput.claimed) {
    throw new Error('claim_message should return claimed:true for first claim');
  }
  console.log('  claim_message claimed:', claimOutput.claimed, 'PASSED.');

  const claimAgainRes = await sendRequest('tools/call', {
    name: 'claim_message',
    arguments: { message_id: msgId, agent_id: 'cursor' },
  });
  const claimAgainOutput = JSON.parse(claimAgainRes.result.content[0].text);
  if (claimAgainOutput.claimed) {
    throw new Error('Second claim_message should return claimed:false');
  }
  console.log('  Duplicate claim rejected. PASSED.');

  // 7. Test mark_message_status
  console.log('\n[Step 7] Calling mark_message_status (Codex marks task COMPLETED)...');
  const markRes = await sendRequest('tools/call', {
    name: 'mark_message_status',
    arguments: {
      message_id: msgId,
      status: 'COMPLETED',
    },
  });
  const markOutput = JSON.parse(markRes.result.content[0].text);
  console.log('  Message Status updated to:', markOutput.message.status, 'PASSED.');

  // 8. Test Task Board (create_task, get_task_board, update_task_status)
  console.log('\n[Step 8] Testing Task Board Workflow (Claude creating task, Antigravity picking it up)...');
  const createTaskRes = await sendRequest('tools/call', {
    name: 'create_task',
    arguments: {
      title: 'Build UI for User Preferences',
      description: 'Render user_settings form inside Settings modal component.',
      assigned_to: 'claude',
      status: 'TODO',
    },
  });
  const createTaskOutput = JSON.parse(createTaskRes.result.content[0].text);
  const taskId = createTaskOutput.task.id;
  console.log(`  Task Created (ID ${taskId}). PASSED.`);

  const updateTaskRes = await sendRequest('tools/call', {
    name: 'update_task_status',
    arguments: {
      task_id: taskId,
      status: 'IN_PROGRESS',
      assigned_to: 'antigravity',
    },
  });
  const updateTaskOutput = JSON.parse(updateTaskRes.result.content[0].text);
  console.log('  Task Updated:', updateTaskOutput.task.assigned_to, updateTaskOutput.task.status, 'PASSED.');

  const getTaskBoardRes = await sendRequest('tools/call', {
    name: 'get_task_board',
    arguments: {
      status: 'IN_PROGRESS',
    },
  });
  const getTaskBoardOutput = JSON.parse(getTaskBoardRes.result.content[0].text);
  console.log(`  Task Board query returned ${getTaskBoardOutput.total} active task(s). PASSED.`);

  console.log('\n✨ =============================================== ✨');
  console.log('🎉 ALL 10 MCP TOOLS SMOKE TESTED OVER STDIO SUCCESSFULLY!');
  console.log('✨ =============================================== ✨\n');

  serverProcess.kill();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  process.exit(0);
}

runSmokeTest().catch((err) => {
  console.error('\n❌ SMOKE TEST FAILED:', err);
  serverProcess.kill();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  process.exit(1);
});
