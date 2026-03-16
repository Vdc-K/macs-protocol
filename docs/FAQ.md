# Frequently Asked Questions

## General

### What is MACS?

MACS (Multi-Agent Collaboration System) is an **event-sourcing protocol** for multi-agent collaboration. Agents emit structured JSONL events via CLI commands; human-readable documents (TASK.md, CHANGELOG.md, CONTEXT.md) are auto-generated from the event log — you never edit them manually.

Think of it as a universal workbench for AI agents — any framework issues `macs` CLI commands, and MACS handles persistence, history, and rendering into readable docs.

### How is MACS different from AutoGen/CrewAI/LangGraph?

| Aspect | AutoGen/CrewAI/LangGraph | MACS |
|--------|--------------------------|------|
| **Communication** | Real-time message passing | Async JSONL events via CLI |
| **Infrastructure** | Python runtime required | MACS CLI + Git |
| **Learning Curve** | Medium-High (code) | Low (CLI commands) |
| **Debugging** | Console logs | Immutable event log |
| **Human Oversight** | Programmatic | Auto-generated readable docs |
| **Platform** | Language-specific | Platform-agnostic |

**MACS complements, not competes with them**. You can use MACS as the "human interface layer" and AutoGen/CrewAI as execution engines.

### Do I need to use Claude Code?

No. MACS works with any LLM that can read/write files:
- Claude Code (native SKILL.md support)
- Cursor, Windsurf, Continue
- OpenAI Assistants API
- LangChain agents
- Manual API calls

SKILL.md is just for Claude Code users. Everyone else can use the templates directly.

---

## Setup & Usage

### How do I initialize a new project?

```bash
cd your-project
macs init "Project Name"
```

This initializes the `.macs/` event store and generates the initial human-readable documents (TASK.md, CHANGELOG.md, etc.) in your project.

### Can I customize the templates?

Yes! After running `macs init`, edit the files to fit your workflow. Templates are starting points, not rigid rules.

### What if I don't use Git?

MACS works best with Git (for audit trail, branching, conflict resolution), but you can use it without Git if you:
- Manually manage file versions
- Use cloud sync (Dropbox, Google Drive) for team collaboration
- Accept risk of conflicts when multiple agents edit simultaneously

### How do I archive old data?

**Manual**:
```bash
# Move old CHANGELOG entries
cat CHANGELOG.md | grep "2025-12" >> archive/CHANGELOG-2025-12.md
# Remove from CHANGELOG.md
```

**Automated** (recommended):
- Set up cron job (see [EVENT-TRIGGERS.md](EVENT-TRIGGERS.md))
- Use mycc scheduler (Claude Code + mycc users)
- Use GitHub Actions (for public repos)

---

## Multi-Agent Coordination

### How do agents know what others are doing?

Agents query the MACS event log via CLI (`macs log`, `macs status`). MACS renders the current state into CHANGELOG.md automatically — agents read that for a human-readable summary.

Example:
```
Agent A: Runs `macs log --limit 5`, sees "Added JWT auth - by opus #design"
Agent A: Understands auth is done, issues `macs start user-profile`
```

### What if two agents edit the same file?

**Prevention** (recommended):
1. Use Git branches (one per agent or team)
2. Define clear ownership in TASK.md
3. Use TEAM-CONTRACTS.md for multi-team projects

**Resolution** (if conflict happens):
- Git's merge conflict resolution
- Or manual review (docs are human-readable)

### How do agents escalate blockers?

See [Escalation Protocol](../templates/TASK.md):
1. Run `macs block <id> --reason "..." --next "..."`
2. MACS emits a `task.blocked` event and updates TASK.md automatically
3. If human escalation is needed, run `macs escalate <id> --reason "..."`
4. Lead reviews blocked tasks on next turn via `macs status`

---

## Advanced Features

### What are Skill Capsules?

Skill Capsules package not just code, but **validated knowledge** (see [SKILL-CAPSULES.md](SKILL-CAPSULES.md)):
- Implementation (code)
- Environment fingerprint (when it works)
- Validation log (success/failure history)
- Evolution path (version history)

Inspired by EvoMAP's Gene Capsules.

### How does QMD integration work?

QMD (Quantum Markdown) enables semantic search of your docs:

```bash
# Index once
qmd index .

# Search by intent
qmd query "auth decisions"
# Returns relevant snippets from CHANGELOG, CONTEXT, archive
```

Without QMD, agents read files linearly (slower but still works).

### Can I use MACS for non-coding projects?

