# MACS × Aider

Aider is a CLI coding assistant. Use MACS to coordinate multiple Aider instances on the same project.

## Setup

```bash
cd your-project
macs init
macs register aider-agent --capabilities backend,refactoring --model gpt-4
```

## Usage

### Option 1: Manual (recommended for single agent)

Start Aider with MACS context:
```bash
aider --read .macs/human/STATUS.md --read AGENT-GUIDE.md
```

This injects the current project status and collaboration rules into Aider's context.

### Option 2: Wrapper script (recommended for multi-agent)

Use the provided wrapper:
```bash
./adapters/aider/macs-aider.sh "implement JWT auth"
```

This automatically:
1. Claims the next available task
2. Starts Aider with MACS context + task description
3. Records completion when Aider exits

## Wrapper Script

```bash
# adapters/aider/macs-aider.sh
#!/bin/bash
AGENT_ID="${MACS_AGENT_ID:-aider-$(hostname)}"
TASK=$(macs claim --agent "$AGENT_ID" --json | jq -r '.id + ": " + .title')

if [ -z "$TASK" ]; then
  echo "No tasks available"
  exit 0
fi

TASK_ID=$(echo "$TASK" | cut -d: -f1)

macs start "$TASK_ID" --agent "$AGENT_ID"

# Run Aider with MACS context
aider \
  --read .macs/human/STATUS.md \
  --read AGENT-GUIDE.md \
  --message "You are $AGENT_ID working on: $TASK. Follow AGENT-GUIDE.md for coordination." \
  "$@"

# After aider exits, mark done (manual artifacts)
echo "Task $TASK_ID complete. Enter artifacts (comma-separated files) or press Enter to skip:"
read ARTIFACTS

if [ -n "$ARTIFACTS" ]; then
  macs done "$TASK_ID" --agent "$AGENT_ID" --artifacts "$ARTIFACTS"
else
  macs done "$TASK_ID" --agent "$AGENT_ID"
fi

macs generate
```

## Multiple Aider Instances

Run multiple agents in parallel:
```bash
# Terminal 1
MACS_AGENT_ID=aider-backend ./adapters/aider/macs-aider.sh

# Terminal 2
MACS_AGENT_ID=aider-frontend ./adapters/aider/macs-aider.sh

# Terminal 3
MACS_AGENT_ID=aider-tests ./adapters/aider/macs-aider.sh
```

Each instance will auto-claim a different task (no conflicts).

## Tips

- Add `.aider.conf.yml` to auto-load MACS context:
  ```yaml
  read:
    - .macs/human/STATUS.md
    - AGENT-GUIDE.md
  ```
- Use `macs status` to see all instances' progress
- Use `macs impact <file>` before large refactors
