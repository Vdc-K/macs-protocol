# Enterprise Multi-Agent Team Coordination

> How to coordinate multiple agent teams (each with subagents) on large-scale projects.

## Challenge

**Scenario**: Building an e-commerce platform with 50 agents across 5 teams.

**Problems**:
1. How do teams know what others are doing?
2. How to prevent conflicting changes?
3. How to ensure project-wide consistency?
4. How to track overall progress?
5. How to handle cross-team dependencies?

---

## Hierarchical Architecture

```
Enterprise Project (E-Commerce Platform)
├── Meta Coordination Layer (1 Project Lead)
│   ├── PROJECT-STATUS.md (overall progress)
│   ├── TEAM-CONTRACTS.md (team interfaces)
│   └── DEPENDENCIES.md (cross-team blockers)
│
├── Team A: Frontend (5 agents)
│   ├── TEAM-TASK.md (team-level tasks)
│   ├── TEAM-CHANGELOG.md (team changes)
│   └── TEAM-CONTEXT.md (team decisions)
│
├── Team B: Backend (5 agents)
│   ├── TEAM-TASK.md
│   ├── TEAM-CHANGELOG.md
│   └── TEAM-CONTEXT.md
│
├── Team C: DevOps (3 agents)
│   └── ...
│
└── Team D: QA (2 agents)
    └── ...
```

---

## 1. Team Contracts (Interface Definitions)

**Purpose**: Each team defines its public API/contract. Other teams depend on contracts, not implementations.

### TEAM-CONTRACTS.md (Project Root)

```markdown
# Team Contracts

## Frontend Team

**Responsibilities**:
- Deliver React components for all user-facing pages
- Ensure mobile responsiveness
- Integrate with Backend API

**Provides** (Deliverables):
- `/components/{feature}` - Reusable React components
- `/pages/{route}` - Full page implementations
- `/api-client/` - Backend API wrapper

**Requires** (Dependencies):
- Backend API endpoints (see Backend contract)
- Design system (Figma link)

**SLA**:
- API breaking changes: 1 week notice
- Bug fixes: Within 2 business days
- New features: Discussed in weekly sync

---

## Backend Team

**Responsibilities**:
- REST API endpoints
- Database schema
- Authentication/authorization

**Provides**:
- API Documentation (`/docs/api.md`)
- Database migrations (`/db/migrations/`)
- Auth middleware (`/middleware/auth.ts`)

**Requires**:
- Frontend to follow API versioning (`/api/v1/`)
- DevOps to provide staging environment

**SLA**:
- Endpoint downtime < 1%
- Response time < 200ms (p95)

---

## DevOps Team

**Provides**:
- CI/CD pipeline
- Staging/production environments
- Monitoring dashboards

**Requires**:
- Teams to follow deployment checklist
- Dockerfile in each service

---

## QA Team

**Provides**:
- Automated test suites
- Bug reports
- Release sign-off

**Requires**:
- All teams to write unit tests (>80% coverage)
```

---

## 2. Cross-Team Dependency Tracking

### DEPENDENCIES.md (Project Root)

```markdown
# Cross-Team Dependencies

> Updated by Project Lead after daily stand-ups.

## Active Dependencies

| Blocked Team | Waiting For | Owner Team | ETA | Status |
|--------------|-------------|------------|-----|--------|
| Frontend | `/api/v1/products` endpoint | Backend | 2026-03-01 | 🟡 In Progress |
| Backend | User auth design | Frontend | 2026-02-29 | 🟢 Completed |
| QA | Staging environment | DevOps | 2026-02-28 | 🔴 Blocked |

## Resolution Process

1. **Blocked team** escalates to Project Lead
2. **Project Lead** updates DEPENDENCIES.md
3. **Owner team** provides ETA or escalates if blocked
4. **Daily sync**: Review all 🔴 Blocked items first
```

---

## 3. Daily Sync Protocol

**Every morning** (automated via scheduler):

```
Project Lead Agent (Opus):
1. Read all team TEAM-CHANGELOG.md files
2. Identify:
   - New cross-team dependencies
   - Conflicting changes (e.g., both teams modifying same file)
   - Missed SLA commitments
3. Generate PROJECT-STATUS.md update
4. Flag blockers in DEPENDENCIES.md
5. Notify team leads (via TASK.md escalations)
```

### PROJECT-STATUS.md Example

