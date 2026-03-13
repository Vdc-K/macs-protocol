# Changelog

All notable changes to MACS are documented here.

---

## 2026-03-13

### v5.1.0 — Easy Mode

- [✨ feat] **`macs add <title>`**: alias for `macs create`, friendlier entry point for new users
- [✨ feat] **`macs start` (no args)**: auto-claims the first available task — no task ID needed
- [✨ feat] **Simple help by default**: `macs help` shows a 5-command quickstart; `macs help --pro` shows all 27 commands

---

## 2026-03-06

### v5.0.0 — Distributed Ready

- [✨ feat] **HTTP Transport API**: REST + SSE server (port 7474) for cloud/CI agents without filesystem access
- [✨ feat] **StorageBackend abstraction**: swap filesystem for Redis, HTTP, or custom backends
- [✨ feat] **Per-agent event sharding**: `events_sharding: true` distributes writes to `protocol/events/{agent-id}.jsonl`, eliminates single-file bottleneck at 50+ concurrent agents
- [✨ feat] **Formal Protocol Spec**: `MACS-SPEC.md` — event schema, state rebuild algorithm, agent lifecycle, conformance requirements (v4.1)
- [✨ feat] **`spec_version` in all events**: every event now carries the protocol version that wrote it
- [✨ feat] **Agent `instance_id` + `session_id`**: stable logical identity (`agent_id`) separate from per-launch ID
- [✨ feat] v4 CLI commands: `macs review`, `macs escalate`, `macs reap`, `macs smart-drift`, `macs workload`, `macs decompose`, `macs checkpoint`
- [✨ feat] Platform adapters: Cursor, Aider, OpenClaw, Ollama, MCP, plugins
- [✨ feat] GitHub Actions templates for CI/CD integration

---

## 2026-03-05

### v3.2 — Phase 3: Smart Coordination

- [✨ feat] **Smart drift analysis**: spin detection (same file edited 3+ times) + goal deviation scoring
- [✨ feat] **Load balancing**: `max_concurrent_tasks_per_agent` enforced on `claimTask()`; `macs workload` shows distribution
- [✨ feat] **Dashboard v2**: real-time SSE push + D3.js force graph for agent/task relationships
- [✨ feat] Animated SVG terminal demo

---

## 2026-03-04

### v3.1 — Capability Routing & Self-Governance

- [✨ feat] **Capability routing**: tasks declare `requires_capabilities`, only matching agents can claim
- [✨ feat] **Review chain**: `macs review --result approve|reject` — rejected tasks return to `in_progress`
- [✨ feat] **Escalation protocol**: `macs escalate` — blocked on human decision with optional auto-resume timeout
- [✨ feat] **Dead agent reaping**: `macs reap` — heartbeat timeout → `agent_dead` → tasks auto-reassigned
- [🐛 fix] bin path and repository URL in package.json

---

## 2026-03-02

### v3.0 — JSONL Event Sourcing (Protocol Rewrite)

Core architecture rewrite: Markdown documents → JSONL append-only event log.

- [✨ feat] **Event Sourcing**: all state changes are immutable JSONL events; `state.json` is a derived snapshot
- [✨ feat] **Agent SDK**: `registerAgent`, `claimTask`, `startTask`, `completeTask`, `blockTask`, `cancelTask`
- [✨ feat] **Inbox messaging**: per-agent JSONL message queues at `sync/inbox/{agent-id}/`
- [✨ feat] **`macs boot`**: session start — register → check inbox → show status → recommend next task
- [✨ feat] **Forced handoff**: `block`/`cancel` require `--next` note; context never lost between sessions
- [✨ feat] **Swarm orchestration**: `macs swarm` auto-distributes tasks across N agents in dependency-ordered rounds
- [✨ feat] **Task decomposition**: `macs decompose` splits a task into subtasks; parent auto-completes when all children done
- [✨ feat] **Dependency resolution**: `claimTask()` enforces that all `depends` tasks are `completed` first
- [✨ feat] **Drift detection**: `macs drift` surfaces tasks with no heartbeat activity
- [✨ feat] **Human-readable output**: `human/` directory auto-generates Markdown from JSONL for human review
- [✨ feat] **Plugin system v4**: drop `.js` in `.macs/plugins/` to hook any lifecycle event (Slack, webhooks, etc.)
- [✨ feat] **MCP bridge**: 14 MCP tools — connect Claude Desktop to your MACS project via natural language
- [✨ feat] **Template market**: `macs template use saas-mvp` — bootstrap full multi-agent task trees in one command
- [✨ feat] **CI/CD integration**: `macs ci` — detect stale tasks, dead agents, blocked work; exits 1 if unhealthy

