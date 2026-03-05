---
name: macs
description: MACS Protocol v3.1 — Git for AI Agents. Multi-agent work coordination via JSONL Event Sourcing. Capability routing, review chain, escalation, dead agent reaping.
author: MACS Community
version: 3.1.0
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
        - git
---

# MACS — Multi-Agent Coordination System

> **For Claude Code**
> MACS keeps multiple AI agents in sync on the same project.
> A2A solves how agents talk. MACS solves how agents work together without chaos.

---

## Commands

### `/macs init [name]`
Initialize MACS in the current project.
```bash
macs init my-project
```
Creates `.macs/protocol/`, `.macs/sync/inbox/`, `.macs/human/`.

---

### `/macs status`
Show current project status: tasks, agents, locks.

---

### `/macs register`
Register yourself as an agent.
```bash
macs register claude-sonnet --capabilities backend,testing --model sonnet
```

---

### `/macs claim [task-id]`
Claim a task. Auto-claims best available if no ID given.
```bash
macs claim                                  # auto
macs claim T-001 --agent claude-sonnet      # explicit
```

---

### `/macs start <task-id>`
Mark a task as started.

---

### `/macs done <task-id>`
Complete a task.
```bash
macs done T-001 --summary "Done" --artifacts "src/auth.ts,tests/auth.test.ts"
```

---

### `/macs block <task-id>`
Block a task with reason, optionally escalate.
```bash
macs block T-001 --reason "Need DB choice: PG vs MySQL" --escalate lead-opus
```

---

### `/macs unblock <task-id>`
Unblock a task.
```bash
macs unblock T-001 --decision "Use PostgreSQL"
```

---

### `/macs create <title>`
Create a new task.
```bash
macs create "Add user auth" --priority high --tags auth,backend --depends T-001
```

---

### `/macs impact <file>`
Analyze what changing a file would affect.
```bash
macs impact src/api/users.ts
```

---

### `/macs log`
View recent events (like `git log`).
```bash
macs log --limit 20
```

---

### `/macs inbox <agent-id>`
Check agent inbox.
```bash
macs inbox claude-sonnet --unread
```

---

### `/macs send <from> <to> <message>`
Send a message to another agent.
```bash
macs send claude-sonnet lead-opus "T-001 blocked, need decision on DB" --re T-001
```

---

### `/macs generate`
Regenerate `human/` Markdown from JSONL state.

---

## Typical Agent Session

When starting a session on a MACS project, follow AGENT-GUIDE.md:

```
1. macs register <id> --capabilities ...
2. macs inbox <id> --unread
3. macs status
4. macs claim --agent <id>
5. macs start <task-id>
6. [do the work]
7. macs done <task-id> --artifacts "..."
8. macs generate
```

---

## File Layout

```
.macs/
├── protocol/
│   ├── tasks.jsonl      ← Task events (append-only)
│   ├── events.jsonl     ← Global events (append-only)
│   ├── state.json       ← Current state (auto-rebuilt)
│   └── agents.json      ← Agent registry
├── sync/inbox/<id>/     ← Per-agent mailboxes
└── human/               ← Auto-generated Markdown
    ├── TASK.md
    ├── CHANGELOG.md
    └── STATUS.md
```

Never edit `protocol/*.jsonl` or `state.json` directly.
Always use `macs` CLI or `@macs/protocol` SDK.

---

## For SDK users (TypeScript)

```typescript
import { createAgent } from '@macs/protocol'

const agent = createAgent({
  id: 'engineer-sonnet',
  capabilities: ['backend', 'testing'],
})

await agent.loop({
  onTask: async (task) => {
    // do the work
    return { artifacts: ['src/feature.ts'], summary: 'Implemented feature' }
  },
  onMessage: async (msg) => {
    console.log(`Message from ${msg.from}: ${msg.data.content}`)
  },
})
```

## For Python users

See `adapters/python/pymacs.py`.

---

See [README.md](README.md) | [AGENT-GUIDE.md](AGENT-GUIDE.md) | [ROADMAP.md](ROADMAP.md)
