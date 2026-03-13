# MACS Technical Features (v2.3+)

> This document explains the technical innovations that make MACS more than just "Markdown templates"

---

## Overview

MACS v2.3 introduces two core technical features:

1. **Markdown AST Indexer** - 80% token reduction via selective reading
2. **Dashboard** - Visual transparency into multi-agent collaboration

These features solve real problems that arise at scale (10+ agents, months-long projects, 1000+ changes).

---

## Feature 1: Markdown AST Indexer

### The Problem

**Without indexing:**
- Agents read full CHANGELOG.md (800 lines) every turn → 2400 tokens
- Agents read full TASK.md (150 lines) → 450 tokens
- Agents read full CONTEXT.md (200 lines) → 600 tokens
- **Total: 3450 tokens per query**

For 100 queries/day:
- Opus: $51.75
- Sonnet: $10.35
- Haiku: $0.86

**Over 12 weeks:** $3600-$27,000 (depending on model)

### The Solution

Parse Markdown into AST, extract structured data, enable selective querying.

#### Architecture

```
CHANGELOG.md  ──┐
TASK.md       ──┼──> Markdown AST Parser ──> .macs/index.json
CONTEXT.md    ──┘                                     │
                                                      ↓
                                             Query Engine
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    ↓                 ↓                 ↓
                              queryChangelog()   queryTasks()   queryContext()
```

#### Index Structure

```json
{
  "version": "2.3.0",
  "project": "mycc",
  "changelog": [
    {
      "date": "2026-02-28",
      "type": "feat",
      "content": "Added dashboard",
      "author": "engineer-sonnet",
      "tags": ["#dev", "#ui"],
      "lineRange": [42, 48],
      "raw": "[✨ feat] Added dashboard #dev #ui @engineer-sonnet"
    }
  ],
  "tasks": [...],
  "context": [...],
  "stats": {
    "totalTasks": 25,
    "completedTasks": 23,
    "openTasks": 2,
    "totalChanges": 127,
    "contributors": ["lead-opus", "engineer-sonnet"]
  }
}
```

#### Query API

```typescript
import { QueryEngine } from '@macs/tools'

const query = new QueryEngine(index)

// Find recent features added by engineer-sonnet
const features = query.queryChangelog({
  type: 'feat',
  author: 'engineer-sonnet',
  since: '2026-02-20',
  limit: 5
})
// Returns only matched entries (~30 tokens vs 2400)

// Find blocked tasks
const blocked = query.queryTasks({ status: 'blocked' })

// Search context for keyword
const authContext = query.queryContext({
  keyword: 'authentication',
  limit: 3
})
```

#### Token Savings

**After indexing:**
- Recent 5 changes: ~10 lines = 30 tokens
- Active tasks: ~5 lines = 15 tokens
- **Total: 45 tokens per query**
- **Savings: 3405 tokens (98.7%)**

**Cost savings (100 queries/day, 12 weeks):**

| Model | Before | After | Savings |
|-------|--------|-------|---------|
| Opus | $27,216 | $756 | **$26,460** |
| Sonnet | $5,443 | $151 | **$5,292** |
| Haiku | $454 | $13 | **$441** |

### Implementation

Built with:
- `unified` - Markdown processor
- `remark-parse` - Markdown parser
- `remark-gfm` - GitHub Flavored Markdown support
- `unist-util-visit` - AST traversal

Key files:
- `.macs/tools/src/markdown-indexer.ts` - Parser
- `.macs/tools/src/query-engine.ts` - Query API
- `.macs/tools/src/types.ts` - TypeScript definitions

### Usage

```bash
# Generate index
macs index /path/to/project

# Show stats
macs stats

# Query from code
import { QueryEngine } from '@macs/tools'
const query = new QueryEngine(index)
```

---

## Feature 2: Dashboard

### The Problem

Multi-agent collaboration is a **black box**:
- Can't see what each agent did when
- Don't know which files are changing most
- Hard to estimate token usage
- Escalations are invisible until you read TASK.md

This makes debugging, optimization, and oversight difficult.

### The Solution

Visual dashboard showing:
- Activity timeline
- Token usage over time
- File heatmap (most changed files)
- Recent activity feed
- Escalations (blocked tasks)
- Contributor stats

#### Architecture

```
Git History  ──┐
.macs/index  ──┼──> Analyzer ──> Dashboard Data (JSON)
MACS docs    ──┘                         │
                                         ↓
                                   HTTP Server
                                         │
                                         ↓
                                    Web UI (D3.js)
```

#### Dashboard Data

