# Simple Project Example

This is a minimal example of MACS in action for a small project.

## Scenario

Building a simple TODO app with one Lead agent and one Engineer agent.

## File Structure

```
simple-project/
├── llms.txt              # Navigation index
├── TASK.md               # Task board
├── CHANGELOG.md          # Change log
├── CONTEXT.md            # Design decisions
└── src/                  # (Your actual code here)
```

## Workflow

### Day 1: Setup

**Lead (Opus) actions**:
1. Read llms.txt → Understand MACS structure
2. Update TASK.md with first tasks:
   ```
   - [ ] Design TODO data model - Assigned: lead → Execute: lead - Status: In Progress
   - [ ] Set up SQLite database - Assigned: lead → Execute: engineer - Status: Planned
   ```
3. Update CHANGELOG.md:
   ```
   - [✨ feat] Project initialized with MACS - by opus #config
   - [📝 docs] Defined TODO data model (id, text, done, created_at) - by opus #design
   ```
4. Update CONTEXT.md:
   ```
   ## Design Decisions
   - Using SQLite for simplicity (no server setup)
   - Single-table schema (normalize later if needed)
   ```

### Day 2: Development

**Engineer (Sonnet) actions**:
1. Read llms.txt + TASK.md → See "Set up SQLite database" assigned
2. Read CHANGELOG.md → Understand data model from Lead's design
3. Implement database setup
4. Update TASK.md:
   ```
   - [x] 2026-02-28 Set up SQLite database - by sonnet
   ```
5. Update CHANGELOG.md:
   ```
   - [🔧 config] Created schema.sql with TODO table - by sonnet #dev
   ```

### Day 3: Blocked

**Engineer encounters issue**:
1. Tries to add timestamps, SQLite syntax error
2. Updates TASK.md:
   ```
   ## 🚨 Escalations
   | Add timestamp columns | sonnet | SQLite doesn't support DATETIME in my dialect, need guidance on format | High | Lead to decide: ISO string vs UNIX epoch |
   ```
3. Tags CHANGELOG:
   ```
   - [🚨 blocked] Timestamp implementation blocked - by sonnet #escalation
   ```

**Lead resolves**:
1. Reads TASK.md Escalations first (per workflow)
2. Decides: Use ISO 8601 strings
3. Updates TASK.md (removes escalation, reassigns):
   ```
   - [ ] Implement timestamps as ISO 8601 - Assigned: lead → Execute: engineer - Status: Unblocked
   ```
4. Updates CHANGELOG:
   ```
   - [📝 docs] Decision: Use ISO 8601 for timestamps (compatible + human-readable) - by opus #design
   ```

### Week 1: Review

**Maintainer (Haiku) generates weekly report**:
```markdown
# Week 1 Report

## Completed
- TODO data model designed
- SQLite database set up
- Timestamp format decided

## Pattern Discovery
| Pattern | Occurrences | Recommendation |
|---------|-------------|----------------|
| SQLite schema setup | 1 | Monitor (too early) |

## Next Week
- Implement CRUD operations
- Add basic CLI interface
```

## Key Takeaways

1. **Documents = Coordination**: No real-time chat needed
2. **Escalations prevent blocking**: Engineer didn't wait silently
3. **CHANGELOG = Shared memory**: Engineer read Lead's design doc via log
4. **Weekly review identifies patterns**: Even in simple projects

## Try It Yourself

```bash
cd examples/simple-project
# Read files in order: llms.txt → TASK.md → CHANGELOG.md
# Simulate agent actions by editing files
```
