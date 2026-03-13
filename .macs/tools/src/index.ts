#!/usr/bin/env node
/**
 * MACS CLI Tool
 * Usage:
 *   macs index [project-path]    - Generate index
 *   macs query [options]         - Query index
 *   macs stats                   - Show token savings stats
 */

import { MarkdownIndexer } from './markdown-indexer.js'
import { QueryEngine } from './query-engine.js'
import type { MACSIndex } from './types.js'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'index'
  const projectPath = args[1] || process.cwd()

  switch (command) {
    case 'index': {
      console.log(`📊 Indexing MACS project: ${projectPath}`)
      const index = await MarkdownIndexer.indexProject(projectPath)
      console.log(`✓ Generated index with:`)
      console.log(`  - ${index.changelog.length} changelog entries`)
      console.log(`  - ${index.tasks.length} tasks`)
      console.log(`  - ${index.context.length} context entries`)
      console.log(`  - ${index.stats.contributors.length} contributors`)
      console.log(`\n📁 Index saved to: ${projectPath}/.macs/index.json`)
      break
    }

    case 'stats': {
      const fs = await import('fs/promises')
      const path = await import('path')
      const indexPath = path.join(projectPath, '.macs', 'index.json')

      const indexData = await fs.readFile(indexPath, 'utf-8')
      const index: MACSIndex = JSON.parse(indexData)
      const query = new QueryEngine(index)

      const savings = query.estimateTokenSavings()
      const summary = query.getSummary()

      console.log(`\n📈 MACS Token Savings Report`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Project: ${summary.projectName}`)
      console.log(`\nCurrent Status:`)
      console.log(`  Total Tasks:     ${summary.stats.totalTasks}`)
      console.log(`  Completed:       ${summary.stats.completedTasks}`)
      console.log(`  Open:            ${summary.stats.openTasks}`)
      console.log(`  Total Changes:   ${summary.stats.totalChanges}`)
      console.log(`\nToken Usage:`)
      console.log(`  With Index:      ${savings.withIndex} tokens`)
      console.log(`  Without Index:   ${savings.withoutIndex} tokens`)
      console.log(`  💰 Savings:      ${savings.savings} tokens (${savings.savingsPercent}%)`)
      console.log(`\n  Estimated Cost Savings (per 100 queries):`)
      console.log(`    Opus:    $${((savings.savings * 100 * 15) / 1_000_000).toFixed(2)}`)
      console.log(`    Sonnet:  $${((savings.savings * 100 * 3) / 1_000_000).toFixed(2)}`)
      console.log(`    Haiku:   $${((savings.savings * 100 * 0.25) / 1_000_000).toFixed(2)}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
      break
    }

    case 'query': {
      const fs = await import('fs/promises')
      const path = await import('path')
      const indexPath = path.join(projectPath, '.macs', 'index.json')

      const indexData = await fs.readFile(indexPath, 'utf-8')
      const index: MACSIndex = JSON.parse(indexData)
      const query = new QueryEngine(index)

      // Example queries
      console.log(`\n🔍 Recent Changes (last 5):`)
      const recent = query.queryChangelog({ limit: 5 })
      recent.items.forEach(e => {
        console.log(`  ${e.date} [${e.type}] ${e.content}`)
      })

      console.log(`\n📋 Active Tasks:`)
      const tasks = query.queryTasks({ status: 'in_progress' })
      tasks.items.forEach(t => {
        console.log(`  ${t.id} ${t.title}`)
      })

      console.log(`\n⚠️  Blocked Tasks:`)
      const blocked = query.queryTasks({ status: 'blocked' })
      blocked.items.forEach(t => {
        console.log(`  ${t.id} ${t.title}`)
      })
      break
    }

    default:
      console.log(`Unknown command: ${command}`)
      console.log(`\nUsage:`)
      console.log(`  macs index [path]   - Generate index`)
      console.log(`  macs stats          - Show token savings`)
      console.log(`  macs query          - Query index`)
      process.exit(1)
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
