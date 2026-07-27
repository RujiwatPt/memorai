---
name: memorai
description: Shared memory, inter-agent messaging, and task handoff protocol for Cursor, Antigravity, Claude, and Codex desktop apps using the Memorai MCP server. Use when saving context across sessions, querying past architectural decisions, sending handoffs to other desktop agents, or managing the shared task board.
---

# Memorai: Inter-Agent Memory & Communication Protocol

Use the **Memorai** MCP tools to coordinate state, share memories, and hand off tasks between **Cursor**, **Google Antigravity**, **Claude Desktop**, and **OpenAI Codex**.

## MCP server name per agent

The server may appear under different names depending on the host app:

| Agent | Typical MCP server name | Config location |
|---|---|---|
| **Cursor** | `user-memorai` | `~/.cursor/mcp.json` → `mcpServers.memorai` |
| **Codex** | `memorai` | `~/.codex/config.toml` → `[mcp_servers.memorai]` |
| **Claude** | `memorai` | `~/.claude.json` |
| **Antigravity** | `memorai` | `~/.gemini/settings.json` → `mcpServers.memorai` |

In Cursor, call tools via the `user-memorai` server (e.g. `fetch_inbox` on
`user-memorai`). The `agent_id` you pass is still `cursor`.

## 1. When to Use Memorai Tools

### A. Saving Shared Memory (`save_shared_memory`)
- **When**: After making important architectural choices, database schema changes, complex refactors, or solving non-obvious bugs.
- **Goal**: Allow other desktop agents to benefit from your work without re-analyzing the entire codebase.
- **Example Call**:
  ```json
  {
    "agent_id": "cursor",
    "topic": "Auth System RSA Keys",
    "content": "Updated JWT signing in /src/auth/jwt.ts to use RSA keypairs. Public key is loaded via RSA_PUBLIC_KEY env var.",
    "tags": ["auth", "security", "jwt"]
  }
  ```

### B. Querying Shared Memory (`search_shared_memory`)
- **When**: Starting a new feature, touching unfamiliar modules, or resuming work from another desktop agent.
- **Example Call**:
  ```json
  {
    "query": "authentication RSA keys",
    "tag": "auth"
  }
  ```

### C. Sending Agent Messages / Handoffs (`send_agent_message`)
- **When**: Finishing a subtask that requires next steps in another AI tool (e.g. Cursor wrote backend code, now Codex should write unit tests).
- **Example Call**:
  ```json
  {
    "from_agent": "cursor",
    "to_agent": "codex",
    "topic": "Unit Tests for Auth Module",
    "content": "Please write unit tests for /src/auth/jwt.ts covering RSA token generation and validation.",
    "status": "ACTION_REQUIRED"
  }
  ```
- **When relaying**: Pass the claimed parent message's id as
  `relay_parent_id`. Do not copy or edit origin/hop text in `content`; the server
  derives `relay_origin` and `relay_hop` and rejects invalid or full-lap relays.

### D. Checking Inbox (`fetch_inbox`)
- **When**: Prompted to check for pending handoffs or when starting a session assigned by another desktop app.
- **Example Call**:
  ```json
  {
    "agent_id": "codex",
    "status": "ACTION_REQUIRED"
  }
  ```

### E. Managing the Task Board (`create_task`, `get_task_board`, `update_task_status`)
- **When**: Breaking complex projects into multi-agent tasks or tracking feature progress.
- **Example Call**:
  ```json
  {
    "task_id": 4,
    "status": "IN_PROGRESS",
    "assigned_to": "antigravity"
  }
  ```

### F. Claiming work atomically (`claim_message`, `claim_task`)
- **When**: Picking up a handoff or task that another agent might also see.
- **Prefer over** `mark_message_status(READ)` for claiming — only one agent wins.
- **Example**:
  ```json
  { "message_id": 3, "agent_id": "cursor" }
  ```
  Returns `{ "claimed": true, "record": {...} }` or `{ "claimed": false, ... }`.

## 2. Best Practices for Agents
1. **Be Concise in Memory**: Store structured context and file paths, not huge raw code blocks.
2. **Always Tag Memories**: Use relevant tags (e.g., `["database", "migration"]`, `["frontend", "ui"]`).
3. **Acknowledge Handoffs**: Use `claim_message` to take ownership, then `mark_message_status` → `COMPLETED` when finished.
4. **Target Specific Provider Agents**: Always target a specific agent (`to_agent: "cursor"`, `"codex"`, `"claude"`, or `"antigravity"`) for actionable handoffs (`status: "ACTION_REQUIRED"`). Avoid broadcasting actionable work to `"all"` to prevent multi-agent collisions.
5. **Multi-Repo Context & Absolute Paths**: Always include the absolute repository root path (e.g., `Repository: /path/to/RepoName`) and git branch in `send_agent_message` content and `save_shared_memory` so receiving agents in different workspace folders can identify and target the correct repository immediately.
6. **Use Structured Relay State**: Omit `relay_parent_id` for a new handoff. Supply the claimed parent id when relaying; never trust relay metadata embedded in free-form content.
