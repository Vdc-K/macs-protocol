# MACS Agent Guide

> This file is injected into your context at the start of each session.
> It tells you how to collaborate with other agents on this project.

---

## Your Identity

When you start a session, first register yourself:

```bash
macs register <your-id> --capabilities <comma-separated> --model <model-name>
# Example:
macs register engineer-sonnet --capabilities backend,testing --model sonnet
```

---

## Your Workflow

Every session follows this loop:

### 1. Check your inbox
```bash
macs inbox <your-id> --unread
```
Read any messages from other agents. If blocked tasks are now unblocked, act on them.

### 2. Check available tasks
```bash
macs status
```
Look for tasks with `status: pending` and no unresolved dependencies.

### 3. Claim a task
```bash
macs claim --agent <your-id>          # auto-claim best match
macs claim T-001 --agent <your-id>    # claim specific task
```
**Important**: Never start working on a task without claiming it first. This prevents two agents doing the same work.

### 4. Start the task
```bash
macs start T-001 --agent <your-id>
```

### 5. Acquire file locks before editing
```bash
# Before editing a file:
macs lock src/api/users.ts --agent <your-id> --reason "Updating user model"

# After done:
macs unlock src/api/users.ts --agent <your-id>
```
If a lock fails (file already locked), wait or message the locking agent.

### 6. Complete the task
```bash
macs done T-001 --agent <your-id> \
  --summary "Implemented JWT auth with Google OAuth" \
  --artifacts "src/auth/jwt.ts,src/auth/google.ts"
```

---

## When You're Blocked

If you need a decision or are stuck:

```bash
macs block T-001 --agent <your-id> \
  --reason "Need to decide: PostgreSQL vs MySQL?" \
  --escalate lead-opus
```

Then send a message to the escalation target:
```bash
macs send <your-id> lead-opus \
  "T-001 blocked: need DB choice. Options: PostgreSQL (better JSON) vs MySQL (team familiarity). Recommend PostgreSQL." \
  --re T-001
```

---

## When You Change Something Important

### File modification (always record):
```bash
macs record-file src/api/users.ts "+50 -10" \
  --agent <your-id> \
  --purpose "Add email field to user model" \
  --task T-001
```

### Breaking change (always notify):
```bash
macs breaking src/api/users.ts \
  --description "User model: added required email field" \
  --migration "Run: ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL" \
  --agent <your-id> \
  --task T-001
```
This automatically notifies all affected agents.

### Decision made:
```bash
macs decision \
  --question "Database choice" \
  --decision "PostgreSQL" \
  --rationale "Better JSON support, team knows it" \
  --agent <your-id> \
  --task T-001
```

---

## Rules

1. **Always claim before working** — no unclaimed work
2. **Always lock before editing shared files** — no concurrent edits
3. **Always record breaking changes** — other agents depend on this
4. **Complete tasks even with minor issues** — note in summary, don't leave hanging
5. **Check inbox every session start** — messages may unblock your work
6. **Never edit `.macs/protocol/state.json` directly** — it's auto-generated

---

## Quick Reference

```bash
macs status                          # What's happening
macs inbox <id> --unread             # New messages
macs claim --agent <id>              # Get next task
macs start T-001 --agent <id>        # Begin task
macs done T-001 --agent <id>         # Finish task
macs block T-001 --reason "..."      # Can't proceed
macs impact src/foo.ts               # What does this affect?
macs log --limit 20                  # Recent events
macs generate                        # Refresh human/ Markdown
```

---

## Files You Should Know

```
.macs/
├── protocol/
│   ├── tasks.jsonl      ← Task lifecycle events (append-only, don't edit)
│   ├── events.jsonl     ← All events (append-only, don't edit)
│   ├── state.json       ← Current state snapshot (auto-generated, read-only)
│   └── agents.json      ← Agent registry (auto-generated)
│
├── sync/inbox/<your-id>/
│   └── messages.jsonl   ← Your messages
│
└── human/               ← Auto-generated Markdown, for humans to read
    ├── TASK.md
    ├── CHANGELOG.md
    └── STATUS.md
```

**Never write to `protocol/*.jsonl` directly. Always use `macs` CLI or the SDK.**
