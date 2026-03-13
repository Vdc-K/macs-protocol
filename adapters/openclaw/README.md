# MACS × OpenClaw

> OpenClaw is a session-based AI coding agent. MACS gives it persistent memory, task coordination, and zero-conflict multi-agent collaboration.

---

## How It Works

OpenClaw sessions are ephemeral — each session starts fresh. MACS solves this by:

1. **`macs boot`** — one command that replaces 5 manual steps (register → inbox → status → claim → start)
2. **Forced handoff** — when a session ends mid-task, the next agent gets structured context
3. **Drift detection** — silent agents are automatically flagged after N minutes
4. **`macs swarm`** — launch N agents, auto-distribute all tasks, watch them complete in parallel

---

## Setup (2 steps)

### Step 1 — Initialize MACS in your project

```bash
cd your-project
macs init
```

### Step 2 — Inject MACS context into your OpenClaw config

Add the contents of `macs-context.md` to your project's `CLAUDE.md` (or equivalent agent config file):

```bash
cat adapters/openclaw/macs-context.md >> CLAUDE.md
```

That's it. Every OpenClaw session in this project will now follow the MACS protocol automatically.

---

## Single Agent Workflow

```bash
# Session start — one command does everything
macs boot --agent opus-lead --capabilities architect,planner --model opus

# OpenClaw reads the output and knows:
#   - Which task to work on
#   - Previous agent's handoff note
#   - Goal chain (if subtask)
#   - Any breaking changes since last session
```

OpenClaw then works on the task. When done:

```bash
macs done T-003 --agent opus-lead \
  --summary "Implemented JWT auth with refresh tokens" \
  --artifacts "src/auth/jwt.ts,src/auth/refresh.ts"
```

If blocked mid-session:

```bash
macs block T-003 --agent opus-lead \
  --reason "need Redis decision" \
  --next "wire Redis for token blacklist, see src/auth/jwt.ts:42" \
  --done "JWT generation + validation complete" \
  --issue "token blacklist not implemented yet" \
  --question "should we use Redis or in-memory store for blacklist"
```

---

## Multi-Agent Swarm

### Simulation (Demo / CI)

See all agents complete all tasks automatically — great for demos and testing:

```bash
# 4 auto-named agents
macs swarm --agents 4 --simulate

# Named agents with capabilities
macs swarm --agents "opus:architect,planner|sonnet1:backend,api|sonnet2:frontend,ui|haiku:testing,docs" --simulate

# Speed it up
macs swarm --agents 4 --simulate --delay 200
```

Output:
```
🐝 MACS Swarm — 4 agent(s) [simulate]
──────────────────────────────────────────────────
  🤖 swarm-1
  🤖 swarm-2
  🤖 swarm-3
  🤖 swarm-4

Project: 8 tasks | 0 done | 8 pending | 0 in-progress

Simulating task execution (800ms per round)...

▶ Round 1
  🔄 swarm-1         → T-001: Schema design [critical]
  🔄 swarm-2         → T-002: Auth service [high]
  🔄 swarm-3         → T-003: Frontend scaffold [high]
  🔄 swarm-4         → T-004: Test setup [medium]
  ✅ swarm-1         ← T-001 done
  ...

🏁 Swarm simulation complete!
   8/8 tasks done | 2 round(s) | 4 agent(s)
```

### Real Mode (actual OpenClaw instances)

```bash
# Assign tasks to agents, then launch each with macs boot
macs swarm --agents "opus:architect|sonnet1:backend|sonnet2:frontend|haiku:qa"

# Output:
#   opus          → T-001: Schema design [critical]
#   sonnet1       → T-002: Auth service [high]
#   sonnet2       → T-003: Frontend scaffold [high]
#   haiku         → T-004: Test setup [medium]
#
#   ▶ Start each agent session:
#   macs boot --agent opus
#   macs boot --agent sonnet1
#   macs boot --agent sonnet2
#   macs boot --agent haiku
```

Then use the included `swarm.sh` to launch all sessions with tmux:

```bash
./adapters/openclaw/swarm.sh --agents "opus:architect|sonnet1:backend|sonnet2:frontend|haiku:qa"
```

---

## Drift Detection

Sessions can go silent (agent crashed, distracted, etc.). Check and respond:

```bash
# Check for silent agents (default: 30 min threshold)
macs drift

# Custom threshold
macs drift --threshold 15

# Output:
#   🟡 T-003 Build login page [suspected] — silent 32 min
#      owner: sonnet2-frontend
#      last checkpoint: 32 minutes ago
#   ⚠ Consider: macs block T-003 --reason "drift" --next "investigate or reassign"
```

During long tasks, agents should checkpoint regularly:

```bash
macs checkpoint T-003 --agent sonnet2 --note "✓ form layout done → wire API calls" --progress 0.6
```

---

## Task Decomposition

Break large tasks into parallel subtasks:

```bash
macs decompose T-001 --into "Schema: users table,Schema: posts table,Schema: indexes" \
  --agent opus-lead \
  --rationale "parallelizable — no shared state"

# Parent auto-completes when all subtasks done
# Each subtask inherits goal_chain context
```

---

## Context Injection Details

The `macs-context.md` template adds a `## MACS Protocol` section to your `CLAUDE.md`. This teaches OpenClaw to:

- Call `macs boot` at session start (mandatory)
- Call `macs checkpoint` every ~30 min
- Use the `✓ → ⚠ ?` handoff format on block/cancel
- Never start work without claiming a task

The injection is **minimal by design** — MACS state files do the heavy lifting:
- `.macs/human/STATUS.md` — current project state (auto-generated)
- `macs boot` output — personalized context for each agent

---

## Tips

- **One `CLAUDE.md` section** — the MACS block is self-contained, won't conflict with your existing rules
- **`macs boot` is the entry point** — don't teach OpenClaw the full protocol, just `macs boot`
- **Handoff notes are gold** — the `✓ → ⚠ ?` format gives the next agent everything they need in ~4 lines
- **Simulate before recording** — use `--simulate` to verify the task graph resolves cleanly before running real agents