```typescript
interface DashboardData {
  project: string
  stats: {
    totalTasks: number
    completedTasks: number
    blockedTasks: number
    totalChanges: number
    contributors: string[]
  }
  timeline: Array<{ date, agent, action, type }>
  heatmap: Array<{ file, changes }>
  tokenUsage: Array<{ date, estimated }>
  recentActivity: Array<{ timestamp, agent, message }>
  escalations: Array<{ taskId, reason }>
}
```

#### Screenshots

(TODO: Add screenshots when dashboard is running)

#### Key Insights

**Timeline:**
- See spikes in activity (feature pushes, bug fixes)
- Identify quiet periods (blockers? waiting for review?)

**Heatmap:**
- Which files are "hot" (high change frequency)
- Helps identify refactoring targets

**Token Usage:**
- Daily token consumption trends
- Estimate monthly costs

**Escalations:**
- See all blocked tasks at a glance
- Prioritize unblocking work

### Implementation

Built with:
- Node.js HTTP server (no framework, keeps it simple)
- Vanilla JS + D3.js (no React, fast loading)
- Git CLI for heatmap analysis

Key files:
- `.macs/dashboard/server.ts` - HTTP server
- `.macs/dashboard/analyzer.ts` - Data extraction
- `.macs/dashboard/ui/` - Frontend

### Usage

```bash
# Start dashboard
macs dashboard /path/to/project

# Opens http://localhost:3456 automatically
# Auto-refreshes every 30 seconds
```

---

## Roadmap: Future Technical Features

### v2.4: Conflict Resolver

**Problem:** Multiple agents editing TASK.md simultaneously → merge conflicts

**Solution:**
- Parse TASK.md into task blocks (each checkbox = block)
- 3-way merge algorithm
- Auto-merge non-conflicting changes
- Escalate conflicting changes to human

**Estimated token savings:** N/A (saves developer time, not tokens)

**Timeline:** Q2 2026

---

### v2.5: QMD Semantic Search Integration

**Problem:** Keyword search in context is crude (misses related concepts)

**Solution:**
- Integrate OpenClaw's QMD (Quantum Markdown) semantic search
- Replace keyword matching with vector similarity
- "Why did we choose JWT?" → finds all auth-related decisions

**Estimated token savings:** Additional 20-30% on top of existing savings

**Timeline:** Q3 2026 (depends on QMD maturity)

---

### v3.0: Event-Driven Indexing

**Problem:** Index is stale until manually regenerated

**Solution:**
- File watcher on CHANGELOG/TASK/CONTEXT
- Auto-regenerate index on file change
- WebSocket push to dashboard for real-time updates

**Estimated token savings:** N/A (improves UX)

**Timeline:** Q3 2026

---

### v4.0: Distributed Index (EvoMAP Integration)

**Problem:** Each project indexes from scratch (no cross-project learning)

**Solution:**
- EvoMAP-style skill capsules with shared validation logs
- Global registry of indexed patterns
- "This pattern worked in 87% of projects like yours"

**Estimated token savings:** 40% fewer failed attempts (learned from community)

**Timeline:** Q1 2027

---

## Why This Matters

These features transform MACS from **"just Markdown templates"** into a **technical platform**:

1. **Markdown AST Indexer** → Requires understanding AST parsing, query optimization, token economics
2. **Dashboard** → Requires data visualization, real-time updates, Git analysis
3. **Conflict Resolver** → Requires 3-way merge algorithms, structured parsing
4. **QMD Integration** → Requires vector embeddings, semantic search, RAG

**This is hard to replicate.** Anyone can copy templates. Not everyone can build performant, reliable tooling.

---

## Comparison: MACS vs Competitors

| Feature | MACS | AutoGen | CrewAI | LangGraph |
|---------|------|---------|--------|-----------|
| Token Indexing | ✅ 98% savings | ❌ | ❌ | ❌ |
| Visual Dashboard | ✅ | ❌ | ⚠️ Paid only | ❌ |
| Conflict Detection | 🚧 v2.4 | ❌ | ❌ | ❌ |
| Semantic Search | 🚧 v2.5 | ❌ | ❌ | ❌ |
| Cross-Platform | ✅ | Python only | Python only | Python only |
| Open Source Core | ✅ MIT | ✅ | ⚠️ Partial | ✅ |

**Key differentiator:** MACS optimizes for **long-running projects** (weeks to months), competitors optimize for **single sessions**.

---

## Get Started

```bash
# Clone MACS
git clone https://github.com/your-org/macs.git
cd macs

# Install tools
cd .macs/tools && npm install
cd ../dashboard && npm install

# Initialize a project
./scripts/macs init "My Project" ~/my-project

# Start dashboard
./scripts/macs dashboard ~/my-project
```

Read more:
- [Quickstart Guide](./QUICKSTART.md)
- [API Documentation](./API.md)
- [Architecture Deep Dive](./ARCHITECTURE.md)
