# MACS Quick Start

> Get started with MACS in 5 minutes.

## 1. Install MACS (30 seconds)

```bash
# Clone the repo
git clone https://github.com/your-org/macs.git
cd macs

# Or download as zip and extract
```

## 2. Initialize Your Project (1 minute)

```bash
# Go to your project directory
cd ~/my-project

# Run MACS init script
/path/to/macs/scripts/init.sh "My Project Name"

# You should see:
#  ✓ Created TASK.md
#  ✓ Created CHANGELOG.md
#  ✓ Created CONTEXT.md
#  ✓ Created llms.txt
#  ✓ Created docs/BEST-PRACTICES.md
```

## 3. Configure Your Project (2 minutes)

```bash
# Edit llms.txt - add project description
vim llms.txt

# Edit TASK.md - add your first task
vim TASK.md
```

**Example TASK.md**:
```markdown
## 🔥 Current Tasks

- [ ] Set up database schema - Assigned: lead → Execute: engineer - Status: In Progress
```

## 4. Start Working (Agent Workflow)

### For Lead (High-capability model):

```
1. Read llms.txt → Understand project structure
2. Read TASK.md → See current priorities
3. Plan work and break down into tasks
4. Update TASK.md with assignments
5. Update CHANGELOG.md:
   - [✨ feat] Created user authentication module - by opus #design
```

### For Engineer (Balanced model):

```
1. Read llms.txt → Quick orientation
2. Read TASK.md → Pick assigned task
3. Read CHANGELOG.md (last 3-5 days) → Recent context
4. Work on task
5. Update TASK.md (move to completed)
6. Update CHANGELOG.md:
   - [🔧 config] Implemented JWT middleware - by sonnet #dev
```

### If Blocked:

```
1. Update task status to [BLOCKED]
2. Move to TASK.md Escalations section
3. Add reason and what you need from Lead
4. Tag CHANGELOG with #escalation
```

## 5. Weekly Maintenance (Automated - Optional)

Set up automatic weekly cleanup:

```bash
# Using cron
crontab -e

# Add this line (every Sunday at midnight):
0 0 * * 0 cd ~/my-project && /path/to/cleanup.sh
```

Or use mycc scheduler (if you have Claude Code + mycc):
```json
{
  "name": "macs-weekly-cleanup",
  "schedule": "0 0 * * 0",
  "task": "Archive old CHANGELOG and generate weekly report"
}
```

See [EVENT-TRIGGERS.md](EVENT-TRIGGERS.md) for details.

## 6. (Optional) Advanced Features

### QMD Search Integration

```bash
# Install qmd
brew install qmd  # or see qmd docs

# Index your project
qmd index .

# Now agents can search efficiently:
qmd query "authentication decisions"
```

### Skill Capsules

```bash
# When weekly report identifies repeated patterns:
# Create a skill capsule

mkdir -p skills/my-skill
# Follow structure in SKILL-CAPSULES.md
```

---

## Common Workflows

### Daily Development

```
Morning:
  → Agent reads TASK.md + CHANGELOG (last 3 days)
  → Works on assigned tasks

Evening:
  → Agent updates TASK.md (completed tasks)
  → Agent appends to CHANGELOG.md
```

### Weekly Review

```
Sunday (automated by Maintainer):
  → Archive CHANGELOG entries >2 weeks old
  → Generate WEEKLY-REPORT.md
  → Identify repeated patterns
  → Mark candidate skills
```

### Monthly Planning

```
End of month:
  → Lead reviews all WEEKLY-REPORT.md files
  → Decides which candidate skills to formalize
  → Creates skill capsules for approved patterns
  → Updates CONTEXT.md with major decisions
```

---

## Troubleshooting

**Q: Agent doesn't know what to do**
→ Check llms.txt and TASK.md are in project root

**Q: CHANGELOG getting too large**
→ Run manual archive: move old entries to `archive/CHANGELOG-YYYY-MM.md`

**Q: Multiple agents editing same file**
→ Use Git branches per agent/team (see ENTERPRISE-TEAMS.md)

**Q: How to use with Cursor/other IDEs?**
→ Templates work anywhere. Copy templates manually if init.sh doesn't work.

---

## Next Steps

- Read [BEST-PRACTICES.md](BEST-PRACTICES.md) for detailed workflows
- Explore [ENTERPRISE-TEAMS.md](ENTERPRISE-TEAMS.md) for multi-team projects
- Check [SKILL-CAPSULES.md](SKILL-CAPSULES.md) for advanced skill sharing

**Questions?** Open an issue or join OpenClaw community.
