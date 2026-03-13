# MACS MCP Server (v4.0)

Expose MACS as **Model Context Protocol (MCP)** tools — give Claude Desktop direct access to your multi-agent project.

## What you get

14 MCP tools covering the full MACS workflow:

| Tool | Description |
|------|-------------|
| `macs_status` | Project overview: task counts, active agents |
| `macs_list_tasks` | List tasks with filters (status, assignee, tag, priority) |
| `macs_get_task` | Full task details including history & handoff notes |
| `macs_create_task` | Create a new task |
| `macs_claim_task` | Claim next available task (capability-matched) |
| `macs_complete_task` | Mark task done (or request review) |
| `macs_block_task` | Block task with mandatory handoff note |
| `macs_escalate_task` | Escalate to human / lead agent |
| `macs_review_task` | Approve or reject a review_required task |
| `macs_checkpoint` | Record progress (prevents drift detection) |
| `macs_send_message` | Send message to agent inbox |
| `macs_get_inbox` | Check agent inbox |
| `macs_ci_check` | Consistency check (stale tasks, dead agents, broken deps) |
| `macs_list_templates` | List project templates |
| `macs_apply_template` | Apply template (saas-mvp, api-service, data-pipeline, cli-tool) |

## Setup

### 1. Install dependencies

```bash
# From your project root
npm install tsx
```

### 2. Configure Claude Desktop

Edit `~/.claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "macs": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/macs-skill/adapters/mcp/macs-mcp-server.ts",
        "/path/to/your/project"
      ]
    }
  }
}
```

Replace paths with your actual paths. Restart Claude Desktop.

### 3. Use in Claude Desktop

Claude now has access to all 14 MACS tools. Example prompts:

```
Show me the project status
→ Uses macs_status

What tasks are available for a backend agent?
→ Uses macs_list_tasks with status=pending

Claim the next task for agent "engineer-sonnet"
→ Uses macs_claim_task

Mark T-003 as complete, artifacts: src/auth/jwt.ts
→ Uses macs_complete_task

Run a CI check on the project
→ Uses macs_ci_check

Set up a SaaS MVP project for agent "lead-opus"
→ Uses macs_apply_template with template_name=saas-mvp
```

## Running manually (test)

```bash
cd /path/to/macs-skill
npx tsx adapters/mcp/macs-mcp-server.ts /path/to/your/project
```

The server reads JSON-RPC 2.0 from stdin and writes to stdout.

## Architecture

```
Claude Desktop
    ↓ MCP stdio (JSON-RPC 2.0)
macs-mcp-server.ts
    ↓ Direct TypeScript import
MACSEngine (engine.ts)
    ↓ JSONL append-only
.macs/protocol/tasks.jsonl + events.jsonl
```

No HTTP server needed — the MCP server runs as a subprocess of Claude Desktop.
