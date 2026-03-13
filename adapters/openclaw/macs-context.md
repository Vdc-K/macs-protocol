---

## MACS Protocol v3.0 — Multi-Agent Coordination

> This project uses MACS. Follow the rules below to coordinate with other agents.

### Session Start (MANDATORY — run this first)

```bash
macs boot --agent <your-id> --capabilities <comma-separated> [--model <model>]
```

Examples:
```bash
macs boot --agent opus-lead --capabilities architect,planner --model opus
macs boot --agent sonnet-backend --capabilities backend,api --model sonnet
macs boot --agent haiku-qa --capabilities testing,docs --model haiku
```

This single command:
- Registers you (if new)
- Shows your inbox (unread messages from other agents)
- Shows what changed since your last session (breaking changes, unblocked tasks)
- Recommends your next task + shows previous agent's handoff note

**Do not start any work until you have run `macs boot`.**

---

### Task Lifecycle

```bash
# Claim (auto-picks highest priority unblocked task):
macs claim --agent <your-id>

# Or claim a specific task:
macs claim T-003 --agent <your-id>

# Start working:
macs start T-003 --agent <your-id>

# Checkpoint every ~30 min (prevents drift alerts):
macs checkpoint T-003 --agent <your-id> --note "✓ routes done → wire auth middleware" --progress 0.6

# Complete with artifacts:
macs done T-003 --agent <your-id> \
  --summary "one-line summary" \
  --artifacts "src/auth/jwt.ts,src/auth/middleware.ts"
```

---

### When Blocked (handoff REQUIRED)

You **must** provide `--next` when blocking. No exceptions.

```bash
macs block T-003 --agent <your-id> \
  --reason "need Redis vs in-memory decision" \
  --next "implement token blacklist once storage decision is made" \
  --done "JWT generation + validation complete" \
  --issue "blacklist not implemented — tokens can't be invalidated" \
  --question "should blacklist use Redis or in-memory (see T-001 decision log)"
```

Handoff symbols:
- `✓` — what you completed
- `→` — what the next agent must do (**required**)
- `⚠` — known problems or risks
- `?` — open questions (tag the decision-maker if known)

---

### File Conflicts

Before editing a file others might touch:

```bash
macs lock src/api/users.ts --agent <your-id> --reason "refactoring user model"
# ... edit the file ...
macs unlock src/api/users.ts --agent <your-id>
```

After a major structural change:

```bash
macs impact src/auth/jwt.ts   # see which tasks/agents are affected
```

---

### Project State

```bash
macs status          # full project overview (tasks, agents, locks, drift)
macs drift           # show agents that have gone silent
macs log --limit 20  # recent event stream
```

---

### Rules

1. **Never** start work without running `macs boot` or explicitly claiming a task
2. **Never** block a task without `--next` (the handoff note is the contract)
3. **Never** edit files claimed by another agent without messaging them first
4. **Always** call `macs done` at the end of your session (even if partial — use checkpoint instead if continuing later)
