# MACS × Codex

> Codex already understands the repo. MACS gives it the same shared task state that Claude Code, Cursor, and Aider can also see.

## Why This Exists

Codex is one of the clearest tests of MACS's positioning:

- If Codex can only work from local repo context, you still have framework silos.
- If Codex can read and write the same `.macs/` state as other agents, you have a true cross-framework workbench.

## Setup

### 1. Initialize MACS

```bash
cd your-project
macs init "My Project"
```

### 2. Teach Codex the MACS entry point

Append the Codex instruction block to the project's `AGENTS.md`:

```bash
cat /path/to/macs-skill/adapters/codex/macs-context.md >> AGENTS.md
```

If the repo already has `AGENTS.md`, append the block near the end.
If not, create a project-local `AGENTS.md` and add the block there.

## Session Start

At the top of each Codex session, call:

```bash
macs boot --agent codex-review --capabilities review,backend --model gpt-5
```

That one command does the important work:

- registers the Codex agent if needed
- catches up on the latest state
- checks inbox and resumable work
- recommends or resumes the next task

## When Work Finishes

```bash
macs done T-001 --agent codex-review \
  --summary "Reviewed auth flow and suggested fix for token refresh" \
  --artifacts "src/auth.ts,tests/auth.test.ts"
```

## When Codex Is Blocked

```bash
macs block T-001 --agent codex-review \
  --reason "Need product decision on refresh-token lifetime" \
  --next "Implementation is ready in src/auth.ts once policy is confirmed" \
  --done "reviewed refresh flow and test gaps" \
  --issue "policy is not specified"
```

## Recommended Roles For Codex

- review agent
- refactoring agent
- integration / regression checker
- second-opinion architecture reviewer

Example:

```bash
macs boot --agent codex-audit --capabilities review,refactoring,testing --model gpt-5
```

## Cross-Framework Demo

The simplest useful demo is:

1. Claude Code or Cursor implements a task.
2. MACS records the task state and artifacts in `.macs/`.
3. Codex joins later with `macs boot`.
4. Codex reviews or continues the same task without re-explaining the repo.

That is the point of MACS. Not more agents in one tool. One shared workbench across tools.
