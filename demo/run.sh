#!/bin/bash
# MACS v3.0 Demo — Swarm Run
#
# Full end-to-end demo: setup → swarm → results
# Designed for screen recording: clean output, paced timing
#
# Usage:
#   ./demo/run.sh [--fast] [--agents N]
#
# Options:
#   --fast       delay=200ms (vs default 800ms)
#   --agents N   override agent count (default: 5)

set -e

DEMO_DIR="${PROJECT_DIR:-/tmp/claw-saas-demo}"
MACS_CMD="${MACS_CMD:-npx macs}"
DELAY=800
AGENT_SPEC="lead:architect,planner|eng1:backend,api|eng2:frontend,ui|qa:testing,e2e|devops:infra,deploy"

# ── Parse flags ───────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fast)        DELAY=200; shift ;;
    --agents)      AGENT_SPEC="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}$*${NC}"; }
pause()  { sleep "${PAUSE_SEC:-1}"; }

clear

# ── Title card ────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   MACS Protocol v3.0 — Multi-Agent Swarm Demo       ║"
echo "  ║   \"Git for AI Agents\"                               ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
pause

# ── Step 1: Setup ─────────────────────────────────────────────
header "Step 1 — Initialize project: Claw SaaS Starter"
echo ""
echo -e "  ${YELLOW}\$${NC} macs init \"Claw SaaS Starter\""
pause

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACS_CMD="$MACS_CMD" PROJECT_DIR="$DEMO_DIR" bash "$SCRIPT_DIR/setup.sh" 2>&1 | grep -v "^\[setup\]" | head -30 || true

pause

# ── Step 2: Show task graph ────────────────────────────────────
header "Step 2 — Project task graph (12 tasks, 4 dependency waves)"
echo ""
cd "$DEMO_DIR"
$MACS_CMD status
pause; pause

# ── Step 3: Swarm ─────────────────────────────────────────────
header "Step 3 — Launch swarm: 5 specialized agents"
echo ""
echo -e "  ${YELLOW}\$${NC} macs swarm --agents \"$AGENT_SPEC\" --simulate"
echo ""
pause

cd "$DEMO_DIR"
$MACS_CMD swarm --agents "$AGENT_SPEC" --simulate --delay "$DELAY"
pause

# ── Step 4: Final state ────────────────────────────────────────
header "Step 4 — Final project state"
echo ""
cd "$DEMO_DIR"
$MACS_CMD status
pause

# ── Step 5: Event log ─────────────────────────────────────────
header "Step 5 — Event log (every action is immutably recorded)"
echo ""
cd "$DEMO_DIR"
$MACS_CMD log --limit 15
pause

# ── Step 6: Human-readable output ─────────────────────────────
header "Step 6 — Auto-generated Markdown (for humans)"
echo ""
echo -e "  ${YELLOW}\$${NC} cat .macs/human/STATUS.md"
echo ""
if [ -f "$DEMO_DIR/.macs/human/STATUS.md" ]; then
  cat "$DEMO_DIR/.macs/human/STATUS.md"
else
  cd "$DEMO_DIR" && $MACS_CMD generate
  cat "$DEMO_DIR/.macs/human/STATUS.md"
fi
pause

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ══════════════════════════════════════════════════════"
echo "  MACS Protocol v3.0 — Key Properties Demonstrated:"
echo ""
echo "    ✅  Append-only JSONL — zero git conflicts"
echo "    ✅  Dependency-aware scheduling — waves complete in order"
echo "    ✅  Any agent can boot and pick up where another left off"
echo "    ✅  Forced handoffs — no context lost between sessions"
echo "    ✅  Drift detection — silent agents are automatically flagged"
echo "    ✅  Auto-generated Markdown — humans always have a readable view"
echo ""
echo "  npx macs swarm --agents 20 --simulate"
echo "  ══════════════════════════════════════════════════════"
echo -e "${NC}"
