#!/bin/bash
# MACS × OpenClaw Swarm Launcher
#
# Launches multiple OpenClaw sessions for a MACS swarm.
# Uses tmux for real mode, or delegates to `macs swarm --simulate` for simulation.
#
# Usage:
#   ./swarm.sh --agents 4 --simulate                          # demo mode
#   ./swarm.sh --agents "opus:architect|sonnet:backend|haiku:qa"  # real mode (tmux)
#   ./swarm.sh --agents 3 --capabilities backend,testing      # real mode, auto-named
#
# Environment:
#   MACS_CMD   — macs binary path (default: macs)
#   MACS_BOOT  — command to launch OpenClaw (default: claude)

set -e

MACS_CMD="${MACS_CMD:-macs}"
OPENCLAW_CMD="${MACS_BOOT:-claude}"

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[swarm]${NC} $*"; }
warn() { echo -e "${YELLOW}[swarm]${NC} $*"; }
info() { echo -e "${CYAN}[swarm]${NC} $*"; }

# ── Arg parsing ───────────────────────────────────────────────
AGENTS_SPEC=""
SIMULATE=false
DELAY=800
CAPABILITIES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents)       AGENTS_SPEC="$2"; shift 2 ;;
    --simulate)     SIMULATE=true; shift ;;
    --delay)        DELAY="$2"; shift 2 ;;
    --capabilities) CAPABILITIES="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --agents \"name:caps|...\" [--simulate] [--delay MS]"
      echo "       $0 --agents N [--capabilities cap1,cap2] [--simulate]"
      exit 0
      ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [ -z "$AGENTS_SPEC" ]; then
  echo "Error: --agents required"
  echo "Usage: $0 --agents 4 --simulate"
  exit 1
fi

# ── Simulation Mode ───────────────────────────────────────────
if [ "$SIMULATE" = true ]; then
  log "Simulation mode — delegating to macs swarm"
  SWARM_ARGS="--agents \"$AGENTS_SPEC\" --simulate --delay $DELAY"
  if [ -n "$CAPABILITIES" ]; then
    SWARM_ARGS="$SWARM_ARGS --capabilities $CAPABILITIES"
  fi
  eval "$MACS_CMD swarm $SWARM_ARGS"
  exit $?
fi

# ── Real Mode — parse agents ──────────────────────────────────
declare -a AGENT_NAMES=()
declare -A AGENT_CAPS=()

parse_agents() {
  local spec="$1"
  # Check if numeric
  if [[ "$spec" =~ ^[0-9]+$ ]]; then
    local count="$spec"
    for ((i=1; i<=count; i++)); do
      local name="swarm-$i"
      AGENT_NAMES+=("$name")
      AGENT_CAPS["$name"]="${CAPABILITIES:-}"
    done
  else
    IFS='|' read -ra PARTS <<< "$spec"
    for part in "${PARTS[@]}"; do
      local name="${part%%:*}"
      local caps="${part#*:}"
      if [ "$caps" = "$name" ]; then caps="${CAPABILITIES:-}"; fi
      name="${name// /}"
      AGENT_NAMES+=("$name")
      AGENT_CAPS["$name"]="$caps"
    done
  fi
}

parse_agents "$AGENTS_SPEC"

if [ ${#AGENT_NAMES[@]} -eq 0 ]; then
  echo "Error: no agents parsed from '$AGENTS_SPEC'"
  exit 1
fi

log "Real swarm mode — ${#AGENT_NAMES[@]} agent(s)"

# ── Assign tasks via macs swarm ───────────────────────────────
log "Auto-assigning tasks..."
if [ -n "$CAPABILITIES" ]; then
  $MACS_CMD swarm --agents "$AGENTS_SPEC" --capabilities "$CAPABILITIES"
else
  $MACS_CMD swarm --agents "$AGENTS_SPEC"
fi

echo ""

# ── Launch sessions ───────────────────────────────────────────
if command -v tmux &>/dev/null; then
  # ── tmux mode: one pane per agent ────────────────────────────
  SESSION="macs-swarm-$$"
  log "Launching tmux session: $SESSION"

  first=true
  for name in "${AGENT_NAMES[@]}"; do
    caps="${AGENT_CAPS[$name]:-}"
    boot_cmd="$MACS_CMD boot --agent $name"
    if [ -n "$caps" ]; then
      boot_cmd="$boot_cmd --capabilities $caps"
    fi
    # Wrap in openclaw call if available
    if command -v "$OPENCLAW_CMD" &>/dev/null; then
      agent_cmd="$OPENCLAW_CMD --prompt \"$(printf '%q' "$boot_cmd")\""
    else
      # Fallback: just show the macs boot output
      agent_cmd="bash -c '$boot_cmd; echo; echo Press Enter to continue...; read'"
    fi

    if [ "$first" = true ]; then
      tmux new-session -d -s "$SESSION" -n "$name" "bash -c '$agent_cmd'"
      first=false
    else
      tmux new-window -t "$SESSION" -n "$name" "bash -c '$agent_cmd'"
    fi
    info "  Launched: $name"
  done

  log "Attaching to tmux session (Ctrl+B then N/P to switch agents, Ctrl+B D to detach)"
  echo ""
  tmux attach-session -t "$SESSION"

else
  # ── No tmux: print instructions ───────────────────────────────
  warn "tmux not found — manual launch required"
  echo ""
  echo "Open separate terminals and run:"
  echo ""
  for name in "${AGENT_NAMES[@]}"; do
    caps="${AGENT_CAPS[$name]:-}"
    boot_args="--agent $name"
    if [ -n "$caps" ]; then
      boot_args="$boot_args --capabilities $caps"
    fi
    if command -v "$OPENCLAW_CMD" &>/dev/null; then
      echo "  # Terminal: $name"
      echo "  $OPENCLAW_CMD --prompt \"macs boot $boot_args\""
    else
      echo "  macs boot $boot_args"
    fi
    echo ""
  done
fi
