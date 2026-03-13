# MACS Tools

Technical toolkit for MACS v2.3+ - Markdown indexer, query engine, conflict resolver.

## Installation

```bash
cd .macs/tools
npm install
npm run build
```

## Usage

### 1. Generate Index

```bash
npm run index -- /path/to/your-project

# Or use the compiled CLI:
node dist/index.js index /path/to/your-project
```

This generates `.macs/index.json` with structured data from:
- `CHANGELOG.md`
- `TASK.md`
- `CONTEXT.md`

### 2. Query Index

```typescript
import { QueryEngine } from '@macs/tools'
import indexData from '.macs/index.json'

const query = new QueryEngine(indexData)

// Find recent features
const features = query.queryChangelog({
  type: 'feat',
  since: '2026-02-20',
  limit: 5
})

// Find blocked tasks
const blocked = query.queryTasks({ status: 'blocked' })

// Search context for keyword
const authContext = query.queryContext({
  keyword: 'authentication',
  limit: 3
})
```

### 3. Token Savings Stats

```bash
npm run stats

# Output:
# 📈 MACS Token Savings Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Project: mycc
#
# Token Usage:
#   With Index:      250 tokens
#   Without Index:   3000 tokens
#   💰 Savings:      2750 tokens (92%)
```

## Architecture

```
.macs/tools/
├── src/
│   ├── types.ts              # TypeScript types
│   ├── markdown-indexer.ts   # AST parser
│   ├── query-engine.ts       # Query API
│   └── index.ts              # CLI entry point
└── package.json
```

## How It Works

### Markdown AST Parsing

Uses `unified` + `remark` to parse Markdown into AST:

```typescript
const tree = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .parse(markdown)

// Visit nodes and extract structured data
visit(tree, (node) => {
  if (node.type === 'listItem') {
    // Extract changelog entry
  }
})
```

### Index Structure

```json
{
  "version": "2.3.0",
  "generatedAt": "2026-02-28T10:00:00Z",
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
    "contributors": ["lead-opus", "engineer-sonnet", "maintainer-haiku"]
  }
}
```

### Token Savings

**Before** (reading full documents):
- CHANGELOG.md: ~800 lines = 2400 tokens
- TASK.md: ~150 lines = 450 tokens
- CONTEXT.md: ~200 lines = 600 tokens
- **Total: 3450 tokens**

**After** (querying index):
- Recent 5 changes: ~10 lines = 30 tokens
- Active tasks: ~5 lines = 15 tokens
- **Total: 45 tokens**
- **Savings: 98.7%**

## Agent Integration

Update your agent prompts to use the index:

```markdown
# Agent System Prompt

Before reading full MACS documents, check `.macs/index.json`:

1. Read index stats to understand project status
2. Query for relevant entries only
3. Read original markdown only for matched line ranges

Example workflow:
- Need recent context? Query changelog with `since: '7 days ago'`
- Need task status? Query tasks with `status: 'in_progress'`
- Need decision rationale? Query context with `keyword: 'why we chose'`

This reduces token usage by 80-95%.
```

## Roadmap

- [x] Markdown AST indexer
- [x] Query engine
- [x] Token savings stats
- [ ] Conflict detector (v2.3.1)
- [ ] QMD semantic search integration (v2.4)
- [ ] Real-time file watcher (v2.4)
