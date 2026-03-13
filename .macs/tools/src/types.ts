/**
 * MACS Index Types
 * Structured representation of MACS documents for fast querying
 */

export interface ChangelogEntry {
  date: string
  type: 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore' | 'perf' | 'style' | 'ops' | 'escalation'
  content: string
  author?: string
  tags: string[]
  lineRange: [number, number]  // [start, end] line numbers in original file
  raw: string  // Original markdown text
}

export interface TaskEntry {
  id: string  // e.g., "T-001" or auto-generated hash
  status: 'pending' | 'in_progress' | 'blocked' | 'completed'
  title: string
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  tags: string[]
  lineRange: [number, number]
  raw: string
  blockedBy?: string  // Reason if status is 'blocked'
}

export interface ContextEntry {
  date: string
  section: string  // Which section of CONTEXT.md
  content: string
  tags: string[]
  lineRange: [number, number]
  raw: string
}

export interface MACSIndex {
  version: string
  generatedAt: string
  project: string

  // Indexed documents
  changelog: ChangelogEntry[]
  tasks: TaskEntry[]
  context: ContextEntry[]

  // Metadata
  stats: {
    totalTasks: number
    completedTasks: number
    openTasks: number
    totalChanges: number
    contributors: string[]
  }
}

export interface QueryOptions {
  type?: ChangelogEntry['type'] | ChangelogEntry['type'][]
  tags?: string[]
  since?: string  // ISO date
  until?: string
  author?: string
  status?: TaskEntry['status']
  limit?: number
}

export interface QueryResult<T> {
  items: T[]
  totalCount: number
  matchedLines: number  // Total lines matched (for token estimation)
}