Yes! MACS is task-agnostic:
- Content creation (research → outline → draft → review)
- Data analysis (explore → analyze → visualize → report)
- Business processes (plan → execute → review)

Just adapt templates to your domain.

---

## Performance & Cost

### Does MACS reduce token usage?

Yes, significantly:
- **Without MACS**: Agent reads full conversation history (50k-100k tokens)
- **With MACS**: Agent reads llms.txt + TASK + recent CHANGELOG (~2-5k tokens)

**~90% token reduction** via structured context.

### How much does weekly maintenance cost?

Using Haiku (cheapest model) for archiving:
- Input: ~3k tokens (read CHANGELOG + TASK)
- Output: ~1k tokens (write archive + report)
- Cost: **$0.0015/week = $0.08/year**

### What's the model cost for 50-agent teams?

Example (e-commerce platform, 12 weeks):
- 1 Lead (Opus): $150/week × 12 = $1,800
- 40 Engineers (Sonnet): $50/week × 12 = $24,000
- 9 Maintainers (Haiku): $2/week × 12 = $216

**Total: ~$26K** (vs ~$50K without model tiering)

---

## Troubleshooting

### Agent keeps re-reading full conversation history

Make sure agent prompt includes:
```
"Read llms.txt first, then follow its navigation to TASK.md and CHANGELOG.md.
Do NOT read full conversation history."
```

### CHANGELOG.md exceeds 2k tokens

Archive older entries manually (do not edit CHANGELOG.md manually — move entries to an archive file and let MACS regenerate from the event log):
```bash
# Move old CHANGELOG entries to an archive file
cat CHANGELOG.md | grep "2025-12" >> archive/CHANGELOG-2025-12.md
# Then remove those entries from CHANGELOG.md
```

> Note: Automated `macs archive` command is planned for a future release.

### Agents ignore TASK.md escalations

Add to llms.txt:
```
## Rules
- Check Escalations section in TASK.md FIRST on every turn
```

### Git conflicts in markdown files

**Prevention**: Each agent/team uses own branch

**Resolution**: Most markdown conflicts are easy to resolve (line-based). Use:
```bash
git mergetool
```

### Skill capsules not showing success rates

Ensure agents log results to `knowledge/VALIDATION-LOG.md`:
```yaml
- timestamp: 2026-02-28T10:00:00Z
  result: success/failure
  environment: {...}
```

---

## Integration

### Can MACS work with AutoGen?

Yes! Use MACS as the planning layer:

```python
# MACS CLI creates task, emits event
# subprocess.run(["macs", "add", "--title", "autogen-task"])
# AutoGen executes, reports via CLI
# subprocess.run(["macs", "done", task_id, "--summary", result])
# MACS auto-updates CHANGELOG.md and knowledge base
```

See [ENTERPRISE-TEAMS.md](ENTERPRISE-TEAMS.md) integration section.

### How to use with LangChain?

MACS provides document structure. LangChain agents read docs as context:

```python
from langchain.agents import create_openai_functions_agent

# Agent reads MACS docs
with open("llms.txt") as f:
    context = f.read()

agent.invoke({"input": task, "context": context})
```

### Does MACS support remote teams (humans + agents)?

Yes. Use Git for sync:
- Human commits: `git commit -m "chore: manual update to TASK.md"`
- Agent commits: `git commit -m "feat: added feature X - by sonnet"`

All collaborators (human + agent) use same Git repo.

---

## Community & Support

### Where to ask questions?

1. GitHub Discussions (best for detailed Q&A)
2. GitHub Issues (for bugs/feature requests)
3. OpenClaw community channels

### How to contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md):
- Report issues
- Improve docs
- Submit skill capsules
- Translate to new languages

### Is there a Discord/Slack?

Check OpenClaw community. MACS is part of that ecosystem.

### Who maintains MACS?

Created by HH & OpenClaw Community. Maintained by contributors.

---

## Roadmap

### What's next for MACS?

**v2.3** (Q2 2026):
- Local skill capsule support
- Git-native collaboration protocol

**v3.0** (Q3 2026):
- Community capsule registry (macs.dev)
- Multi-LLM adapters
- Visual workflow editor

**v4.0** (Q1 2027):
- EvoMAP network integration
- Enterprise features (RBAC, audit logs)
- Token economy for skill creators

### Can I sponsor MACS development?

Not yet, but planned:
- GitHub Sponsors (Q2 2026)
- Skill marketplace revenue share (Q3 2026)

---

**More questions?** Open a GitHub Discussion.