```markdown
# Project Status - 2026-02-28

## Overall Health: 🟡 At Risk

### Teams On Track
- ✅ Frontend: 85% complete
- ✅ Backend: 78% complete

### Teams Behind Schedule
- ⚠️ DevOps: Staging environment delayed 3 days
- ⚠️ QA: Blocked by staging delay

### Critical Issues
1. **Dependency Blocker**: QA cannot start testing until DevOps delivers staging
   - Owner: DevOps Lead
   - Action: Escalate to Project Lead for resourcing

2. **API Version Mismatch**: Frontend using `/api/v2/`, Backend only published `/api/v1/`
   - Owner: Both teams
   - Action: Emergency sync meeting scheduled

### Metrics
- Velocity: 42 tasks completed this week (target: 50)
- Quality: 12 bugs reported, 8 resolved
- Blockers: 3 active (see DEPENDENCIES.md)
```

---

## 4. Conflict Prevention via Git Branching

**Strategy**: Each team has its own branch + protected main.

```
main (protected - requires all team approvals)
├── team/frontend
├── team/backend
├── team/devops
└── team/qa
```

**Merge Process**:
1. Team completes milestone on `team/{name}` branch
2. Team Lead creates PR to `main`
3. **Automated checks**:
   - All team tests pass
   - No conflicts with other team PRs
   - Contracts (TEAM-CONTRACTS.md) not violated
4. **Manual review**:
   - Project Lead reviews cross-team impacts
   - Other affected teams review changes
5. Merge only when all teams approve

**MACS Integration**:
```
# Each team has its own MACS instance
/teams/frontend/.macs/
  ├── TASK.md              # Frontend-specific tasks
  ├── CHANGELOG.md         # Frontend changes
  └── CONTEXT.md           # Frontend decisions

# Project-level MACS
/.macs/
  ├── TASK.md              # Cross-team tasks
  ├── DEPENDENCIES.md      # Cross-team blockers
  └── PROJECT-STATUS.md    # Overall health
```

---

## 5. Weekly Cross-Team Sync

**Every Friday** (automated):

```
Project Lead:
1. Read all TEAM-CHANGELOG.md files
2. Aggregate into WEEKLY-REPORT.md
3. Identify cross-team patterns:
   - Repeated API mismatches → Need better contract docs
   - Frequent merge conflicts → Need architecture refactor
4. Generate recommendations for next week
```

### WEEKLY-REPORT.md Example

```markdown
# Week 9 Report - Feb 22-28, 2026

## Highlights
- ✅ Frontend completed user dashboard
- ✅ Backend shipped v1 of product catalog API
- ✅ DevOps delivered CI/CD pipeline

## Challenges
- ⚠️ 3 merge conflicts between Frontend/Backend (API changes)
- ⚠️ QA blocked 2 days waiting for staging

## Cross-Team Patterns Discovered

### Pattern 1: API Contract Violations (3 occurrences)
**Issue**: Frontend consuming endpoints before Backend finalized
**Root Cause**: Contract docs updated after implementation
**Recommendation**: Implement "contract-first" development
  → Backend publishes OpenAPI spec BEFORE coding
  → Frontend generates client from spec

### Pattern 2: Environment Provisioning Delays (2 occurrences)
**Issue**: Teams waiting days for DevOps to create environments
**Root Cause**: Manual provisioning process
**Recommendation**: Self-service environment creation
  → Candidate Skill: "provision-environment" (DevOps to build)

## Metrics
| Team | Velocity | Quality | Blockers |
|------|----------|---------|----------|
| Frontend | 23 tasks | 2 bugs | 0 |
| Backend | 19 tasks | 4 bugs | 1 |
| DevOps | 12 tasks | 0 bugs | 0 |
| QA | 8 tasks | - | 1 |

## Next Week Priorities
1. Resolve QA blocker (staging environment)
2. Implement contract-first API development
3. Build self-service environment provisioning skill
```

---

## 6. Agent Team Composition

### Recommended Team Structure

**Small Team (5 agents)**:
```
1 Lead (Opus)        - Architecture, escalations, cross-team coordination
3 Engineers (Sonnet) - Feature development
1 Maintainer (Haiku) - Testing, cleanup, documentation
```

