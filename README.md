# Memorai 🧠

**Shared Memory and Inter-Agent Communication MCP Server** for **Cursor**, **Google Antigravity**, **Claude Desktop**, and **OpenAI Codex** desktop applications.

Memorai provides a local Model Context Protocol (MCP) server running on `stdio` or HTTP, backed by SQLite, enabling desktop AI agents to exchange handoff messages, store/search long-term memories, and coordinate tasks across a shared board without hitting API limits or violating provider terms.

---

## Features

- **Inter-Agent Messaging (`send_agent_message`, `fetch_inbox`)**: Send task handoffs and requests between Cursor, Antigravity, Claude, and Codex.
- **Shared Memory Store (`save_shared_memory`, `search_shared_memory`)**: Save architectural decisions, code changes, and lessons learned into a local search database.
- **Task Board (`create_task`, `get_task_board`, `update_task_status`)**: Maintain a shared project task queue across all desktop apps.
- **TOS & Anti-Ban Safe**: Runs 100% locally via official MCP client interfaces. No automated scrapers or reverse-engineered web endpoints.

---

## Quick Start

### 1. Build Memorai

```bash
cd /path/to/memorai
npm install
npm run build
```

---

## Desktop App Configurations

Add Memorai to the MCP configuration file of each desktop app:

### A. Cursor IDE
Open `Cursor Settings` -> `Features` -> `MCP` (or edit `~/.cursor/mcp.json` / workspace `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "memorai": {
      "command": "node",
      "args": ["/path/to/memorai/build/index.js"]
    }
  }
}
```

### B. Claude Desktop App
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memorai": {
      "command": "node",
      "args": ["/path/to/memorai/build/index.js"]
    }
  }
}
```

### C. Google Antigravity IDE
Add to your Antigravity MCP extensions/settings panel:

```json
{
  "mcpServers": {
    "memorai": {
      "command": "node",
      "args": ["/path/to/memorai/build/index.js"]
    }
  }
}
```

### D. OpenAI Codex Desktop / Extension
Add to your Codex MCP settings file (`~/.codex/mcp.json`):

```json
{
  "mcpServers": {
    "memorai": {
      "command": "node",
      "args": ["/path/to/memorai/build/index.js"]
    }
  }
}
```

---

## Available MCP Tools

| Tool Name | Parameters | Description |
|---|---|---|
| `send_agent_message` | `from_agent`, `to_agent`, `topic`, `content`, `status` | Send direct task handoffs to another desktop app. |
| `fetch_inbox` | `agent_id`, `status`, `limit` | Fetch incoming handoffs addressed to the calling app. |
| `mark_message_status` | `message_id`, `status` | Update message status (`READ`, `COMPLETED`). |
| `save_shared_memory` | `agent_id`, `topic`, `content`, `tags` | Store key context, architecture decisions, or lessons. |
| `search_shared_memory` | `query`, `agent_id`, `tag`, `limit` | Search shared memory stored across all desktop apps. |
| `get_task_board` | `status`, `assigned_to` | Get current active project tasks across apps. |
| `create_task` | `title`, `description`, `assigned_to`, `status` | Add a new item to the shared task board. |
| `update_task_status` | `task_id`, `status`, `assigned_to` | Update task assignee or completion state. |

---

## Example Workflow in Desktop Apps

1. **In Cursor IDE**:
   > *"I refactored the auth module. Save this architectural decision to shared memory tag `auth` and send a message to Codex to write tests for `/src/auth/jwt.ts`."*
   - Cursor calls `save_shared_memory` and `send_agent_message({ to_agent: "codex", ... })`.

2. **In OpenAI Codex Desktop**:
   > *"Check Memorai inbox for any pending tasks for codex."*
   - Codex calls `fetch_inbox({ agent_id: "codex" })`, receives Cursor's handoff prompt, and starts writing tests.

3. **In Claude Desktop / Antigravity**:
   > *"Search shared memory for `auth` decisions before adding UI sign-in form."*
   - Claude/Antigravity calls `search_shared_memory({ tag: "auth" })`, receives the RSA JWT details logged by Cursor, and aligns its code generation.
