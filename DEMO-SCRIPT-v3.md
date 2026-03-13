# MACS Protocol v3.0 — Demo Script

> Recording guide: "Git for AI Agents — 5 agents, 12 tasks, zero conflicts"
> Target length: 3–4 minutes

---

## Setup (before recording)

```bash
# Install MACS
npm install -g macs-protocol

# One-time: run setup to create demo project
./demo/setup.sh

# Verify everything works
./demo/run.sh --fast
```

---

## Recording Flow

### 0. Title card (5s)

Show terminal with large text or a simple title slide:
```
MACS Protocol v3.0
"Git for AI Agents"
```

---

### 1. The Problem (30s)

**Type slowly:**
```bash
# Multi-agent project — 5 agents, all trying to write to the same repo
# Usual result:
git status
```

**Show a messy git conflict (or describe)**:

**Narration**:
> "Every time you run multiple AI agents on the same project, you get this. Merge conflicts. Agents overwriting each other's work. No one knows who did what or why.
>
> MACS fixes this."

---

### 2. Init (20s)

```bash
cd /tmp/my-project
macs init "Claw SaaS Starter"
```

**Narration**:
> "One command. MACS creates an append-only event store — think Git, but for agent coordination."

---

### 3. Create Tasks (30s)

Run the setup script (or show a few creates):
```bash
./demo/setup.sh
```

**Then show status:**
```bash
macs status
```

**Narration**:
> "12 tasks. 4 dependency waves. Architecture must come first. Then APIs. Then frontend. Then tests.
>
> MACS tracks all of this automatically."

---

### 4. Launch the Swarm ⭐ (90s — the main event)

```bash
macs swarm \
  --agents "lead:architect,planner|eng1:backend,api|eng2:frontend,ui|qa:testing,e2e|devops:infra,deploy" \
  --simulate
```

**Let it run. The output tells the story:**

```
🐝 MACS Swarm — 5 agent(s) [simulate]
──────────────────────────────────────────────────
  🤖 lead (architect, planner)
  🤖 eng1 (backend, api)
  🤖 eng2 (frontend, ui)
  🤖 qa (testing, e2e)
  🤖 devops (infra, deploy)

Project: 12 tasks | 0 done | 12 pending | 0 in-progress

Simulating task execution (800ms per round)...

▶ Round 1
  🔄 lead           → T-001: Design system architecture [critical]
  🔄 eng1           → T-002: Set up database schema [high]
  🔄 qa             → T-003: Configure CI/CD pipeline [high]
  ✅ lead           ← T-001 done
  ✅ eng1           ← T-002 done
  ✅ qa             ← T-003 done

▶ Round 2   ← T-001 + T-002 unlocked these
  🔄 lead           → T-004: Implement auth API [high]
  🔄 eng1           → T-005: User + org CRUD [high]
  🔄 eng2           → T-006: React auth components [medium]
  ...
```

**Narration** (while swarm runs):
> "Round 1: Three tasks can start in parallel — architecture, database schema, and CI/CD. All three complete.
>
> Round 2: The dependency graph unlocks. Auth API, CRUD endpoints, and React components — all in parallel.
>
> Notice: the protocol handles the ordering automatically. Agents never conflict because JSONL is append-only. The last write wins on state, but events are immutable."

---

### 5. Final Status (20s)

```bash
macs status
```

**Narration**:
> "12 tasks. 12 done. 5 agents. Zero conflicts."

---

### 6. Single Agent Boot (20s, optional)

```bash
# What a real agent sees when it starts a session
macs boot --agent eng1-sonnet --capabilities backend,api
```

**Narration**:
> "When a real agent starts a session, one command gives it everything: what task to work on, what the previous agent left behind, what changed while it was away.
>
> We call this forced handoff — any agent that blocks a task *must* leave instructions for the next one."

---

### 7. Wrap-up (10s)

```bash
macs status  # show all done
```

**Narration**:
> "MACS Protocol v3.0. Append-only. No conflicts. Scales to 100 agents.
>
> Open source. Link below."

---

## Commands Cheatsheet (for replay)

```bash
# Full demo (setup + run)
./demo/setup.sh && ./demo/run.sh

# Just the swarm (project already set up)
cd /tmp/claw-saas-demo
macs swarm --agents "lead:architect|eng1:backend|eng2:frontend|qa:testing|devops:infra" --simulate

# Fast mode (for iteration)
./demo/run.sh --fast

# Scale it up
macs swarm --agents 20 --simulate
```

---

## Key Talking Points

| Point | One-liner |
|-------|-----------|
| Zero conflicts | JSONL is append-only — concurrent writes never conflict |
| Dependency ordering | Tasks unlock automatically when dependencies complete |
| Session continuity | `macs boot` = the next agent always knows what the last one did |
| Forced handoff | `--next` is required on block — no context ever gets lost |
| Drift detection | Silent agents are flagged after N minutes |
| Human-readable | `macs generate` → Markdown for humans, JSONL for machines |

---

## Social Media Copy

**X / Twitter:**
```
MACS Protocol v3.0 — "Git for AI Agents"

Ran 5 agents on a 12-task project. Zero conflicts.
The secret: append-only JSONL event store.

- Agents never block each other (no shared state)
- Dependency graph auto-resolves ordering
- Any agent can boot and continue where the last one stopped
- Forced handoffs: no context ever gets lost

macs swarm --agents 5 --simulate

Open source · npm install -g macs-protocol
```

**HackerNews (Show HN):**
```
Show HN: MACS Protocol v3.0 — coordination layer for multi-agent AI systems

We built an append-only JSONL event store for AI agent coordination.
Think "Git for agents" — immutable history, rebuildable state, no merge conflicts.

Core design:
- tasks.jsonl + events.jsonl → state.json (event sourcing)
- macs boot: single command for agent session start (register → inbox → status → claim → start)
- macs swarm: N agents auto-distribute and complete a task graph in parallel
- Forced handoff: blocked agents must leave structured notes for the next agent
- Drift detection: silent agents flagged after N minutes (tiered response)

Works alongside A2A/MCP (those are communication layers; this is the work coordination layer).

Demo: [link] | npm: macs-protocol | GitHub: [link]
```

---

## Recording Tips

- **Font**: JetBrains Mono, 18pt, dark theme
- **Terminal**: 120×35 (wide enough for swarm output)
- **Speed**: `--delay 800` for normal, `--delay 200` for --fast
- **Pause**: let each round complete before narrating
- **Zoom**: zoom in on the `✅` lines when talking about zero-conflict
