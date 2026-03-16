# MACS Quick Start

> Goal: prove a new agent framework can attach to the same `.macs/` workspace in under 5 minutes.

## Prerequisites

- Node.js 18+
- A repo where your agent can run shell commands
- `macs-protocol` installed:

```bash
npm install -g macs-protocol
```

## The 3-Command Smoke Test

Run these commands in the target repo:

```bash
macs init "Interop Demo"
macs add "Smoke test: prove another framework can pick this up" --requires review
macs boot --agent codex-review --capabilities review --model gpt-5
```

What each command proves:

1. `macs init` creates `.macs/`, the framework-neutral workbench.
2. `macs add` records real work in the shared protocol.
3. `macs boot` lets an agent join late, catch up, and pick up work from the same shared state.

If that third command works from your framework, the framework is integrated.

## Swap In Any Agent

Only the third command changes:

```bash
macs boot --agent claude-review --capabilities review --model sonnet
macs boot --agent cursor-review --capabilities review --model claude-4-sonnet
macs boot --agent aider-review --capabilities review --model gpt-4.1
macs boot --agent openclaw-review --capabilities review --model opus
```

The contract stays the same:

- Read shared state from `.macs/`
- Claim or resume work through the CLI
- Write completion, checkpoints, reviews, or blockers back to `.macs/`

## What You Should See

`macs boot` prints the current project picture for that specific agent:

- who the agent is
- available or resumed task
- unresolved blockers
- recent handoff notes
- current project status

That is the cross-framework handoff test. The source of truth is not Cursor, Codex, or Claude Code. The source of truth is `.macs/`.

## Finish The Loop

Once the agent completes the smoke test task:

```bash
macs done T-001 --agent codex-review --summary "Smoke test completed" --artifacts "README.md"
macs status
macs log --limit 10
```

This confirms the agent can both read and write the shared protocol.

## Framework-Specific Entry Paths

Use the smallest possible adapter for each framework:

| Framework | Entry path |
|---|---|
| Codex | [adapters/codex/README.md](../adapters/codex/README.md) |
| Claude Code / PACEflow | [adapters/paceflow/README.md](../adapters/paceflow/README.md) |
| OpenClaw | [adapters/openclaw/README.md](../adapters/openclaw/README.md) |
| Cursor | [adapters/cursor/README.md](../adapters/cursor/README.md) |
| Aider | [adapters/aider/README.md](../adapters/aider/README.md) |
| Claude Desktop / MCP | [adapters/mcp/README.md](../adapters/mcp/README.md) |
| LangChain / CrewAI / AutoGen | [adapters/langchain/pymacs.py](../adapters/langchain/pymacs.py) |

## Common Failure Modes

### The agent cannot run shell commands

Use a thin wrapper or MCP bridge so the agent can call `macs boot`, `macs done`, and `macs block`.

### The agent can read files but forgets to join MACS

Inject a tiny instruction block into the framework's native config:

- `AGENTS.md` for Codex
- `CLAUDE.md` for Claude-style agents
- `.cursorrules` for Cursor

### The repo is remote or containerized

Use the transport or MCP layer instead of direct filesystem access:

- [adapters/mcp/README.md](../adapters/mcp/README.md)
- `.macs/transport/server.ts`

## Next

- Read [PLATFORM-COMPATIBILITY.md](./PLATFORM-COMPATIBILITY.md) for concrete integration paths.
- Read [../README.md](../README.md) for positioning and architecture.
