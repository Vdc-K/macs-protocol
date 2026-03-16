#!/usr/bin/env bash
# MACS Universal Installer
# Automatically detects platform and installs MACS

set -e

VERSION="2.3.0"
MACS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Banner
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  MACS Universal Installer v${VERSION}      ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Multi-Agent Collaboration System         ${BLUE}║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Get target directory
TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"
PROJECT_NAME="${2:-$(basename $(pwd))}"

print_info "Target directory: $(pwd)"
print_info "Project name: $PROJECT_NAME"
echo ""

# Detect platform
detect_platform() {
  # Check for Claude Code
  if [ -f ".claude/settings.local.json" ] || [ -d ".claude" ]; then
    echo "claude-code"
    return
  fi

  # Check for Cursor
  if [ -f ".cursorrules" ] || command -v cursor &> /dev/null; then
    echo "cursor"
    return
  fi

  # Check for Continue.dev
  if [ -f ".continuerc.json" ] || [ -f ".continue/config.json" ]; then
    echo "continue"
    return
  fi

  # Check for OpenClaw
  if command -v openclaw &> /dev/null; then
    echo "openclaw"
    return
  fi

  # Check for ZeroClaw
  if command -v zeroclaw &> /dev/null; then
    echo "zeroclaw"
    return
  fi

  # Check for NanoClaw
  if command -v nanoclaw &> /dev/null; then
    echo "nanoclaw"
    return
  fi

  # Check for VS Code
  if [ -d ".vscode" ] || command -v code &> /dev/null; then
    echo "vscode"
    return
  fi

  # Default: generic
  echo "generic"
}

PLATFORM=$(detect_platform)

print_info "Detected platform: ${PLATFORM}"
echo ""

# Install based on platform
case "$PLATFORM" in
  claude-code)
    print_success "Claude Code detected!"
    echo ""

    # Create .claude/skills/macs if not exists
    mkdir -p .claude/skills/macs

    # Copy SKILL.md
    if [ -f "$MACS_DIR/SKILL.md" ]; then
      cp "$MACS_DIR/SKILL.md" .claude/skills/macs/SKILL.md
      print_success "Installed MACS skill to .claude/skills/macs/"
    fi

    # Initialize templates
    macs init "$PROJECT_NAME"

    echo ""
    print_success "MACS installed for Claude Code!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart Claude Code (or run: source ~/.zshrc)"
    echo "  2. Type /macs to use MACS commands"
    echo "  3. Run: macs add 'First task' to create a task"
    echo "  4. Run: macs status (TASK.md is auto-generated)"
    ;;

  cursor)
    print_success "Cursor detected!"
    echo ""

    # Copy templates
    macs init "$PROJECT_NAME"

    # Check if .cursorrules exists
    if [ -f ".cursorrules" ]; then
      print_warning ".cursorrules already exists. Appending MACS instructions..."
      echo "" >> .cursorrules
    fi

    # Append MACS instructions to .cursorrules
    cat >> .cursorrules << 'EOF'

# ═══════════════════════════════════════════════════════════
# MACS (Multi-Agent Collaboration System)
# ═══════════════════════════════════════════════════════════

## 📋 Before Starting Work

Check project status via CLI:
\`\`\`bash
macs status          # Current task board
macs log --limit 5   # Recent activity
\`\`\`
TASK.md and CHANGELOG.md in \`human/\` are auto-generated — read them for context but never edit manually.

## ✍️ After Completing Work

Use CLI to record progress (human docs update automatically):
\`\`\`bash
macs done <task-id> --summary "What you did"
\`\`\`

## 🚨 If Blocked

\`\`\`bash
macs block <task-id> --reason "Why blocked" --next "What needs to happen"
\`\`\`

## 📊 Token Optimization

Check task board and project status efficiently:
```bash
# View current task board
macs status

