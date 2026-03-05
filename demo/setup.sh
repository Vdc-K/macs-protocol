#!/bin/bash
# MACS v3.0 Demo — Project Setup
#
# Creates a realistic demo project: "Claw SaaS Starter"
# 12 tasks · dependency chain · multi-priority · ready for swarm
#
# Usage:
#   ./demo/setup.sh [project-dir]
#   PROJECT_DIR=/tmp/claw-saas ./demo/setup.sh

set -e

PROJECT_DIR="${1:-${PROJECT_DIR:-/tmp/claw-saas-demo}}"
MACS_CMD="${MACS_CMD:-npx macs}"

# ── Colors ────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $*"; }
info() { echo -e "${CYAN}  →${NC} $*"; }

# ── Clean start ───────────────────────────────────────────────
if [ -d "$PROJECT_DIR" ]; then
  log "Removing existing demo project..."
  rm -rf "$PROJECT_DIR"
fi
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

log "Initializing MACS in $PROJECT_DIR"
$MACS_CMD init "Claw SaaS Starter"

# ── Create demo tasks ─────────────────────────────────────────
log "Creating 12 tasks..."

# Wave 1 — Foundation (no dependencies, can all start immediately)
$MACS_CMD create "Design system architecture + API contracts" \
  --priority critical --tags "architecture,planning" \
  --agent lead-opus

$MACS_CMD create "Set up database schema (users, orgs, sessions)" \
  --priority high --tags "database,backend" \
  --agent lead-opus

$MACS_CMD create "Configure CI/CD pipeline" \
  --priority high --tags "infra,devops" \
  --agent lead-opus

# Wave 2 — Core services (depend on wave 1)
$MACS_CMD create "Implement auth API (register, login, JWT, refresh)" \
  --priority high --tags "auth,backend,api" \
  --depends "T-001,T-002" \
  --affects "src/api/auth/*" \
  --agent lead-opus

$MACS_CMD create "Implement user + org CRUD endpoints" \
  --priority high --tags "backend,api" \
  --depends "T-001,T-002" \
  --affects "src/api/users/*,src/api/orgs/*" \
  --agent lead-opus

$MACS_CMD create "Build React auth components (login, register, forgot-pw)" \
  --priority medium --tags "frontend,ui,react" \
  --depends "T-001" \
  --affects "src/ui/auth/*" \
  --agent lead-opus

# Wave 3 — Integration (depend on wave 2)
$MACS_CMD create "Build React dashboard (overview, billing, settings)" \
  --priority medium --tags "frontend,ui,react" \
  --depends "T-004,T-006" \
  --affects "src/ui/dashboard/*" \
  --agent lead-opus

$MACS_CMD create "Write API integration tests (auth + CRUD)" \
  --priority medium --tags "testing,backend" \
  --depends "T-004,T-005" \
  --affects "tests/api/*" \
  --agent lead-opus

$MACS_CMD create "Stripe billing integration" \
  --priority medium --tags "billing,backend,api" \
  --depends "T-004,T-005" \
  --affects "src/api/billing/*" \
  --agent lead-opus

# Wave 4 — Polish (depend on wave 3)
$MACS_CMD create "Write E2E tests (Playwright, critical flows)" \
  --priority medium --tags "testing,e2e" \
  --depends "T-007,T-008" \
  --affects "tests/e2e/*" \
  --agent lead-opus

$MACS_CMD create "Write developer docs (API reference, quickstart)" \
  --priority low --tags "docs" \
  --depends "T-004,T-005,T-006,T-009" \
  --agent lead-opus

$MACS_CMD create "Deploy to staging + smoke test" \
  --priority high --tags "deploy,infra" \
  --depends "T-003,T-010" \
  --agent lead-opus

# ── Show result ───────────────────────────────────────────────
echo ""
log "Demo project ready!"
$MACS_CMD status
echo ""
echo -e "${GREEN}Next:${NC}"
echo "  cd $PROJECT_DIR"
echo "  macs swarm --agents \"lead:architect|eng1:backend,api|eng2:frontend,ui|qa:testing|devops:infra,deploy\" --simulate"
echo "  # or: ./demo/run.sh"
