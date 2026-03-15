# MACS — The Universal Workbench for AI Agents

> Claude Code, Codex, Cursor, Devin, Windsurf — every agent speaks a different language.
>
> **MACS gives them one shared workbench.** Any agent that can read/write files can join. No servers, no setup, just JSONL + Git.

[![npm](https://img.shields.io/npm/v/macs-protocol)](https://www.npmjs.com/package/macs-protocol)
[![tests](https://img.shields.io/badge/tests-123%20passing-brightgreen)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](#license)
[![GitHub Stars](https://img.shields.io/github/stars/Vdc-K/macs-protocol?style=social)](https://github.com/Vdc-K/macs-protocol/stargazers)

[English](#quick-start) | [中文](#中文)

---

## See It In Action

![MACS swarm demo](./demo.svg)

**One command. 5 agents. 12 tasks. Dependency-ordered, zero conflicts.**

---

## The Problem

Every AI coding agent is powerful alone. But they can't work together:

```
Claude Code writes the backend    — doesn't know Cursor is redesigning the API
Codex reviews the PR              — doesn't know Devin already deployed a fix
Windsurf runs the tests           — doesn't know the schema changed 10 minutes ago
→ Everyone's working. Nobody's coordinating. Everything breaks.
```

Each agent has its own built-in task system (Claude Code has Agent Teams, Cursor has Composer, Codex has its own context). But **none of them can see what the others are doing.**

**A2A/MCP solve how agents talk. MACS solves how agents work together — regardless of which framework they run on.**

### Why not just use each agent's built-in tools?

Built-in tools (like Claude Code's Agent Teams) are great — **within that agent's ecosystem.** But the moment you involve a second framework, you need a shared layer:

| Scenario | Built-in tools | MACS |
|----------|---------------|------|
| 3 Claude Code agents on one project | ✅ Agent Teams works | ✅ Also works |
| Claude Code + Codex + Cursor together | ❌ No shared state | ✅ File-based protocol, any agent joins |
| Agent dies mid-task, different agent picks up | ❌ Context lost | ✅ Event sourcing preserves everything |
| Human wants one dashboard across all agents | ❌ Check each tool | ✅ `macs status` shows all |

## How It Works

```
.macs/
├── protocol/          ← Agents read/write here (JSONL, fast, no conflicts)
│   ├── tasks.jsonl    # Task lifecycle events (append-only)
│   ├── events.jsonl   # All changes, decisions, conflicts
│   ├── events/        # Per-agent shards (optional, events_sharding: true)
│   ├── state.json     # Current snapshot (auto-rebuilt)
│   └── agents.json    # Who's here, what can they do
│
├── sync/inbox/        ← Agent-to-agent messaging
│   ├── agent-001/
│   └── agent-002/
│
├── transport/         ← HTTP Transport API (v5, for remote/cloud agents)
│   ├── server.ts      # REST + SSE server (port 7474)
│   └── storage.ts     # StorageBackend abstraction
│
├── plugins/           ← Auto-loaded plugin hooks
│   └── my-plugin.js
│
└── human/             ← Auto-generated Markdown (for you to read)
    ├── TASK.md
    └── CHANGELOG.md
```

**Agents write JSONL → Humans read Markdown. Best of both worlds.**

## Quick Start

```bash
npm install -g macs-protocol

cd my-project
macs init "My Project"

# Launch 5 agents on 12 tasks — dependency-ordered, zero conflicts
macs swarm --agents "lead:architect|eng1:backend,api|eng2:frontend|qa:testing|devops:infra" --simulate
```

### Agent session (one command)

```bash
# Boot: register → check inbox → show status → recommend next task
macs boot --agent eng1-sonnet --capabilities backend,api
```

### Human commands

```bash
macs status          # Project overview (tasks, agents, review queue, escalations)
macs log             # Immutable event history
macs impact src/auth # Which agents/tasks does this file affect?
macs drift           # Silent tasks (agents may be stuck)
```

## Why MACS?

### vs. just using Git

Git tracks file changes. MACS tracks **who's doing what, what depends on what, and who gets affected by changes.**

### Comparison

|  | **MACS** | A2A / MCP | LangGraph | CrewAI |
|--|----------|-----------|-----------|--------|
| **Layer** | Work coordination | Communication | Orchestration | Orchestration |
| **Analogy** | Git | HTTP | Airflow | Supervisor |
| **State model** | Event sourcing (JSONL) | Message passing | Graph nodes | Sequential tasks |
| **Multi-agent** | Native (swarm, handoff) | Protocol only | Manual wiring | Role-based |
| **Requires server** | No — just files + Git | Yes | No | No |
| **Works offline** | ✅ | ❌ | ✅ | ✅ |
| **Session continuity** | ✅ `macs boot` | ❌ | ❌ | ❌ |
| **Dead agent recovery** | ✅ Auto-reap | ❌ | ❌ | ❌ |
| **Human oversight** | ✅ Built-in escalation | ❌ | Partial | Partial |
| **Any LLM / framework** | ✅ File-based | Depends | Partial | Partial |

> **MACS is complementary to A2A/MCP** — use MCP for agent-to-tool calls, A2A for cross-org agent communication, and MACS for coordinating the actual work.

## Key Features

**Event Sourcing** — Every action is an append-only event. No conflicts, full history, any state can be rebuilt.

```jsonl
{"spec_version":"4.1","type":"task_created","id":"T-001","ts":"...","by":"lead-opus","data":{"title":"Add auth"}}
{"spec_version":"4.1","type":"task_assigned","id":"T-001","ts":"...","by":"lead-opus","data":{"assignee":"engineer-sonnet"}}
{"spec_version":"4.1","type":"task_completed","id":"T-001","ts":"...","by":"engineer-sonnet","data":{"artifacts":["src/auth.ts"]}}
```

**Capability Routing** — Tasks declare `requires_capabilities`. Only capable agents can claim them.

```bash
macs create "Train embedding model" --requires ml,gpu
macs claim --agent ml-agent   # skips tasks it can't do
```

**Forced Handoff** — Blocking or cancelling a task requires `--next`. No context ever lost between sessions.

```bash
macs block T-007 --reason "need OAuth decision" \
  --next "wire JWT into middleware" \
  --done "schema designed" --issue "refresh token unspecified"
```

**Review Chain** — Agents can request peer review before marking done. Approved → completed. Rejected → back to in_progress.

```bash
macs review T-009 --agent lead-opus --result approved --note "LGTM"
```

**Escalation** — Blocked on a human decision? Escalate and optionally auto-resume after timeout.

```bash
macs escalate T-012 --reason "GDPR compliance sign-off needed" --to cto --timeout 60
```

**Dead Agent Reaping** — Silent agents are detected and their tasks reassigned automatically.

```bash
macs reap --threshold 45   # mark agents silent > 45 min as dead, reassign tasks
```

**Smart Drift Detection** — Identifies agents spinning in circles (same file edited 3+ times) or drifting off-goal.

**Swarm Orchestration** — `macs swarm` auto-distributes tasks across N agents in dependency-ordered rounds.

**Plugin System (v4)** — Drop a `.js` file in `.macs/plugins/` to hook into any lifecycle event. Slack, webhooks, custom triggers — zero config.

```js
export default {
  hooks: {
    onTaskCompleted: (task) => notifySlack(`✅ ${task.title} done`),
    onEscalation: (task) => page_oncall(task),
  }
}
```

**MCP Bridge (v4)** — Connect Claude Desktop directly to your MACS project. 14 MCP tools: create tasks, claim work, review, escalate — all from natural language.

**Skill Marketplace (v5.3)** — Install Claude Code skills directly from the community registry or any GitHub repo.

```bash
macs skill list                          # browse available skills
macs skill install knowledge-graph       # install from registry
macs skill install github:user/repo      # install any skill from GitHub
macs skill search graph                  # search by keyword
```

Skills install to `.claude/skills/` and are auto-loaded by Claude Code on next launch. Submit your skill to the registry via PR to [skills/registry.json](./skills/registry.json).

**Templates (v4)** — Bootstrap a full multi-agent project in one command.

```bash
macs template use saas-mvp      # 12 tasks, auth + API + dashboard + billing
macs template use data-pipeline # ingest → process → store
```

**CI/CD Integration (v4)** — Detect stale tasks, dead agents, and blocked work in your pipeline.

```bash
macs ci --stale-hours 24 --json   # exits 1 if project is unhealthy
```

**HTTP Transport API (v5)** — Run a lightweight server so cloud agents, CI runners, and containers can participate without filesystem access.

```bash
npx tsx .macs/transport/server.ts --project . --port 7474
# GET /macs/state  POST /macs/events/task  GET /macs/stream (SSE)
```

**Formal Protocol Spec (v4.1)** — [MACS-SPEC.md](./MACS-SPEC.md) defines the full protocol: event schema, state rebuild algorithm, agent lifecycle, and conformance requirements. Build your own conforming implementation.

**Human-Readable Output** — `human/` directory auto-generates Markdown from JSONL. You never lose readability.

## Platform Support

**MACS is framework-agnostic by design.** The protocol is just files — any agent that can read/write to disk (or HTTP) can participate.

| Platform | Integration | How it joins |
|----------|------------|-------------|
| **Claude Code** | Hooks + CLI | `macs install-hooks` — quality gates via PreToolUse/Stop hooks |
| **Codex (OpenAI)** | CLI + file-based | Reads `.macs/` state, writes events via CLI or directly |
| **Cursor** | Adapter | `.cursorrules` integration |
| **Devin / Windsurf** | File-based | Any agent that reads files → instant participant |
| **Aider / Continue** | Adapter | CLI commands in agent prompts |
| **LangChain / CrewAI / AutoGen** | Python SDK | `from macs import MACSClient` |
| **Remote / Cloud agents** | HTTP Transport | REST + SSE on port 7474 — no filesystem needed |

```bash
# One-line install, auto-detects your platform
./install.sh
```

### The 5-minute integration test

If your agent can do these 3 things, it works with MACS:

```bash
# 1. Read current state
cat .macs/protocol/state.json

# 2. Claim a task
macs claim T-001 --agent my-agent

# 3. Mark it done
macs done T-001 --summary "implemented auth endpoint"
```

That's it. No SDK required. No server required. Just files.

## Positioning

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Project                             │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│   │  Claude   │  │  Codex   │  │  Cursor  │  │  Devin   │ ...  │
│   │  Code     │  │          │  │          │  │          │      │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│        │              │              │              │            │
│        └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │    .macs/ (JSONL)  │                        │
│                    │                   │                        │
│                    │  Tasks · Events   │                        │
│                    │  State · Inbox    │                        │
│                    └───────────────────┘                        │
│                                                                 │
│   Any agent that reads/writes files → instant participant       │
└─────────────────────────────────────────────────────────────────┘

Communication Layer     Work Layer          Capability Layer
(how agents talk)      (how agents        (how agents evolve)
                        coordinate)
┌──────────────┐       ┌──────────┐       ┌──────────────┐
│ A2A (Google) │       │   MACS   │       │ EvoMap (GEP) │
│ MCP (Anthr.) │       │          │       │              │
│ ACP (IBM)    │       │          │       │              │
└──────────────┘       └──────────┘       └──────────────┘

Three layers, complementary, not competing.
```

## Roadmap

- [x] **v3.0** — JSONL Protocol, Event Sourcing, Agent SDK, inbox messaging, swarm, forced handoff, drift detection, task decomposition
- [x] **v3.1** — Capability routing, load balancing, review chain, escalation protocol, dead agent reaping
- [x] **v3.2** — Smart drift analysis (spin detection + goal deviation), Dashboard v2 (real-time SSE + D3 graph)
- [x] **v4.0** — Plugin system, MCP bridge (14 tools), template market, CI/CD integration (123 tests)
- [x] **v4.1** — Formal protocol spec (MACS-SPEC.md), `spec_version` in all events, agent `instance_id`/`session_id`
- [x] **v5.0** — HTTP Transport API (REST + SSE), per-agent event sharding, StorageBackend abstraction
- [x] **v5.1** — Easy mode CLI (`macs add`, auto-claim `macs start`), simplified help
- [x] **v5.2** — Superpowers plan import (`macs import-plan`), PACEflow hooks (`macs install-hooks`)
- [x] **v5.3** — Skill Marketplace (`macs skill install/list/search`), community registry

## License

MIT © 2026

---

## 中文

# MACS — AI Agent 的通用工作台

> Claude Code、Codex、Cursor、Devin、Windsurf——每个 agent 都有自己的地盘。
>
> **MACS 给它们一个共同的工作台。** 能读写文件就能加入，不需要服务器，只要 JSONL + Git。

## 问题

每个 AI 编程 agent 单独都很强。但它们没法一起干活：

```
Claude Code 在写后端    — 不知道 Cursor 正在改 API 设计
Codex 在审代码          — 不知道 Devin 已经部署了修复
Windsurf 在跑测试      — 不知道 schema 10 分钟前改了
→ 每个人都在干活。没人在协调。全崩了。
```

每个 agent 都有自己的内置任务系统（Claude Code 有 Agent Teams，Cursor 有 Composer）。但**它们看不到彼此在做什么。**

**A2A/MCP 解决 agent 怎么说话。MACS 解决 agent 怎么一起干活——不管它们跑在什么框架上。**

## 原理

```
.macs/
├── protocol/          ← Agent 读写这里（JSONL，快，无冲突）
│   ├── tasks.jsonl    # 任务生命周期事件（只追加）
│   ├── events.jsonl   # 所有变更、决策、冲突
│   ├── events/        # 每 agent 独立分片（events_sharding: true 时）
│   ├── state.json     # 当前状态快照（自动重建）
│   └── agents.json    # 谁在、能做什么
│
├── sync/inbox/        ← Agent 间通信
│   ├── agent-001/
│   └── agent-002/
│
├── transport/         ← HTTP Transport API（v5，云端 agent 用）
├── plugins/           ← 插件目录，自动加载
│
└── human/             ← 自动生成的 Markdown（给人看）
    ├── TASK.md
    └── CHANGELOG.md
```

**Agent 写 JSONL → 人读 Markdown。两全其美。**

## 快速开始

```bash
npx macs init
# 搞定。你的项目现在有 .macs/ 了
```

## 核心特性

- **Event Sourcing** — 每个操作都是只追加事件，无冲突，完整历史，任意状态可重建
- **能力路由** — 任务声明所需能力（`requires_capabilities`），只有匹配的 agent 能认领
- **负载均衡** — 自动均衡 agent 工作量，claimTask 上限可配（默认 3 任务/agent）
- **强制 handoff** — block/cancel 必须留下 `--next` 交接记录，上下文不丢
- **Review Chain** — 支持同行审查，approved → 完成，rejected → 返回修改
- **升级协议** — 遇到人类决策瓶颈时升级，支持超时自动恢复
- **死 Agent 重分配** — 心跳超时的 agent 自动标记为 dead，任务重新分配
- **智能漂移检测** — 识别"转圈"（同文件反复改）和"方向偏离"，自动触发介入
- **Swarm** — `macs swarm --agents N` 按依赖轮次自动分配任务
- **插件系统（v4）** — `.macs/plugins/*.js` 自动加载，7 个 hooks，零配置扩展
- **MCP 桥接（v4）** — 接 Claude Desktop，14 个 MCP tools，自然语言操作 MACS
- **模板市场（v4）** — `macs template use saas-mvp` 一键生成完整任务树
- **CI/CD（v4）** — `macs ci` 检测僵尸任务和死 agent，GitHub Actions 模板开箱即用
- **HTTP Transport API（v5）** — 云端 agent 无需访问文件系统即可参与协作（REST + SSE）
- **正式协议规范（v4.1）** — [MACS-SPEC.md](./MACS-SPEC.md)，任何人可实现合规的 MACS 引擎
- **Skill 市场（v5.3）** — `macs skill install <name>` 从社区注册表或 GitHub 直接安装 Claude Code skill
- **人类可读** — `human/` 目录自动从 JSONL 生成 Markdown

## Skill 市场

```bash
macs skill list                          # 浏览社区注册的 skills
macs skill install knowledge-graph       # 从注册表安装
macs skill install github:user/repo      # 从 GitHub 直接安装
macs skill search graph                  # 关键词搜索
```

安装后 skill 自动放入 `.claude/skills/`，重启 Claude Code 即可使用。想分享自己的 skill？向 [skills/registry.json](./skills/registry.json) 提 PR。

## 定位

```
┌─────────────────────────────────────────────────────┐
│                    你的项目                           │
│                                                     │
│   Claude Code  ·  Codex  ·  Cursor  ·  Devin  ...  │
│        │           │          │          │          │
│        └───────────┴──────────┴──────────┘          │
│                        │                            │
│              ┌─────────▼─────────┐                  │
│              │   .macs/ (JSONL)  │                  │
│              │  任务 · 事件 · 状态 │                  │
│              └───────────────────┘                  │
│                                                     │
│   能读写文件的 agent → 即刻参与协作                    │
└─────────────────────────────────────────────────────┘

通信层（怎么说话）    工作层（怎么协作）    能力层（怎么进化）
A2A (Google)         MACS（我们）         EvoMap (GEP)
MCP (Anthropic)
ACP (IBM)

三层互补，不竞争。
```

## 平台支持

**MACS 是框架无关的。** 协议就是文件——能读写磁盘（或 HTTP）的 agent 都能参与。

| 平台 | 集成方式 |
|------|---------|
| **Claude Code** | Hooks + CLI |
| **Codex (OpenAI)** | CLI + 文件读写 |
| **Cursor** | `.cursorrules` 集成 |
| **Devin / Windsurf** | 文件读写即可 |
| **LangChain / CrewAI** | Python SDK |
| **云端 Agent** | HTTP Transport API |

```bash
./install.sh  # 一键安装，自动检测平台
```

## 开源协议

MIT © 2026
