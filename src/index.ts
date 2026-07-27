#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Database } from './db/database.js';
import { MemoryService } from './services/memory.js';
import { MessagingService } from './services/messaging.js';
import { TaskService } from './services/tasks.js';
import { MessageStatus, TaskStatus } from './types/index.js';

async function main() {
  const db = new Database();
  await db.init();

  const memoryService = new MemoryService(db);
  const messagingService = new MessagingService(db);
  const taskService = new TaskService(db);

  const server = new Server(
    {
      name: 'memorai-hub',
      version: '1.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'send_agent_message',
          description:
            'Send a message, request, or handoff to another AI desktop agent (cursor, antigravity, claude, codex, or all).',
          inputSchema: {
            type: 'object',
            properties: {
              from_agent: {
                type: 'string',
                description: 'The calling agent ID (e.g. cursor, antigravity, claude, codex)',
              },
              to_agent: {
                type: 'string',
                description: 'The recipient agent ID (e.g. cursor, antigravity, claude, codex, or all)',
              },
              topic: {
                type: 'string',
                description: 'Brief topic or task title of the message',
              },
              content: {
                type: 'string',
                description: 'Detailed instructions, context, or code references for the handoff',
              },
              status: {
                type: 'string',
                enum: ['UNREAD', 'ACTION_REQUIRED'],
                description: 'Status of the message (default: UNREAD)',
              },
            },
            required: ['from_agent', 'to_agent', 'topic', 'content'],
          },
        },
        {
          name: 'fetch_inbox',
          description:
            'Fetch unread or pending messages/handoffs addressed to the calling agent.',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'The calling agent ID fetching its inbox (e.g. cursor, antigravity, claude, codex)',
              },
              status: {
                type: 'string',
                enum: ['UNREAD', 'READ', 'ACTION_REQUIRED', 'COMPLETED'],
                description: 'Filter by specific message status',
              },
              limit: {
                type: 'number',
                description: 'Max number of messages to return (default 20)',
              },
            },
            required: ['agent_id'],
          },
        },
        {
          name: 'mark_message_status',
          description:
            'Update the status of a received message (e.g. mark as COMPLETED). Prefer claim_message to take ownership.',
          inputSchema: {
            type: 'object',
            properties: {
              message_id: {
                type: 'number',
                description: 'ID of the message to update',
              },
              status: {
                type: 'string',
                enum: ['READ', 'ACTION_REQUIRED', 'COMPLETED'],
                description: 'New status for the message',
              },
            },
            required: ['message_id', 'status'],
          },
        },
        {
          name: 'claim_message',
          description:
            'Atomically claim a message addressed to you. Sets claimed_by, marks READ. Returns claimed:false if another agent already claimed it.',
          inputSchema: {
            type: 'object',
            properties: {
              message_id: { type: 'number', description: 'ID of the message to claim' },
              agent_id: {
                type: 'string',
                description: 'The calling agent ID (must match to_agent on the message)',
              },
            },
            required: ['message_id', 'agent_id'],
          },
        },
        {
          name: 'claim_task',
          description:
            'Atomically claim a TODO task assigned to you or unassigned. Sets IN_PROGRESS. Returns claimed:false if another agent already claimed it.',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: { type: 'number', description: 'ID of the task to claim' },
              agent_id: { type: 'string', description: 'The calling agent ID' },
            },
            required: ['task_id', 'agent_id'],
          },
        },
        {
          name: 'save_shared_memory',
          description:
            'Save key context, architectural decisions, code changes, or lessons learned to the persistent shared database.',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'The calling agent ID',
              },
              topic: {
                type: 'string',
                description: 'Subject or category of the memory',
              },
              content: {
                type: 'string',
                description: 'The actual knowledge/context to persist for all agents',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags for categorizing memory (e.g. ["auth", "database", "api"])',
              },
            },
            required: ['agent_id', 'topic', 'content'],
          },
        },
        {
          name: 'search_shared_memory',
          description:
            'Query shared memory stored across all desktop agents (Cursor, Antigravity, Claude, Codex).',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Text query to search topic or content',
              },
              agent_id: {
                type: 'string',
                description: 'Filter memories created by a specific agent',
              },
              tag: {
                type: 'string',
                description: 'Filter memories by tag',
              },
              limit: {
                type: 'number',
                description: 'Max results to return (default 20)',
              },
            },
          },
        },
        {
          name: 'get_task_board',
          description: 'Retrieve current shared task list across all desktop apps.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
                description: 'Filter tasks by status',
              },
              assigned_to: {
                type: 'string',
                description: 'Filter tasks assigned to a specific agent',
              },
            },
          },
        },
        {
          name: 'create_task',
          description: 'Create a new task on the shared task board for desktop agents.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Task title',
              },
              description: {
                type: 'string',
                description: 'Detailed requirements or prompt for the task',
              },
              assigned_to: {
                type: 'string',
                description: 'Agent assigned to this task (cursor, antigravity, claude, codex, or unassigned)',
              },
              status: {
                type: 'string',
                enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
                description: 'Initial task status',
              },
            },
            required: ['title', 'description'],
          },
        },
        {
          name: 'update_task_status',
          description: 'Update the status or assignee of an existing shared task.',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'number',
                description: 'ID of the task',
              },
              status: {
                type: 'string',
                enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
                description: 'New status of the task',
              },
              assigned_to: {
                type: 'string',
                description: 'New assigned agent',
              },
            },
            required: ['task_id'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args || {}) as Record<string, unknown>;

    try {
      switch (name) {
        case 'send_agent_message': {
          const fromAgent = String(toolArgs.from_agent || '');
          const toAgent = String(toolArgs.to_agent || '');
          const topic = String(toolArgs.topic || '');
          const content = String(toolArgs.content || '');
          const status = (toolArgs.status as MessageStatus) || 'UNREAD';

          const msg = await messagingService.sendMessage(fromAgent, toAgent, topic, content, status);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: msg }, null, 2),
              },
            ],
          };
        }

        case 'fetch_inbox': {
          const agentId = String(toolArgs.agent_id || '');
          const status = toolArgs.status ? (toolArgs.status as MessageStatus) : undefined;
          const limit = typeof toolArgs.limit === 'number' ? toolArgs.limit : 20;

          const inbox = await messagingService.fetchInbox(agentId, status, limit);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ agent_id: agentId, total: inbox.length, messages: inbox }, null, 2),
              },
            ],
          };
        }

        case 'mark_message_status': {
          const messageId = Number(toolArgs.message_id);
          const status = toolArgs.status as MessageStatus;

          const updated = await messagingService.markStatus(messageId, status);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: updated }, null, 2),
              },
            ],
          };
        }

        case 'claim_message': {
          const messageId = Number(toolArgs.message_id);
          const agentId = String(toolArgs.agent_id || '');

          const result = await messagingService.claimMessage(messageId, agentId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'claim_task': {
          const taskId = Number(toolArgs.task_id);
          const agentId = String(toolArgs.agent_id || '');

          const result = await taskService.claimTask(taskId, agentId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'save_shared_memory': {
          const agentId = String(toolArgs.agent_id || '');
          const topic = String(toolArgs.topic || '');
          const content = String(toolArgs.content || '');
          const tags = Array.isArray(toolArgs.tags) ? toolArgs.tags.map(String) : [];

          const memory = await memoryService.saveMemory(agentId, topic, content, tags);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, memory }, null, 2),
              },
            ],
          };
        }

        case 'search_shared_memory': {
          const query = String(toolArgs.query || '');
          const agentId = toolArgs.agent_id ? String(toolArgs.agent_id) : undefined;
          const tag = toolArgs.tag ? String(toolArgs.tag) : undefined;
          const limit = typeof toolArgs.limit === 'number' ? toolArgs.limit : 20;

          const results = await memoryService.searchMemory(query, agentId, tag, limit);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ query, count: results.length, memories: results }, null, 2),
              },
            ],
          };
        }

        case 'get_task_board': {
          const status = toolArgs.status ? (toolArgs.status as TaskStatus) : undefined;
          const assignedTo = toolArgs.assigned_to ? String(toolArgs.assigned_to) : undefined;

          const tasks = await taskService.getTaskBoard(status, assignedTo);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ total: tasks.length, tasks }, null, 2),
              },
            ],
          };
        }

        case 'create_task': {
          const title = String(toolArgs.title || '');
          const description = String(toolArgs.description || '');
          const assignedTo = toolArgs.assigned_to ? String(toolArgs.assigned_to) : 'unassigned';
          const status = toolArgs.status ? (toolArgs.status as TaskStatus) : 'TODO';

          const task = await taskService.createTask(title, description, assignedTo, status);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, task }, null, 2),
              },
            ],
          };
        }

        case 'update_task_status': {
          const taskId = Number(toolArgs.task_id);
          const status = toolArgs.status ? (toolArgs.status as TaskStatus) : undefined;
          const assignedTo = toolArgs.assigned_to ? String(toolArgs.assigned_to) : undefined;

          const updated = await taskService.updateTask(taskId, { status, assignedTo });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, task: updated }, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${errorMessage}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Memorai MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in Memorai MCP Server:', error);
  process.exit(1);
});
