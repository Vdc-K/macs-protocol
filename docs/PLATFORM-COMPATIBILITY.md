# MACS Platform Compatibility Matrix

> Complete guide to using MACS across different AI platforms

---

## 📊 Compatibility Matrix

| Platform | Support Level | Installation | Token Optimization | Dashboard | Notes |
|----------|--------------|--------------|-------------------|-----------|-------|
| **Claude Code** | ⭐⭐⭐⭐⭐ | `install.sh` | ✅ | ✅ | Native SKILL.md |
| **Cursor** | ⭐⭐⭐⭐⭐ | `install.sh` | ✅ | ✅ | .cursorrules auto-config |
| **Continue.dev** | ⭐⭐⭐⭐ | `install.sh` | ✅ | ✅ | Context providers |
| **OpenClaw** | ⭐⭐⭐⭐⭐ | `install.sh` | ✅ | ✅ | Native stigmergy |
| **ZeroClaw** | ⭐⭐⭐ | `install.sh` | ✅ | ✅ | Template-based |
| **NanoClaw** | ⭐⭐⭐ | `install.sh` | ✅ | ✅ | Template-based |
| **LangChain** | ⭐⭐⭐⭐ | `pip install` | ✅ | ✅ | Python SDK (pymacs) |
| **CrewAI** | ⭐⭐⭐⭐ | `pip install` | ✅ | ✅ | Python SDK (pymacs) |
| **AutoGen** | ⭐⭐⭐⭐ | `pip install` | ✅ | ✅ | Python SDK (pymacs) |
| **Windsurf** | ⭐⭐ | Manual | ⚠️ | ✅ | Untested |
| **VS Code + Copilot** | ⭐⭐ | Manual | ⚠️ | ✅ | Manual config |
| **Antigravity** | ❌ | N/A | ❌ | ❌ | No file system |
| **OpenAI Codex** | ⚠️ | Via LangChain | ⚠️ | ✅ | Needs orchestration |

**Legend:**
- ⭐⭐⭐⭐⭐ = Full support, tested
- ⭐⭐⭐⭐ = Full support, community-tested
- ⭐⭐⭐ = Basic support, needs manual config
- ⭐⭐ = Experimental
- ❌ = Not compatible
- ⚠️ = Limited / untested

---

## 🚀 Installation Guides

### Claude Code

**Automatic Installation**:
```bash
cd your-project
/path/to/macs/install.sh
```

**What Happens**:
1. Creates `.claude/skills/macs/SKILL.md`
2. Copies templates (TASK.md, CHANGELOG.md, CONTEXT.md)
3. Generates index

**Usage**:
```
/macs init "Project Name"
/macs status
/macs dashboard
```

**Docs**: [adapters/claude-code/README.md](../adapters/claude-code/README.md)

---

### Cursor

**Automatic Installation**:
```bash
cd your-project
/path/to/macs/install.sh
```

**What Happens**:
1. Copies templates
2. Appends MACS instructions to `.cursorrules`
3. Generates index

**Usage**:
- Cursor automatically reads `.cursorrules`
- No special commands needed
- Update CHANGELOG.md after changes

**Docs**: [adapters/cursor/README.md](../adapters/cursor/README.md)

---

### Continue.dev

**Automatic Installation**:
```bash
cd your-project
/path/to/macs/install.sh
```

**What Happens**:
1. Copies templates
2. Creates `.continue/config.json` with MACS context providers
3. Generates index

**Usage**:
```
@macs-task What are the current tasks?
@macs-changelog What changed recently?
/macs-update Update CHANGELOG with my changes
```

**Docs**: [adapters/continue/README.md](../adapters/continue/README.md)

---

### OpenClaw / ZeroClaw / NanoClaw

**Installation**:
```bash
cd your-project
/path/to/macs/install.sh
```

**What Happens**:
- Copies templates (OpenClaw natively supports stigmergy)
- Generates index

**Usage**:
- OpenClaw automatically reads MACS documents
- No special configuration needed

**Docs**: [adapters/openclaw/README.md](../adapters/openclaw/README.md)

