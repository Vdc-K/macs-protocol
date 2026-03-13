# MACS × Ollama (Local Models)

Run MACS with fully local models — no API keys, no cloud, no data leaving your machine.

Supported: Ollama + any coding model (deepseek-coder, codellama, qwen2.5-coder, etc.)

## Setup

```bash
# Install Ollama
brew install ollama   # macOS
# or: curl -fsSL https://ollama.ai/install.sh | sh

# Pull a coding model
ollama pull deepseek-coder:6.7b    # fast, good for most tasks
ollama pull qwen2.5-coder:14b      # better quality

# Init MACS
cd your-project
macs init
macs register local-agent --capabilities backend,testing --model deepseek-coder
```

## Usage with Continue.dev

The easiest way to use Ollama + MACS:

1. Install [Continue.dev](https://continue.dev) extension
2. Configure Ollama as provider in Continue settings
3. Add to your project's `.continue/config.json`:
   ```json
   {
     "contextProviders": [
       {
         "name": "file",
         "params": { "file": ".macs/human/STATUS.md" }
       },
       {
         "name": "file",
         "params": { "file": "AGENT-GUIDE.md" }
       }
     ]
   }
   ```

Now Continue will always have MACS context loaded.

## Usage with Aider + Ollama

```bash
# Set Aider to use Ollama
export OLLAMA_API_BASE=http://localhost:11434

# Use the MACS-Aider wrapper with Ollama
MACS_MODEL=deepseek-coder \
  ./adapters/aider/macs-aider.sh \
  --model ollama/deepseek-coder:6.7b
```

## Usage with Python SDK

```python
import ollama
from adapters.python.pymacs import MACS

macs = MACS()

# Get context from MACS
status = macs.get_status_text()
task = macs.claim_task("local-agent")

if task:
    # Build prompt with MACS context
    prompt = f"""
{status}

You are working on task {task['id']}: {task['title']}
Follow AGENT-GUIDE.md rules for coordination.

Please implement the solution.
"""
    # Call local model
    response = ollama.chat(
        model='deepseek-coder:6.7b',
        messages=[{'role': 'user', 'content': prompt}]
    )

    # Record completion
    macs.complete_task("local-agent", task['id'],
        summary=response['message']['content'][:200]
    )
```

## Model Recommendations

| Model | Size | Best for |
|-------|------|----------|
| `deepseek-coder:1.3b` | 800MB | Fast, simple tasks |
| `deepseek-coder:6.7b` | 3.8GB | Good balance |
| `qwen2.5-coder:7b` | 4.1GB | Strong coding |
| `qwen2.5-coder:14b` | 8.2GB | Complex tasks |
| `codellama:13b` | 7.4GB | General coding |

## Multi-Agent Local Setup

Run multiple local agents on different terminals/machines:

```bash
# Machine 1 (backend agent)
MACS_AGENT_ID=local-backend \
MACS_CAPABILITIES=backend,typescript \
  ./adapters/aider/macs-aider.sh --model ollama/qwen2.5-coder:7b

# Machine 2 (frontend agent)
MACS_AGENT_ID=local-frontend \
MACS_CAPABILITIES=frontend,css \
  ./adapters/aider/macs-aider.sh --model ollama/deepseek-coder:6.7b

# They share .macs/ via Git — pull/push to sync
```

## Git Sync for Distributed Local Agents

MACS state lives in `.macs/protocol/*.jsonl` which are Git-tracked files.

```bash
# Add to .gitignore — don't ignore MACS protocol files
# (They should be committed)
echo "!.macs/protocol/" >> .gitignore

# Each agent syncs via Git
git pull && macs status     # see what others did
git add .macs/ && git commit -m "macs: agent-001 completed T-003"
git push
```

This gives you distributed multi-agent coordination with zero infrastructure.
