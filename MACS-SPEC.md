# MACS Protocol Specification v5.0

> **Status**: Active
> **Version**: 5.0
> **Supersedes**: v4.1

---

## 1. Overview

MACS (Multi-Agent Collaboration System) is a **work coordination protocol** for AI agent teams. It defines how agents share task state, claim work, and hand off context — without requiring a central server or real-time communication.

**Design goals:**
- Append-only, conflict-free event log (no merge conflicts)
- Any agent can reconstruct full project state from events alone
- Zero-cost agent-to-agent communication (read files)
- Agents are session-based, not persistent processes

**Out of scope:**
- Agent communication protocols (see A2A, MCP)
- Agent reasoning, tool calling, or intelligence
- Workflow orchestration engines

---

## 2. Concepts

### 2.1 Event Sourcing

All state changes are recorded as immutable events appended to JSONL files. State is a derived projection:

```
events (append-only) → rebuildState() → state.json (snapshot)
```

- **Never modify or delete events**
- State must be reproducible from events alone
- `state.json` is a cache — it can always be regenerated

### 2.2 Agent

An agent is a session-based process that registers, claims tasks, executes, and heartbeats. It is identified by:

| Field | Description |
|-------|-------------|
| `agent_id` | Logical identity (e.g. `eng-sonnet`) — stable across restarts |
| `instance_id` | Per-launch ID (auto-generated) — changes on every restart |
| `session_id` | Optional group ID linking multiple logical agents |

An agent is considered **dead** if its `last_heartbeat` exceeds the configured `offline_threshold_ms`.

### 2.3 Task Lifecycle

```
pending → assigned → in_progress → review_required → completed
                  ↓                       ↓
               blocked               rejected → in_progress
                  ↓
            pending_human (escalated)
                  ↓
            cancelled
                  ↓
        waiting_for_subtasks (decomposed)
```

State transitions are valid only via the corresponding events. Attempting to complete a task that is `blocked` or `pending_human` is invalid.

### 2.4 Dependency Resolution

A task is **claimable** only when all tasks in its `depends` array have status `completed`. The engine enforces this in `claimTask()`.

---

## 3. File Layout

```
{project}/
└── .macs/
    ├── protocol/
    │   ├── tasks.jsonl      # Task event log (append-only)
    │   ├── events.jsonl     # Global event log (append-only)
    │   ├── state.json       # Rebuilt state snapshot
    │   └── agents.json      # Agent registry (legacy, superseded by state.json)
    ├── sync/
    │   └── inbox/
    │       └── {agent-id}/  # Per-agent message queue (JSONL files)
    ├── human/
    │   ├── TASK.md          # Auto-generated human-readable task board
    │   ├── STATUS.md        # Auto-generated current status
    │   └── CHANGELOG.md     # Auto-generated change log
    ├── plugins/
    │   └── *.js             # Auto-loaded plugin hooks
    └── macs.json            # Project config
```

**v5+ extension**: When `events_sharding: true`, global events are written to `protocol/events/{agent-id}.jsonl` instead of a single `events.jsonl`.

---

## 4. Event Schema

### 4.1 Common Fields

Every event MUST include:

| Field | Type | Description |
|-------|------|-------------|
| `spec_version` | `string` | Protocol version that wrote this event (e.g. `"4.1"`) |
| `type` | `string` | Event type identifier |
| `ts` | `string` | ISO 8601 timestamp |
| `by` | `string` | Agent ID that triggered the event |
| `seq` | `number` | Auto-incremented global sequence number |

Task events additionally include `id` (task ID).

### 4.2 Task Events (`tasks.jsonl`)

| Event Type | Trigger |
|------------|---------|
| `task_created` | New task added |
| `task_assigned` | Task assigned to an agent |
| `task_unassigned` | Assignment removed |
| `task_started` | Agent begins work |
| `task_blocked` | Agent cannot proceed |
| `task_unblocked` | Block resolved |
| `task_completed` | Work done, artifacts listed |
| `task_cancelled` | Task abandoned with handoff note |
| `task_priority_changed` | Priority updated |
| `task_updated` | Generic field update |
| `task_decomposed` | Task split into subtasks |
| `task_checkpoint` | Progress snapshot |
| `task_review_requested` | Peer review required |
| `task_reviewed` | Reviewer approved or rejected |
| `task_escalated` | Escalated to human |

### 4.3 Global Events (`events.jsonl`)

| Event Type | Trigger |
|------------|---------|
| `file_modified` | Agent modified a file |
| `decision_made` | Key decision recorded |
| `conflict_detected` | File write conflict |
| `conflict_resolved` | Conflict resolution |
| `test_passed` | Test suite passed |
| `test_failed` | Test suite failed |
| `agent_registered` | Agent joined the project |
| `agent_heartbeat` | Agent status update |
| `agent_offline` | Agent went offline gracefully |
| `agent_dead` | Agent declared dead (heartbeat timeout) |
| `lock_acquired` | File lock taken |
| `lock_released` | File lock released |
| `breaking_change` | Breaking API/interface change |

---

## 5. State Rebuild Algorithm

`rebuildState()` processes all events in `seq` order to produce `state.json`.

### 5.1 Task State Reconstruction

