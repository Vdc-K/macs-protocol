#!/usr/bin/env bash
# MACS × PACEflow — Hook Installer
# Usage: bash adapters/paceflow/install.sh [--project-dir <path>]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-$(pwd)}"

# Parse --project-dir flag
while [[ $# -gt 0 ]]; do
  case $1 in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

HOOKS_DIR="$PROJECT_DIR/.claude/hooks"
SETTINGS="$PROJECT_DIR/.claude/settings.json"

echo "📦 Installing MACS × PACEflow hooks..."
echo "   Project: $PROJECT_DIR"
echo "   Hooks:   $HOOKS_DIR"

# Create hooks directory
mkdir -p "$HOOKS_DIR"

# Copy hook scripts
cp "$SCRIPT_DIR/pre-tool-use.js"  "$HOOKS_DIR/macs-pre-tool-use.js"
cp "$SCRIPT_DIR/stop.js"          "$HOOKS_DIR/macs-stop.js"
cp "$SCRIPT_DIR/session-start.js" "$HOOKS_DIR/macs-session-start.js"

echo "✅ Hook files copied"

# Merge into settings.json
if command -v node &>/dev/null; then
  node - "$SETTINGS" "$SCRIPT_DIR/hooks.json" <<'EOF'
import { readFileSync, writeFileSync, existsSync } from 'fs'
const [,, settingsPath, hooksPath] = process.argv

const newHooks = JSON.parse(readFileSync(hooksPath, 'utf-8')).hooks
const settings = existsSync(settingsPath)
  ? JSON.parse(readFileSync(settingsPath, 'utf-8'))
  : {}

if (!settings.hooks) settings.hooks = {}

// Merge: append our hooks without removing existing ones
for (const [event, entries] of Object.entries(newHooks)) {
  if (!settings.hooks[event]) {
    settings.hooks[event] = entries
  } else {
    // Avoid duplicates
    for (const entry of entries) {
      const exists = settings.hooks[event].some(e =>
        JSON.stringify(e) === JSON.stringify(entry)
      )
      if (!exists) settings.hooks[event].push(entry)
    }
  }
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
console.log('✅ settings.json updated')
EOF
else
  echo "⚠️  Node.js not found — manually add hooks from adapters/paceflow/hooks.json to .claude/settings.json"
fi

echo ""
echo "🎉 Done! MACS × PACEflow hooks are active."
echo ""
echo "How it works:"
echo "  • Write/Edit blocked until .macs/pace/{task-id}/plan.md exists"
echo "  • Stop blocked if in-progress tasks have no checkpoint"
echo "  • Session start shows active tasks + creates plan templates"
echo ""
echo "To disable: remove .claude/hooks/macs-*.js and update .claude/settings.json"
