# MACS — The Universal Workbench for AI Agents

> Claude Code, Codex, Cursor, Aider, OpenClaw, LangChain agents can keep their own UX and still share one workbench.
>
> **MACS gives every agent the same project state through `.macs/`.** No central SaaS. No vendor lock-in. Just files, Git, and a protocol.

[![npm](https://img.shields.io/npm/v/macs-protocol)](https://www.npmjs.com/package/macs-protocol)
[![tests](https://img.shields.io/badge/tests-123%20passing-brightgreen)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#license)
[![GitHub Stars](https://img.shields.io/github/stars/Vdc-K/macs-protocol?style=social)](https://github.com/Vdc-K/macs-protocol/stargazers)

[English](#five-minute-integration-test) | [中文](#中文)

---

## See It In Action

![MACS swarm demo](./demo.svg)

**One workbench. Multiple frameworks. Shared state, shared handoffs, zero blind spots.**

## The Problem

The hard part is no longer "multiple agents might conflict."

The hard part is this:

```text
Claude Code creates task T-007 and changes the API contract
Codex reviews an older assumption because it cannot see Claude's task state
Cursor keeps editing the same frontend flow with stale context
→ each tool is locally smart, but globally blind
```

Built-in tools coordinate agents inside one framework.
They do not create a shared work surface across frameworks.

## `.macs/` Is The Shared Workbench

```text
Claude Code hooks / Agent Teams  ┐
Codex + AGENTS.md               │
Cursor + .cursorrules           │
Aider wrapper                   ├─► .macs/
OpenClaw + CLAUDE.md            │    ├── protocol/   append-only JSONL state
LangChain / CrewAI SDK          │    ├── sync/       agent inboxes and handoffs
Claude Desktop via MCP          │    ├── human/      Markdown for humans
Cloud / CI agents via HTTP      ┘    └── transport/  remote access when filesystem is not shared
```

Every framework keeps its native runtime and UX.
They just converge on one neutral state directory that humans can inspect and Git can version.

### What Lives In `.macs/`

```text
.macs/
├── protocol/
│   ├── tasks.jsonl    # Task lifecycle events
│   ├── events.jsonl   # Decisions, checkpoints, breaking changes, reviews
│   ├── state.json     # Rebuilt snapshot (auto-generated, read-only)
│   └── state.json     # Agent registry + task state (auto-generated)
├── sync/
│   └── inbox/         # Agent-to-agent messages
├── human/
│   ├── STATUS.md      # Project summary for humans or simple tools
│   ├── TASK.md        # Generated task board
│   └── CHANGELOG.md   # Generated activity log
├── transport/
│   └── server.ts      # REST + SSE for remote agents
└── plugins/
    └── *.js           # Lifecycle hooks
```

## Why Not Built-In Tools?

If your whole team lives inside one product, use the built-in tools first.
MACS matters when a second framework enters the repo.

| Question | Built-in tools inside one framework | MACS |
|---|---|---|
| Great for one vendor's agent runtime? | Yes | Usually overkill |
| Claude Code ↔ Codex ↔ Cursor share one task state? | No | Yes |
| Shared append-only work log in Git? | Usually scattered or tool-specific | Yes |
| Human-readable audit trail? | Partial | Yes, via `.macs/human/` |
| Survives switching frameworks mid-task? | Manual | Yes, via `macs boot` + handoff events |
| Best fit | Single-framework teams | Mixed-framework teams |

Examples:

- Claude Code Agent Teams and PACEflow are good at coordinating Claude Code agents.
- Cursor rules are good at steering Cursor.
- Aider wrappers are good at one or more Aider processes.
- MACS is the neutral layer they can all see together.

## Five-Minute Integration Test

Install once:

```bash
npm install -g macs-protocol
```

Then run these 3 commands in any repo:

```bash
macs init "Interop Demo"
macs add "Smoke test: prove another framework can pick this up" --requires review
macs boot --agent codex-review --capabilities review --model gpt-5
```

What this proves:

- Command 1 creates the shared workbench: `.macs/`
- Command 2 writes framework-neutral work into the protocol
- Command 3 lets any agent attach, catch up, read inbox, and pick the next task

Swap only the agent identity on command 3:

```bash
macs boot --agent claude-review --capabilities review --model sonnet
macs boot --agent cursor-review --capabilities review --model claude-4-sonnet
macs boot --agent aider-review --capabilities review --model gpt-4.1
```

If a tool can run one shell command, or can be nudged to do so from `AGENTS.md`, `CLAUDE.md`, or `.cursorrules`, it can join the same `.macs/` workspace.

## Platform Support

Every integration below resolves to the same `.macs/` directory. The only thing that changes is how the agent is told to call `macs boot`, `macs done`, and `macs block`.

| Framework | Integration path | Concrete file or command |
|---|---|---|
| Claude Code / PACEflow | Hook quality gates + same MACS CLI | [adapters/paceflow/README.md](./adapters/paceflow/README.md) |
| Codex | Add MACS protocol block to `AGENTS.md` | [adapters/codex/README.md](./adapters/codex/README.md) |
| OpenClaw | Append MACS protocol block to `CLAUDE.md` | [adapters/openclaw/README.md](./adapters/openclaw/README.md) |
| Cursor | Inject MACS instructions into `.cursorrules` | [adapters/cursor/README.md](./adapters/cursor/README.md) |
| Aider | Use wrapper that auto-claims and boots tasks | [adapters/aider/README.md](./adapters/aider/README.md) |
| Continue.dev | Add `.macs` files as context providers | [docs/PLATFORM-COMPATIBILITY.md](./docs/PLATFORM-COMPATIBILITY.md) |
| LangChain / CrewAI / AutoGen | Import the Python SDK and read/write `.macs/` | [adapters/langchain/pymacs.py](./adapters/langchain/pymacs.py) |
| Claude Desktop / remote agents | Expose MACS as MCP tools or HTTP transport | [adapters/mcp/README.md](./adapters/mcp/README.md) |

## Core Workflow

```bash
macs init "My Project"
macs add "Implement auth API" --requires backend,api
macs boot --agent backend-sonnet --capabilities backend,api --model sonnet
macs done T-001 --agent backend-sonnet --summary "JWT auth live" --artifacts "src/auth.ts"
```

If the agent gets blocked:

```bash
macs block T-001 --agent backend-sonnet \
  --reason "Need OAuth provider decision" \
  --next "JWT middleware is ready; plug provider into src/auth.ts" \
  --done "login + refresh flow implemented" \
  --issue "provider contract unresolved"
```

## What MACS Adds

- **Event sourcing**: append-only history that any framework can rebuild
- **Capability routing**: only compatible agents claim compatible work
- **Forced handoff**: blocked or cancelled tasks must leave structured context
- **Review chain**: agents can request approval before a task becomes complete
- **Inbox and escalation**: agents can message each other or escalate to humans
- **Drift detection**: identify silent or spinning agents before work rots
- **Swarm orchestration**: assign dependency-ordered work across many agents
- **Transport options**: local files first, HTTP and MCP when needed

## Where MACS Sits

```text
Communication layer     Shared workbench       Capability layer
(how agents talk)      (how frameworks share) (how agents evolve)

A2A / MCP / ACP   →    MACS (.macs/)     →    Skills / eval / routing / memory
```

A2A and MCP solve how agents talk.
MACS solves how agents working in different frameworks see the same work.

## Roadmap

- [x] **v3.0** — JSONL protocol, event sourcing, inbox messaging, swarm, forced handoff
- [x] **v3.1** — Capability routing, review chain, escalation protocol, dead agent reaping
- [x] **v4.0** — Plugin system, MCP bridge, template market, CI/CD integration
- [x] **v4.1** — Formal protocol spec, `spec_version`, agent `instance_id` and `session_id`
- [x] **v5.0** — HTTP transport API, per-agent event sharding, storage abstraction
- [x] **v5.1** — Easy-mode CLI (`macs add`, auto-claim `macs start`)
- [x] **v5.2** — Superpowers plan import, PACEflow hooks
- [x] **v5.3** — Skill marketplace
- [x] **v5.4** — [4-agent dogfood](DOGFOOD-REPORT.md): Claude Opus + Sonnet + GPT-5.4 + local OmniCoder-9B shared one `.macs/` workspace; found and fixed 3 protocol bugs same day

## Real-World Validation

We [dogfooded MACS](DOGFOOD-REPORT.md) with 4 agents from 3 providers (Anthropic, OpenAI, local Ollama) on a real task. A **9B local model running on a laptop** made a design decision that unblocked a task for Claude Opus. The experiment found 3 protocol bugs — all fixed and shipped in v5.4.0.

## License

MIT © 2026

---

## 中文

# MACS — AI Agent 的通用工作台

> 不是再做一个只服务单一框架的 agent 功能，而是让不同框架的 agent 能看见同一份工作状态。

### 问题不是“多 agent 会冲突”，而是“跨框架 agent 看不到彼此”

```text
Claude Code 改了任务状态和 API 契约
Codex 看不到这份上下文，继续基于旧假设审查
Cursor 也在另一个会话里改同一条前端链路
→ 每个工具都很聪明，但全局是盲的
```

### `.macs/` 是中立工作台

```text
Claude Code / Codex / Cursor / Aider / OpenClaw / LangChain
                         ↓
                      .macs/
              protocol + inbox + human + transport
```

各框架保留自己的原生体验，只把工作状态汇聚到 `.macs/`。

### 为什么不是直接用内置工具？

如果你永远只在一个框架里工作，内置工具通常更合适。
MACS 解决的是第二个框架进入仓库之后的问题。

| 问题 | 单框架内置工具 | MACS |
|---|---|---|
| 单一框架内体验最好 | 是 | 不一定 |
| Claude Code / Codex / Cursor 共享任务状态 | 否 | 是 |
| 状态能直接跟 Git 一起版本化 | 一般不行 | 可以 |
| 中途换框架还能续上任务 | 手动 | `macs boot` 自动接上 |

### 5 分钟集成测试

```bash
macs init "Interop Demo"
macs add "Smoke test: prove another framework can pick this up" --requires review
macs boot --agent codex-review --capabilities review --model gpt-5
```

把第 3 条命令里的 agent 身份换成 Claude Code、Cursor、Aider、OpenClaw 都成立。

### 平台支持

- Claude Code / PACEflow: [adapters/paceflow/README.md](./adapters/paceflow/README.md)
- Codex: [adapters/codex/README.md](./adapters/codex/README.md)
- OpenClaw: [adapters/openclaw/README.md](./adapters/openclaw/README.md)
- Cursor: [adapters/cursor/README.md](./adapters/cursor/README.md)
- Aider: [adapters/aider/README.md](./adapters/aider/README.md)
- Continue.dev / VS Code: [docs/PLATFORM-COMPATIBILITY.md](./docs/PLATFORM-COMPATIBILITY.md)
- LangChain / CrewAI / AutoGen: [adapters/langchain/pymacs.py](./adapters/langchain/pymacs.py)
- Claude Desktop / 远程 agent: [adapters/mcp/README.md](./adapters/mcp/README.md)

一句话：

**A2A / MCP 解决”怎么说话”，MACS 解决”不同框架的 agent 怎么共用一张工作台”。**

### 真实验证

我们用 4 个 agent（Claude Opus + Sonnet + GPT-5.4 + 本地 OmniCoder-9B）[做了一次真实协作实验](DOGFOOD-REPORT.md)。一个跑在笔记本上的 9B 本地模型做了一个设计决策，解除了 Claude Opus 的任务阻塞。实验发现了 3 个协议层 bug，当天全部修复并发版 v5.4.0。