For each task, events are applied in sequence:

```
task_created       → create TaskState with status=pending
task_assigned      → assignee = event.data.assignee, status=assigned
task_unassigned    → assignee = null, status=pending
task_started       → status=in_progress, started_at=ts
task_blocked       → status=blocked, push to blocked_history
task_unblocked     → status=in_progress, update last blocked_history entry
task_completed     → status=completed, completed_at, artifacts, actual_ms
task_cancelled     → status=cancelled, cancelled_at, handoff_note
task_priority_changed → priority updated
task_updated       → field updated by name
task_decomposed    → subtasks recorded, status=waiting_for_subtasks
task_checkpoint    → last_checkpoint_at updated
task_review_requested → status=review_required, reviewer hint
task_reviewed(approve) → status=completed
task_reviewed(reject)  → status=in_progress (returned for rework)
task_escalated     → status=pending_human, escalation fields set
```

Auto-transitions:
- When all subtasks of a decomposed task reach `completed`, parent → `completed`

### 5.2 Agent State Reconstruction

```
agent_registered   → create AgentState{idle}, set instance_id/session_id
agent_heartbeat    → update status, current_task, last_heartbeat
agent_offline      → status=offline
agent_dead         → status=dead, affected tasks → pending
```

### 5.3 Metrics

Metrics are derived from task statuses at rebuild time — they are never stored as events.

### 5.4 Determinism Guarantee

Given the same sequence of events, any conforming implementation MUST produce identical state. Implementations MUST NOT introduce randomness or time-dependent logic into `rebuildState()`.

---

## 6. Concurrency Model

MACS uses **optimistic append-only concurrency**:

1. **File-level locks** prevent simultaneous writes to the same file
2. **JSONL append** is atomic at the OS level for single-line writes
3. **Last-write-wins** for conflicting file modifications (detected via `conflict_detected` event)
4. **No distributed locking required** — all coordination is via the event log

For systems with >50 concurrent agents, **event sharding** (v5) distributes writes across per-agent files, eliminating the single-file write bottleneck.

---

## 7. Agent Identity and Lifecycle

### 7.1 Registration

An agent MUST register before claiming tasks:

```jsonl
{"spec_version":"4.1","type":"agent_registered","ts":"...","by":"eng-1","seq":1,"data":{"agent_id":"eng-1","instance_id":"eng-1-1741234567890","capabilities":["backend","testing"]}}
```

### 7.2 Heartbeat

Agents SHOULD heartbeat every `heartbeat_interval_ms` (default: 300s). A missed heartbeat beyond `offline_threshold_ms` (default: 900s) triggers `agent_dead`.

### 7.3 Crash Recovery

When an agent restarts:
1. Re-register with the same `agent_id` but a new `instance_id`
2. Check inbox for pending messages
3. Check for any `in_progress` tasks previously owned — decide to continue or release

---

## 8. Handoff Protocol

When a task is blocked or cancelled, the agent MUST provide a handoff note:

```
✓ done: [what was completed]
→ next: [what the next agent should do]
⚠ issues: [known problems]
? questions: [unresolved decisions]
```

This note is stored in `task.handoff_note` and displayed by `macs boot` to the incoming agent.

---

## 9. Configuration

`.macs/macs.json` controls engine behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| `heartbeat_interval_ms` | 300000 | How often agents should heartbeat |
| `offline_threshold_ms` | 900000 | Silence before agent is offline |
| `auto_reassign_on_offline` | true | Auto-reassign tasks from dead agents |
| `lock_timeout_ms` | 600000 | Max time to hold a file lock |
| `generate_human_readable` | true | Auto-generate `human/` markdown |
| `conflict_resolution` | `last_write_wins` | How to resolve file conflicts |
| `max_concurrent_tasks_per_agent` | 3 | Load balancing cap |

---

## 10. Versioning and Compatibility

- `spec_version` in every event identifies the writer's protocol version
- Readers MUST handle events with unknown or missing `spec_version` gracefully (treat as `"3.0"`)
- New event fields are always optional and additive
- New event types added in minor versions are ignored by older implementations
- Breaking changes require a major version bump

### Version History

| Version | Changes |
|---------|---------|
| `3.0` | Initial JSONL Event Sourcing protocol |
| `4.0` | Plugin system, MCP bridge, CI/CD, templates |
| `4.1` | `spec_version` in events, `instance_id`/`session_id` in agents, formal spec |
| `5.0` | HTTP Transport API (REST + SSE), per-agent event sharding, `StorageBackend` abstraction |

---

## 11. Conformance

A conforming MACS implementation MUST:

1. Write `spec_version` on every event
2. Store events in append-only JSONL format
3. Produce identical state from identical event sequences (determinism)
4. Enforce task dependency resolution before allowing claims
5. Enforce `max_concurrent_tasks_per_agent` on `claimTask()`
6. Implement heartbeat monitoring and `agent_dead` detection
7. Write handoff notes on `task_blocked` and `task_cancelled`

A conforming implementation MAY:
- Use alternative storage backends (HTTP, Redis, etc.) as long as event ordering is preserved
- Shard events per-agent for performance
- Add additional event types in a backward-compatible way