**Large Team (10+ agents)**:
```
1 Lead (Opus)
1 Architect (Opus)         - System design
6 Engineers (Sonnet)       - Divided into sub-squads (2-3 per feature)
2 QA (Sonnet)              - Testing, bug verification
1 Maintainer (Haiku)       - CI/CD, docs, archiving
```

---

## 7. Real-World Enterprise Scenario

### Case Study: E-Commerce Platform (50 Agents, 12 Weeks)

**Week 1-2: Planning & Contracts**
- Project Lead defines overall architecture
- Each team writes TEAM-CONTRACTS.md
- All teams review and approve contracts
- Dependencies mapped in DEPENDENCIES.md

**Week 3-6: Parallel Development**
- Teams work independently on `team/{name}` branches
- Daily sync via PROJECT-STATUS.md
- Weekly pattern discovery identifies bottlenecks

**Week 7-8: Integration**
- Teams merge to `main` one by one
- Cross-team testing
- Conflicts resolved via escalation protocol

**Week 9-10: QA & Polish**
- QA team runs full test suite
- Bug fixes prioritized across teams
- Performance optimization

**Week 11-12: Deployment**
- Staging deployment (DevOps)
- Production rollout plan
- Post-mortem and skill capsule creation

**Outcome**:
- 50 agents delivered on time
- 23 new skill capsules created
- 87% code reuse via capsules
- 15% faster than human-only team (historical comparison)

---

## 8. Monitoring & Metrics

### Project-Level Dashboard (Auto-Generated)

```markdown
# Enterprise Project Dashboard

## Team Health
| Team | On Track | Behind | Blocked |
|------|----------|--------|---------|
| Frontend | 🟢 | | |
| Backend | 🟢 | | |
| DevOps | | 🟡 | |
| QA | | | 🔴 |

## Velocity Trends
[Chart: Tasks completed per week per team]

## Quality Metrics
- Bugs opened: 45
- Bugs closed: 38
- Bug backlog: 7
- Critical bugs: 1 (assigned to Backend)

## Dependency Graph
[Diagram showing team interdependencies]
- Frontend → Backend (3 active deps)
- QA → DevOps (1 blocker)

## Risk Assessment
- **High Risk**: QA blocked by staging delay (impact: release delay)
- **Medium Risk**: Backend velocity declining (3 weeks in a row)
- **Low Risk**: Frontend API client out of sync (easy fix)
```

---

## 9. Escalation Hierarchy

```
Level 1: Within-Team Escalation
  Engineer blocked → Team Lead

Level 2: Cross-Team Escalation
  Team Lead blocked → Project Lead

Level 3: Executive Escalation
  Project Lead blocked → Human PM/CTO
```

**Example**:
```
1. Backend Engineer (Sonnet) encounters database scaling issue
2. Escalates to Backend Lead (Opus) via TEAM-TASK.md Escalations
3. Backend Lead tries solutions, still blocked
4. Escalates to Project Lead via DEPENDENCIES.md
5. Project Lead sees this is architectural (requires human decision)
6. Escalates to Human CTO with analysis + options
7. CTO approves migration to distributed database
8. Project Lead updates PROJECT-STATUS.md with new timeline
9. All teams notified of dependency changes
```

---

## 10. Success Factors

| Factor | How MACS Enables It |
|--------|---------------------|
| **Clear ownership** | TEAM-CONTRACTS.md defines responsibilities |
| **Visibility** | PROJECT-STATUS.md shows real-time health |
| **Conflict prevention** | Git branching + contract validation |
| **Fast escalation** | Escalation protocol in TASK.md |
| **Knowledge sharing** | Skill capsules propagate best practices |
| **Continuous improvement** | Weekly pattern discovery → new capsules |
| **Human oversight** | Project Lead can inspect any team's docs |

---

## Implementation Checklist

For enterprises adopting MACS for multi-team projects:

- [ ] Define project structure (`/teams/{name}/`)
- [ ] Each team writes TEAM-CONTRACTS.md
- [ ] Set up PROJECT-STATUS.md automation (daily sync)
- [ ] Configure DEPENDENCIES.md tracking
- [ ] Establish Git branching strategy
- [ ] Schedule weekly cross-team sync
- [ ] Train teams on escalation protocol
- [ ] Set up skill capsule registry
- [ ] Define quality metrics dashboard
- [ ] Conduct weekly retrospectives

---

**Next**: See `SKILL-CAPSULES.md` for how teams share learnings across projects.
