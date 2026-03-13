# MACS for Cursor

> Make Cursor Agent collaborate like a pro with document-driven workflows

---

## 🚀 Quick Start

```bash
cd your-project
/path/to/macs/install.sh
```

The installer will:
1. Copy MACS templates (TASK.md, CHANGELOG.md, CONTEXT.md)
2. Add MACS instructions to `.cursorrules`
3. Generate index for token optimization

---

## 📋 How It Works

### Before Starting Work

Cursor Agent will automatically read:
- **TASK.md** - What to do
- **CHANGELOG.md** - What was done
- **CONTEXT.md** - Why we did it

### After Completing Work

Ask Cursor to:
```
Update CHANGELOG.md with my changes:
- [✨ feat] Implemented user authentication - by cursor-agent #dev #auth
```

Or manually update:
```markdown
## 2026-02-28
- [✨ feat] Your change description - by cursor-agent #dev
```

---

## 🎯 Workflow Examples

### Example 1: Simple Feature

**You**: "Add a logout button to the navbar"

**Cursor**:
1. Reads TASK.md to see current tasks
2. Implements the feature
3. Updates CHANGELOG.md:
   ```
   - [✨ feat] Added logout button to navbar - by cursor-agent #dev #ui
   ```
4. Marks task as completed in TASK.md

### Example 2: Multi-Step Task

**You**: "Implement JWT authentication"

**Cursor**:
1. Reads CONTEXT.md to understand auth decisions
2. Implements JWT auth
3. Updates CHANGELOG.md with multiple entries:
   ```
   - [✨ feat] Created JWT token generation - by cursor-agent #dev #auth
   - [✨ feat] Added JWT middleware - by cursor-agent #dev #auth
   - [🧪 test] Added JWT auth tests - by cursor-agent #test
   ```
4. Marks task as completed

### Example 3: Blocked Task

**Cursor encounters decision**: "Should we use OAuth 2.0 or SAML for SSO?"

**Cursor**:
1. Updates TASK.md → Escalations section:
   ```
   | Implement SSO | cursor-agent | Need decision: OAuth 2.0 vs SAML | High | Lead to decide SSO strategy |
   ```
2. Adds to CHANGELOG.md:
   ```
   - [🚨 escalation] Need SSO strategy decision - by cursor-agent #escalation
   ```

---

## 🔧 Configuration

### .cursorrules Integration

The installer adds this to your `.cursorrules`:

```
# MACS (Multi-Agent Collaboration System)

## Before Starting Work
Read: TASK.md, CHANGELOG.md, CONTEXT.md

## After Work
Update CHANGELOG.md: [type] description - by cursor-agent #tags
Mark task completed in TASK.md

## If Blocked
Add to TASK.md → Escalations section
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

### Without MACS Indexing
```
Cursor reads full CHANGELOG.md (800 lines) = 2400 tokens
Cursor reads full TASK.md (150 lines) = 450 tokens
Total: 2850 tokens per query
```

### With MACS Indexing
```bash
# Generate index
macs index .

# Cursor queries index
Recent 5 changes = 30 tokens
Active tasks = 15 tokens
Total: 45 tokens per query (98% reduction!)
```

**Cost savings** (100 queries):
- Opus: $4.28 saved
- Sonnet: $0.86 saved
- Haiku: $0.07 saved

---

## 📊 Dashboard

View your multi-agent collaboration in real-time:

```bash
macs dashboard
```

Opens http://localhost:3456 with:
- Task completion stats
- Recent activity feed
- Token usage trends
- File heatmap
- Escalation alerts

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

**Solution**: Archive old entries
```bash
# Manually
mkdir -p archive
mv CHANGELOG.md archive/CHANGELOG-2026-02.md
# Create new CHANGELOG.md

# Or use MACS maintainer (coming soon)
```

### Cursor Makes Changes Without Updating CHANGELOG

**Solution**: Add to prompt
```
After implementing, please update CHANGELOG.md with your changes
```

Or add to `.cursorrules`:
```
CRITICAL: Always update CHANGELOG.md after changes
```

---

## 🆚 MACS vs Plain Cursor

| Aspect | Plain Cursor | Cursor + MACS |
|--------|-------------|---------------|
| Context Awareness | Relies on conversation history | Reads structured docs (TASK/CHANGELOG/CONTEXT) |
| Multi-Session | Loses context between sessions | Persistent across sessions |
| Token Usage | High (re-reads everything) | 98% reduction via indexing |
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
