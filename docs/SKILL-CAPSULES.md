# Skill Capsules for MACS

> Inspired by EvoMAP's Gene Capsules: Package proven patterns with environment context.

## Concept

When an agent discovers a repeatable solution through MACS weekly pattern discovery, package it as a **Skill Capsule** - not just code, but validated knowledge with context.

## Capsule Structure

```
/skills/archive-changelog/
├── capsule.yaml              # Metadata + environment fingerprint
├── implementation/
│   ├── run.sh                # Executable logic
│   └── tests/                # Validation tests
├── knowledge/
│   ├── WHEN-TO-USE.md        # Context conditions
│   ├── EDGE-CASES.md         # Known limitations
│   └── VALIDATION-LOG.md     # Success/failure history
└── evolution/
    ├── v1.0.0/               # Original version
    ├── v1.1.0/               # Evolved version
    └── CHANGELOG.md          # Evolution history
```

### capsule.yaml Example

```yaml
name: archive-changelog
version: 1.2.0
author: flash-maintainer
category: maintenance

# Environment Fingerprint
validated_in:
  - project_size: "<100 files"
    changelog_format: "markdown"
    success_rate: 98%
    runs: 156

  - project_size: "100-500 files"
    changelog_format: "markdown"
    success_rate: 92%
    runs: 43

  - project_size: ">500 files"
    changelog_format: "markdown"
    success_rate: 78%  # Needs optimization
    runs: 12

# Prerequisites
requires:
  - git: ">=2.0"
  - tools: ["sed", "grep"]
  - permissions: "write"

# When to use (conditions)
effective_when:
  - "CHANGELOG.md exists"
  - "Entries follow date-based format"
  - "Archive directory exists or can be created"

# Known failures
avoid_when:
  - "Non-standard CHANGELOG format"
  - "Large files (>10MB) - performance degradation"

# Evolution path
supersedes: archive-changelog@1.1.0
improved_by:
  - "Added parallel processing for large files"
  - "Better error handling for missing dates"
```

---

## How It Differs from Regular Skills

| Aspect | Regular Skill | Skill Capsule |
|--------|---------------|---------------|
| **Scope** | Single task | Task + context + validation |
| **Knowledge** | Implementation only | When/where/why it works |
| **Evolution** | Manual updates | Tracked evolution with metrics |
| **Sharing** | Code + docs | Code + docs + success data |
| **Quality** | Developer claims | Community-validated metrics |

---

## MACS Integration

### 1. Pattern Discovery → Capsule Creation

**Current MACS flow**:
```
Work → CHANGELOG → Weekly Report → Pattern Discovery → Mark as "candidate skill"
```

**Enhanced with Capsules**:
```
Work → CHANGELOG → Weekly Report → Pattern Discovery
  → Create Skill Capsule (with environment fingerprint)
  → Test in current project (log success/failure)
  → If validated → Publish to registry
```

### 2. Capsule Registry

**Local** (project-level):
```
.macs/
├── skills/
│   └── local-capsules/
│       └── {skill-name}/
└── registry.json  # Local capsule index
```

**Global** (community):
```
# Install from registry
macs capsule install archive-changelog

# Searches:
1. Local registry first
2. Community registry (macs.dev)
3. EvoMAP network (if connected)
```

### 3. Natural Selection via Metrics

Every time a capsule runs:
```yaml
# Appended to knowledge/VALIDATION-LOG.md
- timestamp: 2026-02-28T10:00:00Z
  project: myproject
  environment:
    project_size: 45 files
    changelog_entries: 127
  result: success
  duration: 1.2s

- timestamp: 2026-02-28T11:00:00Z
  project: enterprise-app
  environment:
    project_size: 1200 files
    changelog_entries: 8500
  result: failure
  error: "Memory exceeded"
  duration: 45s (timeout)
```

**Capsule Quality Score**:
```python
score = (
    success_rate * 0.5 +          # 50% weight
    usage_count * 0.2 +            # 20% weight
    environment_coverage * 0.2 +   # 20% weight (works in many contexts)
    recency * 0.1                  # 10% weight (recent = maintained)
)
```

High-scoring capsules get promoted in registry. Low-scoring get flagged for improvement or deprecation.

---

## Enterprise Multi-Agent Use Case

### Scenario: 50-Agent Team Building E-Commerce Platform

**Team Structure**:
```
Lead Architect (Opus)
├── Frontend Team (5 Sonnet agents)
│   └── Each uses capsule "react-component-generator"
├── Backend Team (5 Sonnet agents)
│   └── Each uses capsule "api-endpoint-scaffold"
├── DevOps Team (3 Haiku agents)
│   └── Each uses capsule "deployment-automation"
└── QA Team (2 Sonnet agents)
    └── Each uses capsule "test-case-generator"
```

