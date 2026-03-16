## MACS Protocol

This repository uses MACS as the shared workbench for cross-framework agents.

At session start, run:

```bash
macs boot --agent <your-id> --capabilities <comma-separated> --model <model-name>
```

Example:

```bash
macs boot --agent codex-review --capabilities review,backend --model gpt-5
```

Rules:

1. Do not start real work before `macs boot`.
2. Do not edit `.macs/protocol/*.jsonl` or `.macs/protocol/state.json` directly.
3. When a task is complete, call `macs done`.
4. If blocked, call `macs block` with `--reason` and `--next`.
5. During long tasks, call `macs checkpoint`.
6. Read `.macs/human/STATUS.md` if you need a human-readable summary.

Useful commands:

```bash
macs status
macs log --limit 20
macs impact <file>
macs inbox <your-id> --unread
macs done <task-id> --agent <your-id> --summary "..."
macs block <task-id> --agent <your-id> --reason "..." --next "..."
```