# View workload across agents
macs workload
```

## 🎯 Collaboration Protocol

- Run \`macs status\` to know current priorities
- Use \`macs done/checkpoint/block\` to record progress (human docs auto-update)
- Use \`macs log --limit 10\` to review recent activity
- Identify yourself as "cursor-agent" in CHANGELOG

EOF

    print_success "Added MACS instructions to .cursorrules"

    echo ""
    print_success "MACS installed for Cursor!"
    echo ""
    echo "Next steps:"
    echo "  1. Cursor will automatically read .cursorrules"
    echo "  2. Run: macs add 'First task' to add your first task"
    echo "  3. Start working with Cursor Agent (TASK.md is auto-generated)"
    echo "  4. Run: macs status (to view progress)"
    ;;

  continue)
    print_success "Continue.dev detected!"
    echo ""

    # Copy templates
    macs init "$PROJECT_NAME"

    # Create .continue directory if not exists
    mkdir -p .continue

    # Add MACS context provider to config
    if [ -f ".continue/config.json" ]; then
      print_warning ".continue/config.json exists. Manual integration required."
      print_info "Add MACS files to contextProviders in .continue/config.json"
    else
      cat > .continue/config.json << 'EOF'
{
  "contextProviders": [
    {
      "name": "macs-task",
      "params": {
        "filepath": "human/TASK.md"
      }
    },
    {
      "name": "macs-changelog",
      "params": {
        "filepath": "human/CHANGELOG.md"
      }
    },
    {
      "name": "macs-context",
      "params": {
        "filepath": "human/STATUS.md"
      }
    }
  ],
  "slashCommands": [
    {
      "name": "macs-update",
      "description": "Update MACS documents after work",
      "prompt": "Run 'macs done <task-id> --summary \"description\"' to record completion. Human docs auto-update."
    }
  ]
}
EOF
      print_success "Created .continue/config.json with MACS integration"
    fi

    echo ""
    print_success "MACS installed for Continue.dev!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart VS Code"
    echo "  2. Use @macs-task, @macs-changelog, @macs-context in prompts"
    echo "  3. Run: macs add 'First task' (TASK.md auto-generates)"
    ;;

  openclaw)
    print_success "OpenClaw detected!"
    echo ""

    # OpenClaw natively supports stigmergy (event-sourcing collaboration)
    macs init "$PROJECT_NAME"

    print_success "MACS event store initialized!"
    print_info "OpenClaw natively supports MACS event-sourcing protocol."

    echo ""
    print_success "MACS installed for OpenClaw!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: macs add 'First task' to create a task"
    echo "  2. OpenClaw agents use MACS CLI to coordinate (human docs auto-generate)"
    echo "  3. Run: macs status"
    ;;

  zeroclaw|nanoclaw)
    print_success "${PLATFORM} detected!"
    echo ""

    # Copy templates
    macs init "$PROJECT_NAME"

    print_success "MACS templates installed!"

    echo ""
    print_success "MACS installed for ${PLATFORM}!"
    echo ""
    echo "Next steps:"
    echo "  1. Configure ${PLATFORM} to issue MACS CLI commands (macs add, macs log)"
    echo "  2. Run: macs add 'First task' to add your first task"
    echo "  3. Run: macs status"
    ;;

  vscode)
    print_success "VS Code detected!"
    echo ""

    # Copy templates
    macs init "$PROJECT_NAME"

    print_warning "VS Code detected but no specific AI assistant found."
    print_info "MACS templates have been installed."
    print_info "You can use MACS with:"
    print_info "  - Continue.dev (install extension)"
    print_info "  - GitHub Copilot Chat"
    print_info "  - Any VS Code AI extension"

    echo ""
    print_success "MACS event store initialized!"
    echo ""
    echo "Next steps:"
    echo "  1. Install an AI assistant extension (Continue, Copilot, etc.)"
    echo "  2. Configure it to issue MACS CLI commands (macs add, macs log)"
    echo "  3. Run: macs add 'First task' to add your first task"
    ;;

  generic)
    print_warning "No specific platform detected."
    echo ""

    # Copy templates
    macs init "$PROJECT_NAME"

    print_success "MACS templates installed!"

    echo ""
    print_info "Manual configuration required for your platform."
    echo ""
    echo "To use MACS:"
    echo "  1. Configure your AI agent to use MACS CLI commands:"
    echo "     - macs status       (view task board)"
    echo "     - macs log          (view event history)"
    echo "     - macs workload     (agent workload overview)"
    echo ""
    echo "  2. After each change, mark tasks done via CLI:"
    echo "     - macs done <id>    (mark task complete)"
    echo "     (TASK.md and CHANGELOG.md are auto-generated)"
    echo ""
    echo "  3. Run: macs status (to view progress)"
    ;;
esac

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
print_success "Installation complete!"
echo ""
print_info "Documentation: https://github.com/your-org/macs"
print_info "Issues: https://github.com/your-org/macs/issues"
echo ""
