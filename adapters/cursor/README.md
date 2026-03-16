# MACS for Cursor

> Make Cursor Agent collaborate like a pro with event-sourcing workflows

---

## 🚀 Quick Start

```bash
cd your-project
/path/to/macs/install.sh
```

The installer will:
1. Initialize the MACS event store (`.macs/events.jsonl`)
2. Add MACS CLI instructions to `.cursorrules`
3. Auto-generate TASK.md, CHANGELOG.md, CONTEXT.md from the event store

---

## 📋 How It Works

### Before Starting Work

Cursor Agent reads the auto-generated docs:
- **TASK.md** - What to do (generated from `task.*` events)
- **CHANGELOG.md** - What was done (generated from all events)
- **CONTEXT.md** - Why we did it (generated from `decision.*` events)

### After Completing Work

Ask Cursor to emit MACS events via CLI:
```bash
macs done <task-id> --summary "Implemented user authentication"
```

MACS emits the JSONL event and regenerates CHANGELOG.md automatically — never edit it by hand.

---

## 🎯 Workflow Examples

### Example 1: Simple Feature

**You**: "Add a logout button to the navbar"

**Cursor**:
1. Runs `macs status` to see current tasks
2. Implements the feature
3. Emits completion event:
   ```bash
   macs done <id> --summary "Added logout button to navbar"
   ```
4. MACS auto-updates CHANGELOG.md and marks the task done

### Example 2: Multi-Step Task

**You**: "Implement JWT authentication"

**Cursor**:
1. Runs `macs status` to read current context and auth decisions
2. Implements JWT auth
3. Emits multiple completion events:
   ```bash
   macs done <id> --summary "Created JWT token generation"
   macs done <id> --summary "Added JWT middleware"
   macs done <id> --summary "Added JWT auth tests"
   ```
4. MACS auto-updates CHANGELOG.md and marks task done

### Example 3: Blocked Task

**Cursor encounters decision**: "Should we use OAuth 2.0 or SAML for SSO?"

**Cursor**:
1. Emits a block event:
   ```bash
   macs block <id> --reason "Need SSO strategy decision: OAuth 2.0 vs SAML" --next "Human to decide SSO strategy"
   ```
2. MACS emits `task.blocked` event, auto-updates TASK.md escalations section and CHANGELOG.md

---

## 🔧 Configuration

### .cursorrules Integration

The installer adds this to your `.cursorrules`:

```
# MACS (Multi-Agent Collaboration System)

## Before Starting Work
Run: macs status, macs log --limit 5

## After Work
Run: macs done <id> --summary "..."
(CHANGELOG.md and TASK.md are auto-generated — do not edit manually)

## If Blocked
Run: macs block <id> --reason "..." --next "..."
```

### Custom Instructions

Add project-specific rules to `.cursorrules`:

```
# Project-Specific MACS Rules

## Commit Message Format
Always use: type(scope): description
Example: feat(auth): add JWT middleware

## Required Tags
Use at least one: #frontend, #backend, #infra, #docs

## Testing
All features require: [🧪 test] entry in CHANGELOG
```

---

## 💰 Token Optimization

### Without MACS
```
Cursor reads full CHANGELOG.md (800 lines) = 2400 tokens
Cursor reads full TASK.md (150 lines) = 450 tokens
Total: 2850 tokens per query
```

### With MACS
```bash
# Check current state (compact output)
macs status

# View recent activity only
macs log --limit 5

# Cursor reads focused context instead of full files
Recent 5 changes = 30 tokens
Active tasks = 15 tokens
Total: ~45 tokens per query
```

**Estimated cost savings** (100 queries):
- Opus: $4.28 saved
- Sonnet: $0.86 saved
- Haiku: $0.07 saved

---

## 📊 Project Overview

View your multi-agent collaboration status:

```bash
# Task overview: pending, in-progress, blocked
macs status

# Agent workload distribution
macs workload

# Recent activity feed
macs log --limit 10
```

---

## 🎓 Best Practices

### 1. Use Descriptive Task Titles

**Bad**:
```markdown
- [ ] Fix bug
```

**Good**:
```markdown
- [ ] Fix JWT token expiration bug in auth middleware @cursor-agent #fix #auth
```

### 2. Tag Everything

Tags enable filtering and analytics:
```markdown
- [✨ feat] Added Redis caching - by cursor-agent #perf #ops
- [🐛 fix] Fixed CORS issues - by cursor-agent #fix #backend
- [📝 docs] Updated API docs - by cursor-agent #docs
```

### 3. Update CONTEXT.md for Important Decisions

When making architectural decisions, document in CONTEXT.md:

```markdown
### JWT vs Session Auth - 2026-02-28 - by cursor-agent

**Context**: Need authentication for mobile app

**Decision**: Use JWT (not sessions)

**Rationale**:
- Mobile requires stateless auth
- Easier to scale horizontally
- No server-side session storage needed

**Impact**: All auth endpoints
```

### 4. Escalate Early

Don't guess on architectural decisions:
```markdown
| Implement caching | cursor-agent | Redis vs Memcached vs in-memory? | High | Lead to decide caching strategy |
```

---

## 🔍 Troubleshooting

### Cursor Not Reading .cursorrules

**Solution**: Restart Cursor or reload window
- macOS: Cmd+Shift+P → "Reload Window"
- Windows: Ctrl+Shift+P → "Reload Window"

### CHANGELOG.md Getting Too Long

CHANGELOG.md is auto-generated from the event store — do not edit manually. To reduce visible history, prune the `.macs/events.jsonl` file directly (keep only recent events), then re-run `macs status` to verify. A dedicated archive command is not currently available in the CLI.

### Cursor Makes Changes Without Emitting Events

**Solution**: Add to prompt
```
After implementing, emit a MACS event:
macs done <id> --summary "your changes"
```

Or add to `.cursorrules`:
```
CRITICAL: Always emit macs done after changes. Never edit CHANGELOG.md manually.
```

---

## 🆚 MACS vs Plain Cursor

| Aspect | Plain Cursor | Cursor + MACS |
|--------|-------------|---------------|
| Context Awareness | Relies on conversation history | Reads auto-generated docs (TASK/CHANGELOG/CONTEXT) |
| Multi-Session | Loses context between sessions | Persistent across sessions |
| Token Usage | High (re-reads everything) | Lower via `macs status` + `macs log` focused queries |
| Collaboration | Single agent only | Multi-agent (Cursor + human + other AIs) |
| Traceability | Conversation only | Git-like change log |
| Decision Record | Not tracked | Documented in CONTEXT.md |

---

## 📚 Examples

See [examples/cursor-project/](../../examples/cursor-project/) for a complete project using MACS with Cursor.

---

## 🤝 Contributing

Found a better workflow? Share it!
- GitHub Issues: https://github.com/your-org/macs/issues
- Discussions: https://github.com/your-org/macs/discussions

---

## 📄 License

MIT © 2026 HH & OpenClaw Community
