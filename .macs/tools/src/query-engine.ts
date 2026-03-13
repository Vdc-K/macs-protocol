/**
 * Query Engine
 * Fast querying over MACS index with filtering and token estimation
 */

import type {
  MACSIndex,
  ChangelogEntry,
  TaskEntry,
  ContextEntry,
  QueryOptions,
  QueryResult,
} from './types.js'

export class QueryEngine {
  constructor(private index: MACSIndex) {}

  /**
   * Query changelog entries
   * Example: Find all features added by engineer-sonnet in the last week
   */
  queryChangelog(options: QueryOptions = {}): QueryResult<ChangelogEntry> {
    let results = this.index.changelog

    // Filter by type
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type]
      results = results.filter(e => types.includes(e.type))
    }

    // Filter by tags
    if (options.tags) {
      results = results.filter(e =>
        options.tags!.some(tag => e.tags.includes(tag))
      )
    }

    // Filter by date range
    if (options.since) {
      results = results.filter(e => e.date >= options.since!)
    }
    if (options.until) {
      results = results.filter(e => e.date <= options.until!)
    }

    // Filter by author
    if (options.author) {
      results = results.filter(e => e.author === options.author)
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return {
      items: results,
      totalCount: results.length,
      matchedLines: this.countLines(results),
    }
  }

  /**
   * Query tasks
   * Example: Find all pending tasks assigned to engineer-sonnet
   */
  queryTasks(options: QueryOptions = {}): QueryResult<TaskEntry> {
    let results = this.index.tasks

    // Filter by status
    if (options.status) {
      results = results.filter(t => t.status === options.status)
    }

    // Filter by tags
    if (options.tags) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags.includes(tag))
      )
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return {
      items: results,
      totalCount: results.length,
      matchedLines: this.countLines(results),
    }
  }

  /**
   * Query context entries
   * Example: Find all context about authentication decisions
   */
  queryContext(options: QueryOptions & { keyword?: string } = {}): QueryResult<ContextEntry> {
    let results = this.index.context

    // Filter by date range
    if (options.since) {
      results = results.filter(e => e.date >= options.since!)
    }
    if (options.until) {
      results = results.filter(e => e.date <= options.until!)
    }

    // Filter by tags
    if (options.tags) {
      results = results.filter(e =>
        options.tags!.some(tag => e.tags.includes(tag))
      )
    }

    // Keyword search (simple text matching, can be replaced with semantic search later)
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase()
      results = results.filter(e =>
        e.content.toLowerCase().includes(keyword) ||
        e.section.toLowerCase().includes(keyword)
      )
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return {
      items: results,
      totalCount: results.length,
      matchedLines: this.countLines(results),
    }
  }

  /**
   * Get project summary (for agent initial context)
   */
  getSummary(): {
    projectName: string
    stats: MACSIndex['stats']
    recentChanges: ChangelogEntry[]
    activeTasks: TaskEntry[]
    estimatedTokens: number
  } {
    const recentChanges = this.queryChangelog({
      limit: 10,
    })

    const activeTasks = this.queryTasks({
      status: 'in_progress',
    })

    // Estimate tokens: ~3 tokens per line on average
    const estimatedTokens = (
      recentChanges.matchedLines +
      activeTasks.matchedLines
    ) * 3

    return {
      projectName: this.index.project,
      stats: this.index.stats,
      recentChanges: recentChanges.items,
      activeTasks: activeTasks.items,
      estimatedTokens,
    }
  }

  /**
   * Helper: Count total lines in results
   */
  private countLines(items: Array<{ lineRange: [number, number] }>): number {
    return items.reduce((sum, item) => {
      return sum + (item.lineRange[1] - item.lineRange[0] + 1)
    }, 0)
  }

  /**
   * Estimate token savings vs reading full documents
   */
  estimateTokenSavings(): {
    withIndex: number
    withoutIndex: number
    savings: number
    savingsPercent: number
  } {
    const summary = this.getSummary()
    const withIndex = summary.estimatedTokens

    // Assume full documents have ~1000 lines total
    const withoutIndex = 1000 * 3  // 3000 tokens

    return {
      withIndex,
      withoutIndex,
      savings: withoutIndex - withIndex,
      savingsPercent: Math.round((1 - withIndex / withoutIndex) * 100),
    }
  }
}
