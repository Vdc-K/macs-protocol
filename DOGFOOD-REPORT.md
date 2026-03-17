[中文版](DOGFOOD-REPORT.zh-CN.md)

# MACS Dogfood Report: 4 Agents, 3 Providers, 1 Shared Workbench

> Date: 2026-03-17
> Version: v5.3.0 (post-dogfood fixes applied same day)

## The Experiment

We ran a real task through MACS with 4 agents from 3 different providers, coordinating via a single `.macs/` workspace in a temporary directory (`/tmp/macs-dogfood/`). Agents took turns sequentially (not parallel), communicating only through MACS protocol state.

| Agent | Model | Provider | How it joined |
|-------|-------|----------|---------------|
| cc-opus | Claude Opus 4.6 | Anthropic (Claude Code) | `macs boot --agent cc-opus` |
| cc-sonnet | Claude Sonnet 4.6 | Anthropic (subagent) | `macs boot --agent cc-sonnet` |
| codex | GPT 5.4 | OpenAI (Codex CLI) | `macs boot --agent codex` |
| omnicoder | OmniCoder 9B | Local (Ollama on M4 Max) | `macs boot --agent omnicoder` |

The task: "Skill versioning in capability-index", broken into 3 independent tasks (not subtasks).

**Note**: The tasks exercised the MACS coordination protocol. The actual code changes were implemented separately in the OnlyClaude repository; this experiment validated multi-agent task handoff, not the code artifacts themselves.

## What Happened

```bash
macs init "Skill Versioning"
macs add "Parse version from SKILL.md frontmatter in capability-index" --priority high
macs add "Add version column to dashboard HTML output" --priority medium
macs add "Write tests for version parsing and display" --priority medium
```

### Round 1: cc-opus starts, gets blocked

cc-opus claimed T-001, made 40% progress, then hit a design decision: what format should version use in the JSON output?

```bash
macs checkpoint T-001 --agent cc-opus --progress 0.4 \
  --note "parseFrontmatter() already reads version. Need format decision."
macs block T-001 --agent cc-opus \
  --reason "Need to decide: semver vs semver+date vs changelog link" \
  --next "Another agent pick this up and decide format"
```

### Round 2: OmniCoder makes the call

OmniCoder (a 9B local model running on Ollama) read the MACS status via `macs status`, analyzed the three format options, and decided: **plain semver string**. Reasoning: industry standard, machine-comparable, concise.

```bash
macs unblock T-001 --agent omnicoder
# Note: Before the fix below, omnicoder could not re-claim the task after unblocking.
# After the fix, unblock clears assignee, enabling any agent to claim.
```

### Round 3: Everyone finishes

- **cc-opus** re-claimed and completed T-001 (version parsing)
- **cc-sonnet** completed T-002 (dashboard column)
- **codex** completed T-003 (tests)

Final status: **3/3 tasks completed, 4 agents registered, 0 blocked.**

## Bugs Found (and Fixed)

Three protocol-level issues that only surfaced under live cross-agent coordination:

### 1. Unblock doesn't transfer ownership

**Found**: After omnicoder unblocked T-001, the task stayed assigned to cc-opus. Omnicoder couldn't claim it.

**Root cause**: `task_unblocked` handler set status back to `in_progress` but kept the original assignee.

**Fix**: Unblock now sets status to `pending` and clears `assignee`, so any agent can re-claim. Also records `unblocked_by` in blocked history.

### 2. Checkpoint doesn't validate owner

**Found**: Any agent could write checkpoints to any task, regardless of assignment. This breaks the ownership model — if agent B can silently update agent A's progress, task state becomes unreliable.

**Fix**: `addCheckpoint()` now throws if the caller isn't the task's assignee: `"Only the task owner can add checkpoints (current owner: <name>)"`.

### 3. Contribution stats only count claim/done

**Found**: Omnicoder made the critical design decision and unblocked the task, but `tasks_done: 0`. Agents that contribute through decisions, unblocks, and reviews were invisible in stats.

**Fix**: Agent stats now track `checkpoints_added`, `tasks_unblocked`, and `reviews_done` in addition to `tasks_completed`.

## Key Insight

> **A 9B local model running on a laptop made a design decision that unblocked a task for Claude Opus.**

This is the MACS value proposition in one sentence. The models don't need to be the same size, the same provider, or even the same architecture. They just need to read and write to the same `.macs/` directory.

## Numbers

- **4** agents registered (sequential handoff, not parallel)
- **3** providers (Anthropic, OpenAI, local Ollama)
- **3** tasks completed
- **3** protocol bugs found and fixed
- **1** design decision made by local 9B model
- **0** custom pairwise coordination logic between agents

## Limitations

- **Single session**: The entire experiment ran in one sitting (~30 minutes), not a multi-day project.
- **Temporary workspace**: Used `/tmp/macs-dogfood/`, not a real production repo.
- **Sequential**: Agents took turns; we did not test true parallel concurrent writes.
- **Orchestrated**: A human directed which agent acts when. In production, agents would need their own scheduling.
- **No regression tests**: The 3 fixes were verified manually but the protocol's existing test suite has not been updated yet.

## What's Next

- [ ] Update protocol test suite with regression cases for the 3 fixes
- [ ] Antigravity (Google) adapter for a 4th provider
- [ ] npm publish with these fixes
- [ ] Real-world multi-day project with genuine parallel execution