---

## 2026-02-28

### v2.3 Technical Upgrade 🚀
- [✨ feat] **Markdown AST Indexer**: 98% token reduction via structured querying - by sonnet #dev #perf
- [✨ feat] **Dashboard**: Visual analytics for multi-agent collaboration - by sonnet #dev #ui
- [✨ feat] Query Engine API: queryChangelog/queryTasks/queryContext - by sonnet #dev
- [✨ feat] Token savings stats: real-time cost estimation - by sonnet #dev
- [🔧 config] CLI tool `macs`: index/stats/query/dashboard/init commands - by sonnet #ops
- [📝 docs] TECHNICAL-FEATURES.md: architecture & implementation details - by sonnet #docs
- [🐛 fix] Cross-platform package.json (ESM support) - by sonnet #dev

**Key Metrics**:
- Token usage: 3450 → 45 tokens per query (98.7% reduction)
- Cost savings: $26,460 over 12 weeks (Opus, 100 queries/day)
- Dashboard startup: <3 seconds
- Index generation: <1 second for 1000-line docs

**Tech Stack**:
- Markdown AST: unified + remark + unist-util-visit
- Dashboard: Node HTTP + D3.js + vanilla JS
- TypeScript: strict mode, ESM modules

---

## 2026-02-14

### v2.0 Initial Release
- [✨ feat] MACS v2 refactor: model-tiered cowork + document-driven sync - by sonnet #design
- [✨ feat] WEEKLY-REPORT.md template with pattern discovery section - by sonnet #skill
- [🐛 fix] init.sh sed cross-platform compatibility (macOS/Linux) - by sonnet #dev
- [🐛 fix] CHANGELOG template with initial entry placeholder - by sonnet #dev
- [🐛 fix] Remove incorrect `brew install qmd` from BEST-PRACTICES - by sonnet #docs
- [📝 docs] Complete README + SKILL.md + BEST-PRACTICES - by sonnet #docs

### v2.1 Universal & Bilingual
- [♻️ refactor] Platform-agnostic design (works with any multi-agent system) - by sonnet #design
- [📝 docs] Bilingual documentation (English/Chinese) for user-facing files - by sonnet #docs
- [📝 docs] Platform support list (Claude Code/Cursor/OpenAI/LangChain/OpenClaw) - by sonnet #docs
- [♻️ refactor] Templates pure English (agent-facing, token-efficient) - by sonnet #design

### v2.2 Self-Governing Agents & Enterprise Ready
- [✨ feat] Escalation Protocol: Engineers can block tasks and escalate to Lead - by sonnet #design
- [✨ feat] Escalations section in TASK.md (priority queue for blocked tasks) - by sonnet #dev
- [📝 docs] EVENT-TRIGGERS.md: Guide for auto-triggering weekly maintenance - by sonnet #docs
- [🔧 config] Integration examples for cron/GitHub Actions/mycc scheduler - by sonnet #ops
- [📝 docs] #escalation tag for blocked tasks in CHANGELOG - by sonnet #docs
- [📝 docs] SKILL-CAPSULES.md: EvoMAP-inspired skill packaging with environment fingerprint - by sonnet #docs
- [📝 docs] ENTERPRISE-TEAMS.md: Multi-agent team coordination architecture - by sonnet #docs
- [📝 docs] QUICKSTART.md: 5-minute getting started guide - by sonnet #docs
- [📝 docs] FAQ.md: Comprehensive Q&A - by sonnet #docs
- [📝 docs] CONTRIBUTING.md: Contribution guidelines - by sonnet #docs
- [🔧 config] LICENSE: MIT license added - by sonnet #config
- [🔧 config] .gitignore + GitHub templates - by sonnet #config
- [📝 docs] Simple project example added - by sonnet #docs
