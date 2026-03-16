# MACS Platform Compatibility

> The question is not "does this framework have built-in agent tooling?"
>
> The question is "how does this framework attach to the same `.macs/` workbench as every other framework?"

## Decision Rule

- If your team stays inside one framework, start with that framework's built-in tools.
- If work crosses frameworks, give every framework the same `.macs/` state and the same `macs boot` entry point.

## Integration Matrix

| Framework | Status | How it attaches to `.macs/` | Concrete path |
|---|---|---|---|
| Claude Code / PACEflow | Native + hooks | Hooks call MACS during session lifecycle | [adapters/paceflow/README.md](../adapters/paceflow/README.md) |
| Codex | Manual but direct | `AGENTS.md` instructs Codex to call `macs boot` | [adapters/codex/README.md](../adapters/codex/README.md) |
| OpenClaw | Manual but direct | `CLAUDE.md` injects the MACS protocol block | [adapters/openclaw/README.md](../adapters/openclaw/README.md) |
| Cursor | Native prompt rules | `.cursorrules` points Cursor at MACS files and commands | [adapters/cursor/README.md](../adapters/cursor/README.md) |
| Aider | Wrapper-based | Wrapper claims work, boots context, then launches Aider | [adapters/aider/README.md](../adapters/aider/README.md) |
| Continue.dev | Context-provider based | `.continue/config.json` exposes MACS files to prompts | This document |
| LangChain / CrewAI / AutoGen | SDK | Python API reads and writes `.macs/` directly | [adapters/langchain/pymacs.py](../adapters/langchain/pymacs.py) |
| Claude Desktop | MCP | MACS is exposed as MCP tools | [adapters/mcp/README.md](../adapters/mcp/README.md) |
| Remote / cloud agents | HTTP transport | Use REST + SSE against the same project state | `.macs/transport/server.ts` |
| Generic shell-capable agents | Minimal | Run `macs boot`, `macs done`, `macs block` | [docs/QUICKSTART.md](./QUICKSTART.md) |

## Claude Code / PACEflow

Best when you want Claude-native quality gates plus shared cross-framework state.

Entry path:

```bash
macs install-hooks --mode pace
```

Or:

```bash
bash adapters/paceflow/install.sh
```

What this gives you:

- Claude session hooks
- plan-before-write gates
- checkpoint enforcement
- shared task state in `.macs/`

Docs: [adapters/paceflow/README.md](../adapters/paceflow/README.md)

## Codex

Best when Codex should join the same repo as a reviewer, implementer, or second opinion.

Entry path:

```bash
cat adapters/codex/macs-context.md >> AGENTS.md
```

Then Codex sessions use the normal MACS commands:

```bash
macs boot --agent codex-review --capabilities review --model gpt-5
macs done T-001 --agent codex-review --summary "Review complete"
```

Docs: [adapters/codex/README.md](../adapters/codex/README.md)

## OpenClaw

Best when you want session-based Claude-style agents to resume work cleanly.

Entry path:

```bash
cat adapters/openclaw/macs-context.md >> CLAUDE.md
```

Docs: [adapters/openclaw/README.md](../adapters/openclaw/README.md)

## Cursor

Best when Cursor should stay inside its own UX but still follow shared task state.

Entry path:

```bash
./install.sh
```

That adds MACS guidance to `.cursorrules`. Cursor then reads MACS instructions before work and writes back after work.

Docs: [adapters/cursor/README.md](../adapters/cursor/README.md)

## Aider

Best when you want multiple CLI coding agents sharing one queue.

Entry path:

```bash
./adapters/aider/macs-aider.sh
```

What the wrapper does:

- registers the agent
- claims a task
- injects MACS context
- records completion when Aider exits

Docs: [adapters/aider/README.md](../adapters/aider/README.md)

## Continue.dev

Best when you want VS Code-native prompts to see `.macs/` files.

Entry path:

```json
{
  "contextProviders": [
    { "name": "macs-status", "params": { "filepath": ".macs/human/STATUS.md" } },
    { "name": "macs-task", "params": { "filepath": ".macs/human/TASK.md" } },
    { "name": "macs-changelog", "params": { "filepath": ".macs/human/CHANGELOG.md" } }
  ]
}
```

Then instruct Continue to call:

```bash
macs boot --agent continue-dev --capabilities docs,review --model sonnet
```

## LangChain / CrewAI / AutoGen

Best when the framework is already code-driven and you want direct protocol access.

Entry path:

```python
from pymacs import MACS

macs = MACS.init("My Project", path="./my-project")
status = macs.get_status()
```

Docs: [adapters/langchain/pymacs.py](../adapters/langchain/pymacs.py)

## Claude Desktop / MCP

Best when an agent cannot access the repo filesystem directly but can use MCP tools.

Entry path:

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

Docs: [adapters/mcp/README.md](../adapters/mcp/README.md)

## Generic Pattern

If your framework is not listed, integrate the minimum contract:

1. Call `macs boot --agent <id> --capabilities <caps> --model <model>` at session start.
2. Call `macs done`, `macs block`, or `macs checkpoint` before the session ends.
3. Point the framework at one native instruction file:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.cursorrules`
   - equivalent system prompt file

If those 3 conditions are true, the framework can join the same shared workbench.
