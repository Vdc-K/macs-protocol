# MACS × PACEflow

**Quality gates for every MACS task.** PACEflow hooks enforce Plan→Execute→Verify on each agent, MACS coordinates across all of them.

```
PACEflow (quality gate per agent)
         ↕
MACS (coordination across agents)
```

## Quick Start

```bash
# From your project root (where .macs/ lives)
bash node_modules/macs-protocol/adapters/paceflow/install.sh
```

This copies 3 hooks to `.claude/hooks/` and registers them in `.claude/settings.json`.

## How It Works

| Trigger | Hook | Action |
|---------|------|--------|
| Write/Edit tool | `pre-tool-use.js` | Block if no `.macs/pace/{id}/plan.md` |
| Session start | `session-start.js` | Show active tasks, create plan templates |
| Claude stops | `stop.js` | Block if in-progress tasks have no checkpoint |

### Plan File

When you run `macs start T-001`, a plan template is auto-created at:

```
.macs/pace/T-001/plan.md
```

Fill it in before writing code:

```markdown
# Plan: T-001

## Approach
Brief description of how you'll implement this.

## Files
- Modify: src/auth/login.ts
- Create: tests/auth/login.test.ts

## Verification
- [ ] Tests pass: npm test
- [ ] No type errors: npm run typecheck
```

Once the file exists, Write/Edit operations are unblocked.

### Checkpoint = Verified

The stop hook checks for a recent `macs checkpoint`. Before ending a session:

```bash
macs checkpoint T-001 --note "✓ tests pass → next: code review ⚠ none"
# or
macs done T-001 --summary "auth flow complete" --artifacts "src/auth/,tests/auth/"
```

## Lifecycle

```
macs start T-001
  → session-start: creates .macs/pace/T-001/plan.md template
  → pre-tool-use: blocks Write until plan.md filled in

Fill plan.md → Write/Edit unblocked

macs checkpoint T-001 --note "..."
  → stop hook: satisfied, session can end

macs done T-001
  → task complete
```

## Anti-Loop Protection

The stop hook backs off after 3 consecutive blocks, so Claude can never get stuck in a permanent loop.

## Comparison

| | Plain MACS | MACS + PACEflow |
|---|---|---|
| Task coordination | ✅ | ✅ |
| Plan before code | ❌ | ✅ enforced |
| Verified before done | ❌ | ✅ enforced |
| Cross-agent | ✅ | ✅ |

## Uninstall

```bash
rm .claude/hooks/macs-*.js
# Remove "hooks" entries from .claude/settings.json
```