---

### LangChain / CrewAI / AutoGen (Python)

**Installation**:
```bash
pip install pymacs
```

**Usage**:
```python
from pymacs import MACS

# Initialize
macs = MACS.init("My Project", path="./my-project")

# Query recent changes
changes = macs.query_changelog(type='feat', since='2026-02-20')

# Add entry
macs.add_changelog(
    type='feat',
    content='Implemented new feature',
    author='langchain-agent',
    tags=['#dev', '#api']
)

# Generate index (for token optimization)
macs.generate_index()
```

**LangChain Integration**:
```python
from pymacs import create_macs_tools
from langchain.agents import initialize_agent

tools = create_macs_tools(project_path="./my-project")
agent = initialize_agent(tools, llm, agent="zero-shot-react-description")

agent.run("What are the recent changes?")
agent.run("Add a changelog entry: Implemented user auth")
```

**Docs**: [adapters/langchain/README.md](../adapters/langchain/README.md)

---

### VS Code (Generic)

**Manual Installation**:
```bash
cd your-project
/path/to/macs/install.sh
```

**Configuration** (for GitHub Copilot / other extensions):

1. Add to workspace settings (`.vscode/settings.json`):
```json
{
  "github.copilot.chat.welcome": [
    "Before starting work, read TASK.md, CHANGELOG.md, CONTEXT.md",
    "After changes, update CHANGELOG.md with: [type] description - by copilot #tags"
  ]
}
```

2. Use in prompts:
```
@workspace Read TASK.md and tell me what to work on next
```

**Docs**: [adapters/vscode/README.md](../adapters/vscode/README.md)

---

## 🔧 Advanced Integrations

### GitHub Actions

Automate weekly reports:

```yaml
# .github/workflows/macs-weekly-report.yml
name: MACS Weekly Report

on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday midnight

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Generate weekly report
        run: npx macs weekly-report
      - name: Commit report
        run: |
          git config user.name "MACS Bot"
          git add WEEKLY-REPORT.md
          git commit -m "chore: weekly MACS report"
          git push
```

---

### Docker

Run MACS dashboard in Docker:

```bash
docker run -v $(pwd):/project -p 3456:3456 macs/dashboard
```

Generate index in Docker:

```bash
docker run -v $(pwd):/project macs/cli index /project
```

---

### CI/CD Integration

**GitLab CI**:
```yaml
macs-index:
  stage: build
  script:
    - npm install -g macs-cli
    - macs index .
  artifacts:
    paths:
      - .macs/index.json
```

**Jenkins**:
```groovy
stage('MACS Index') {
  steps {
    sh 'macs index .'
  }
}
```

---

## 📊 Feature Comparison

| Feature | CLI | Claude Code | Cursor | LangChain | Continue |
|---------|-----|-------------|--------|-----------|----------|
| **Auto-detect platform** | ✅ | N/A | N/A | N/A | N/A |
| **Token optimization** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Auto-update CHANGELOG** | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| **Git integration** | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **Multi-agent sync** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Escalation tracking** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Weekly reports** | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |

---

## 🆕 Upcoming Platforms

### Planned Support (v2.4+)

- **Windsurf (Codeium)** - Full support planned
- **Zed Editor** - Investigating
- **Neovim + AI plugins** - Community request
- **JetBrains AI Assistant** - Investigating
- **Amazon CodeWhisperer** - Low priority

---

## 🤝 Contributing Platform Adapters

Want to add support for a new platform?

1. Create `adapters/{platform}/`
2. Add installation script
3. Write README with usage examples
4. Test with real projects
5. Submit PR with compatibility info

**Template**: [adapters/_template/](../adapters/_template/)

---

## 📞 Support

**Platform-specific issues**:
- Claude Code: GitHub Issues with `platform:claude-code` label
- Cursor: GitHub Issues with `platform:cursor` label
- LangChain: GitHub Issues with `platform:langchain` label

**General questions**: GitHub Discussions

---

## 📄 License

MIT © 2026 HH & OpenClaw Community
