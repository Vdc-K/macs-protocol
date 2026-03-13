/**
 * Markdown AST Indexer
 * Parses MACS documents (CHANGELOG, TASK, CONTEXT) into structured index
 * Reduces token usage by 60-80% via selective reading
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { Root, Heading, ListItem, Paragraph } from 'mdast'
import type { ChangelogEntry, TaskEntry, ContextEntry, MACSIndex } from './types.js'

export class MarkdownIndexer {
  /**
   * Parse CHANGELOG.md into structured entries
   */
  static parseChangelog(markdown: string): ChangelogEntry[] {
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as Root

    const entries: ChangelogEntry[] = []
    let currentDate = ''
    let lineNumber = 1

    visit(tree, (node, index, parent) => {
      // Extract date from headings (e.g., "## 2026-02-28" or "### 2026-02-28")
      if (node.type === 'heading' && (node.depth === 2 || node.depth === 3)) {
        const text = this.extractText(node)
        const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/)
        if (dateMatch) {
          currentDate = dateMatch[0]
        }
      }

      // Extract changelog entries from list items
      if (node.type === 'listItem' && currentDate) {
        const text = this.extractText(node)
        const entry = this.parseChangelogLine(text, currentDate, lineNumber)
        if (entry) {
          entries.push(entry)
        }
      }

      // Track line numbers (approximate)
      if (node.position) {
        lineNumber = node.position.end.line
      }
    })

    return entries
  }

  /**
   * Parse TASK.md into structured task entries
   */
  static parseTaskList(markdown: string): TaskEntry[] {
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as Root

    const tasks: TaskEntry[] = []
    let currentSection = ''
    let lineNumber = 1
    let taskCounter = 1

    visit(tree, (node) => {
      // Track current section
      if (node.type === 'heading') {
        currentSection = this.extractText(node)
      }

      // Extract tasks from checkboxes
      if (node.type === 'listItem' && node.checked !== null) {
        const text = this.extractText(node)
        const status = node.checked ? 'completed' : 'pending'

        // Check if blocked (from Escalations section)
        const isBlocked = currentSection.includes('Escalations')

        const task: TaskEntry = {
          id: `T-${String(taskCounter).padStart(3, '0')}`,
          status: isBlocked ? 'blocked' : status,
          title: text,
          tags: this.extractTags(text),
          lineRange: node.position
            ? [node.position.start.line, node.position.end.line]
            : [lineNumber, lineNumber],
          raw: text,
        }

        // Extract assignee if present (e.g., "@engineer-sonnet")
        const assigneeMatch = text.match(/@([\w-]+)/)
        if (assigneeMatch) {
          task.assignee = assigneeMatch[1]
        }

        tasks.push(task)
        taskCounter++
      }

      if (node.position) {
        lineNumber = node.position.end.line
      }
    })

    return tasks
  }

  /**
   * Parse CONTEXT.md into structured context entries
   */
  static parseContext(markdown: string): ContextEntry[] {
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown) as Root

    const entries: ContextEntry[] = []
    let currentSection = ''
    let currentDate = ''
    let lineNumber = 1

    visit(tree, (node) => {
      if (node.type === 'heading') {
        const text = this.extractText(node)
        currentSection = text

        // Extract date from section headings
        const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/)
        if (dateMatch) {
          currentDate = dateMatch[0]
        }
      }

      // Capture paragraphs as context entries
      if (node.type === 'paragraph' && currentSection && node.position) {
        const text = this.extractText(node)

        if (text.length > 20) {  // Skip trivial entries
          entries.push({
            date: currentDate,
            section: currentSection,
            content: text,
            tags: this.extractTags(text),
            lineRange: [node.position.start.line, node.position.end.line],
            raw: text,
          })
        }
      }

      if (node.position) {
        lineNumber = node.position.end.line
      }
    })

    return entries
  }

  /**
   * Generate complete MACS index from project directory
   */
  static async indexProject(projectPath: string): Promise<MACSIndex> {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Read MACS documents
    const changelogPath = path.join(projectPath, 'CHANGELOG.md')
    const taskPath = path.join(projectPath, 'TASK.md')
    const contextPath = path.join(projectPath, 'CONTEXT.md')

    let changelog: ChangelogEntry[] = []
    let tasks: TaskEntry[] = []
    let context: ContextEntry[] = []

    try {
      const changelogMd = await fs.readFile(changelogPath, 'utf-8')
      changelog = this.parseChangelog(changelogMd)
    } catch (e) {
      // CHANGELOG doesn't exist yet
    }

    try {
      const taskMd = await fs.readFile(taskPath, 'utf-8')
      tasks = this.parseTaskList(taskMd)
    } catch (e) {
      // TASK doesn't exist yet
    }

    try {
      const contextMd = await fs.readFile(contextPath, 'utf-8')
      context = this.parseContext(contextMd)
    } catch (e) {
      // CONTEXT doesn't exist yet
    }

    // Calculate stats
    const contributors = new Set(
      changelog
        .filter(e => e.author)
        .map(e => e.author!)
    )

    const index: MACSIndex = {
      version: '2.3.0',
      generatedAt: new Date().toISOString(),
      project: path.basename(projectPath),
      changelog,
      tasks,
      context,
      stats: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        openTasks: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
        totalChanges: changelog.length,
        contributors: Array.from(contributors),
      },
    }

    // Write index file
    const indexPath = path.join(projectPath, '.macs', 'index.json')
    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2))

    return index
  }

  // ========== Helper Methods ==========

  private static parseChangelogLine(
    text: string,
    date: string,
    lineNumber: number
  ): ChangelogEntry | null {
    // Example: "[✨ feat] Added dashboard #dev #ui @engineer-sonnet"
    const typeMatch = text.match(/\[([^\]]+)\]/)
    if (!typeMatch) return null

    const typeStr = typeMatch[1].trim().toLowerCase()
    const type = this.parseChangeType(typeStr)

    // Extract author
    const authorMatch = text.match(/@([\w-]+)/)
    const author = authorMatch ? authorMatch[1] : undefined

    // Extract content (remove type prefix and author suffix)
    const content = text
      .replace(/\[[\w\s]+\]\s*/, '')
      .replace(/@[\w-]+/, '')
      .trim()

    return {
      date,
      type,
      content,
      author,
      tags: this.extractTags(text),
      lineRange: [lineNumber, lineNumber],
      raw: text,
    }
  }

  private static parseChangeType(typeStr: string): ChangelogEntry['type'] {
    if (typeStr.includes('feat')) return 'feat'
    if (typeStr.includes('fix')) return 'fix'
    if (typeStr.includes('docs')) return 'docs'
    if (typeStr.includes('refactor')) return 'refactor'
    if (typeStr.includes('test')) return 'test'
    if (typeStr.includes('perf')) return 'perf'
    if (typeStr.includes('style')) return 'style'
    if (typeStr.includes('ops')) return 'ops'
    if (typeStr.includes('escalation')) return 'escalation'
    return 'chore'
  }

  private static extractTags(text: string): string[] {
    const tags = text.match(/#[\w-]+/g)
    return tags || []
  }

  private static extractText(node: any): string {
    if (node.type === 'text') return node.value
    if (node.children) {
      return node.children.map((child: any) => this.extractText(child)).join('')
    }
    return ''
  }
}
