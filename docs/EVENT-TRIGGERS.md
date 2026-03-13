# Event Triggers for MACS

> Auto-trigger agent tasks based on time or file changes.

## Overview

MACS is document-driven but passive. Agents don't act unless prompted. Event triggers solve this by automatically invoking agents when conditions are met.

**Common triggers**:
- **Weekly cleanup**: Archive old CHANGELOG/TASK entries every Sunday
- **Pattern aggregation**: Generate weekly report when 7+ days pass
- **File size check**: Alert when CHANGELOG exceeds 2k tokens

---

## Implementation Options

### Option 1: cron + Local API

**Setup** (Linux/macOS):
```bash
# Edit crontab
crontab -e

# Add weekly cleanup (every Sunday at 00:00)
0 0 * * 0 /path/to/macs-weekly-cleanup.sh
```

**Script** (`macs-weekly-cleanup.sh`):
```bash
#!/bin/bash
cd /path/to/your-project

# Call your preferred LLM API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-3-5-20250205",
    "max_tokens": 4096,
    "messages": [{
      "role": "user",
      "content": "You are the Maintainer. Read CHANGELOG.md and archive entries older than 2 weeks to archive/CHANGELOG-YYYY-MM.md. Then read all CHANGELOG entries from the last 7 days and generate WEEKLY-REPORT.md."
    }]
  }'
```

**Pros**: Simple, platform-agnostic
**Cons**: Requires API keys, manual setup

---

### Option 2: GitHub Actions

**Setup** (`.github/workflows/macs-weekly.yml`):
```yaml
name: MACS Weekly Maintenance
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday at 00:00 UTC
  workflow_dispatch:  # Manual trigger

jobs:
  weekly-cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Weekly Archive & Report
        uses: anthropic-ai/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are the Maintainer (cost-effective model).
            1. Read CHANGELOG.md
            2. Archive entries older than 2 weeks to archive/CHANGELOG-YYYY-MM.md
            3. Read CHANGELOG from last 7 days
            4. Generate WEEKLY-REPORT.md with pattern discovery
          model: claude-haiku-3-5-20250205

      - name: Commit changes
        run: |
          git config user.name "MACS Bot"
          git config user.email "bot@macs.dev"
          git add .
          git commit -m "chore: weekly maintenance" || echo "No changes"
          git push
```

**Pros**: Zero local setup, works for public repos
**Cons**: GitHub-specific, requires secrets

---

### Option 3: mycc Scheduler Integration

**For Claude Code + mycc users** (recommended if you already have mycc running):

**Setup**:
```json
// Add to mycc scheduler config
{
  "name": "macs-weekly-cleanup",
  "schedule": "0 0 * * 0",
  "task": {
    "type": "cc-session",
    "cwd": "/path/to/your-project",
    "prompt": "You are the Maintainer. Archive old CHANGELOG entries and generate WEEKLY-REPORT.md.",
    "model": "claude-haiku-3-5-20250205"
  }
}
```

**Pros**: Integrates with existing mycc infrastructure, works across all projects
**Cons**: Requires mycc to be running

---

### Option 4: File Watcher (Advanced)

**Use case**: Trigger actions when CHANGELOG grows too large.

**Script** (`macs-watcher.py`):
```python
import os
import time
from anthropic import Anthropic

def check_changelog_size():
    with open('CHANGELOG.md') as f:
        content = f.read()
        # Rough token count (4 chars ≈ 1 token)
        token_estimate = len(content) / 4

        if token_estimate > 2000:
            print("⚠️  CHANGELOG exceeds 2k tokens, triggering archive...")
            client = Anthropic()
            response = client.messages.create(
                model="claude-haiku-3-5-20250205",
                messages=[{
                    "role": "user",
                    "content": "Archive CHANGELOG entries older than 2 weeks."
                }]
            )
            # Execute returned commands...

while True:
    check_changelog_size()
    time.sleep(3600)  # Check every hour
```

**Pros**: Proactive, prevents context overflow
**Cons**: Needs daemon process

---

## Recommended Setup by Platform

| Platform | Recommendation |
|----------|----------------|
| **Claude Code + mycc** | Option 3 (mycc scheduler) |
| **GitHub-hosted projects** | Option 2 (GitHub Actions) |
| **Local development** | Option 1 (cron) |
| **Advanced users** | Option 4 (file watcher) |

---

## Cost Optimization

**Use cost-effective models for maintenance**:
- Haiku ($0.25/MTok input, $1.25/MTok output)
- GPT-3.5-turbo ($0.50/MTok)
- Gemini Flash ($0.075/MTok)

**Example cost** (weekly cleanup):
- Input: ~3k tokens (read CHANGELOG + TASK)
- Output: ~1k tokens (write archive + weekly report)
- **Cost per week**: $0.0015 (Haiku) = **$0.08/year**

---

## Testing

**Dry run** before setting up cron:
```bash
# Test weekly cleanup script
./macs-weekly-cleanup.sh --dry-run

# Check output
cat WEEKLY-REPORT.md
git diff  # See what would be archived
```

---

## Troubleshooting

**Q: Cron job not running?**
- Check cron logs: `grep CRON /var/log/syslog`
- Ensure script has execute permissions: `chmod +x macs-weekly-cleanup.sh`
- Use absolute paths in scripts (cron has limited $PATH)

**Q: GitHub Action fails?**
- Check if `ANTHROPIC_API_KEY` secret is set
- Verify workflow syntax: `https://crontab.guru`

**Q: mycc scheduler not triggering?**
- Check mycc status: `/mycc status`
- View scheduler logs: `pm2 logs mycc | grep scheduler`