**How Capsules Help**:

1. **Consistent Patterns**: All frontend agents use the same validated component structure
2. **Environment Awareness**: Capsule knows "works best with TypeScript 5.x + React 18"
3. **Failure Prevention**: Capsule warns "avoid in monorepos >100 components (performance issue)"
4. **Evolution Tracking**: When one team improves the capsule, all teams get the update

### Capsule Lifecycle in Enterprise

```
Week 1: Frontend Agent A uses "react-component-generator" v1.0
  → Logs success in 8/10 cases, fails on complex forms

Week 2: Agent A escalates to Lead
  → Lead improves capsule to v1.1 (better form handling)

Week 3: All frontend agents auto-update to v1.1
  → Success rate improves from 80% → 95%

Week 4: Backend team sees pattern, creates "api-form-validator" capsule
  → Links to "react-component-generator" (related capsules)
```

---

## Capsule Evolution Protocol (Inspired by EvoMAP GEP)

### Version Control

```yaml
# Each capsule has semantic versioning
version: 1.2.3
  # 1 = Major (breaking changes)
  # 2 = Minor (new features, backward compatible)
  # 3 = Patch (bug fixes)

# Evolution history
changelog:
  - version: 1.2.3
    date: 2026-02-28
    changes:
      - "Fixed: Handle Unicode in CHANGELOG entries"
      - "Improved: 30% faster for large files"
    evolved_by: sonnet@enterprise-team

  - version: 1.2.0
    date: 2026-02-14
    changes:
      - "Added: Parallel processing support"
    evolved_by: flash@community
```

### Inheritance and Forking

```yaml
# Capsule can inherit from others
inherits_from: base-archiver@2.0.0
extends:
  - "Adds CHANGELOG-specific logic"
  - "Maintains base archiver's file handling"

# Or fork for specialization
forked_from: archive-changelog@1.0.0
specialization: "Optimized for monorepos"
```

### Cross-Project Learning

**Agent A** (Project Alpha):
- Uses capsule, logs success in Python projects
- Environment: `{language: python, size: small}`

**Agent B** (Project Beta):
- Uses same capsule in JavaScript project
- Discovers edge case, logs failure
- Environment: `{language: javascript, size: large}`

**Capsule updates automatically**:
```yaml
validated_in:
  - language: python
    size: small
    success_rate: 98%

  - language: javascript
    size: large
    success_rate: 65%  # Needs improvement
    known_issue: "Slow on large package.json"
```

**Other agents see this** before using:
> ⚠️ Warning: This capsule has 65% success rate in JavaScript projects >100 files.
> Consider alternative: "js-optimized-archiver@1.0.0"

---

## Implementation Roadmap

### Phase 1: Local Capsules (v2.3 - Next Month)

- ✅ Define capsule.yaml schema
- ✅ Add `knowledge/` directory to skill template
- ✅ Weekly report auto-generates capsule draft
- ✅ Local validation logging

### Phase 2: Community Registry (v3.0 - 6 Months)

- Build macs.dev capsule registry
- Upload/download via CLI (`macs capsule publish`)
- Community ratings + reviews
- Quality scoring algorithm

### Phase 3: EvoMAP Integration (v4.0 - 1 Year)

- Connect MACS capsules to EvoMAP network
- Cross-platform capsule sharing (MACS ↔ OpenClaw ↔ others)
- Global natural selection (best capsules propagate)
- A2A protocol support

---

## Benefits for Enterprise Multi-Agent Teams

| Challenge | Capsule Solution |
|-----------|------------------|
| **Inconsistent quality** | Only use high-scored capsules |
| **Repeated mistakes** | Capsule logs failures, warns others |
| **Knowledge silos** | Capsule registry = shared team knowledge |
| **Onboarding new agents** | New agents inherit best practices via capsules |
| **Context switches** | Environment fingerprint tells when to use what |
| **Evolution tracking** | Version history shows what changed and why |

---

## Sources

- [EvoMap: The Global AI Agent Evolution Network](https://vertu.com/ai-tools/evomap-how-a-clawhub-controversy-sparked-the-worlds-first-ai-agent-evolution-network/)
- [EvoMap - AI Self-Evolution Infrastructure](https://evomap.ai/)
- [GEP Protocol (Genome Evolution Protocol)](https://opengep.com/)
- [GitHub - EvoMap/evolver](https://github.com/EvoMap/evolver)
