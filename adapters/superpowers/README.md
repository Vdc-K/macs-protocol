# MACS × Superpowers

**From requirements to running agents in one step.** Superpowers turns your idea into a structured plan; MACS distributes that plan across your agent team.

```
Superpowers: idea → brainstorm → plan
                                  ↓
MACS: plan → tasks → swarm → done
```

## Quick Start

```bash
# 1. Generate a plan with Superpowers (in Claude Code)
/plan "Build OAuth2 login with Google"
# → creates docs/superpowers/plans/2026-03-13-oauth.md

# 2. Import into MACS
node node_modules/macs-protocol/adapters/superpowers/import-plan.mjs \
  docs/superpowers/plans/2026-03-13-oauth.md --agent pm

# 3. Launch agents
macs swarm --agents 3 --simulate
```

## import-plan.mjs

Parses a Superpowers plan file and batch-creates MACS tasks with:
- Priority inferred from task title (test → low, auth/api/core → high)
- Tags inferred from tech stack and file paths
- Sequential dependency chain (Task 2 depends on Task 1, etc.)

### Options

```
node import-plan.mjs <plan-file> [--agent <id>] [--dry-run]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--agent` | `pm` | Agent ID to use for macs create calls |
| `--dry-run` | false | Preview tasks without creating them |

### Example Output

```
📋 Superpowers Plan: Build OAuth2 login with Google
   5 tasks found in docs/superpowers/plans/2026-03-13-oauth.md
──────────────────────────────────────────────────
  [1] [high]   Set up Google OAuth2 credentials
       tags: backend, auth
  [2] [medium] Create OAuth callback handler
       files: src/auth/callback.ts
       tags: backend, auth
  [3] [low]    Write integration tests
       tags: testing
  ...

✅ Created 5/5 tasks from Superpowers plan
   Tasks: T-042 → T-043 → T-044 → T-045 → T-046 (chained dependencies)

Next: macs swarm --agents 3 --simulate
```

## Full Workflow with PACEflow

```
Superpowers brainstorm → writing-plans → plan.md
                                          ↓
macs import-plan plan.md         (creates MACS tasks)
                                          ↓
macs swarm --agents 3            (agents claim tasks)
                                          ↓
PACEflow hooks                   (each agent: plan → code → verify)
                                          ↓
macs done T-001                  (task complete)
```

## Plan File Format

Superpowers generates plans at `docs/superpowers/plans/YYYY-MM-DD-<name>.md`.

The importer reads:
- `**Goal:**` → used as context
- `**Tech Stack:**` → extracted as tags
- `### Task N: Title` → creates one MACS task per heading

## Comparison

| | Manual | With Superpowers |
|---|---|---|
| Task creation | `macs add` per task | Auto-import entire plan |
| Task structure | Free-form | TDD-oriented, 2-5 min steps |
| Dependencies | Manual `--depends` | Auto-chained in order |
| Plan coverage | Ad hoc | Brainstorm → design → tasks |
