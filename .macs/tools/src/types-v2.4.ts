/**
 * MACS v2.4 Enhanced Types (Concept)
 * 增强的数据结构 - 包含关系和元数据
 */

// ========== 基础类型（继承自 v2.3）==========

export type ChangeType = 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore' | 'perf' | 'style' | 'ops' | 'escalation'
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'
export type ImpactLevel = 'high' | 'medium' | 'low'

// ========== v2.4 增强：元数据 ==========

/**
 * Git 提交元数据（从 git log 提取）
 */
export interface GitMetadata {
  commitHash?: string
  filesChanged: string[]       // 改了哪些文件
  linesAdded: number           // +150
  linesDeleted: number         // -20
  timestamp: string            // Git commit 时间
}

/**
 * 任务进度元数据
 */
export interface ProgressMetadata {
  estimatedHours?: number      // 预估工时
  actualHours?: number         // 实际工时
  completionPercent?: number   // 完成百分比 (0-100)
  startedAt?: string           // 开始时间
  completedAt?: string         // 完成时间
}

// ========== v2.4 增强：关系 ==========

/**
 * 引用关系（指向其他实体）
 */
export interface References {
  tasks: string[]              // 引用的任务 ID: ["T-001", "T-003"]
  changes: string[]            // 引用的变更 ID
  contexts: string[]           // 引用的上下文章节
  files: string[]              // 引用的文件路径
}

/**
 * 依赖关系（任务之间）
 */
export interface Dependencies {
  blockedBy: string[]          // 被哪些任务阻塞: ["T-001", "T-002"]
  blocks: string[]             // 阻塞了哪些任务: ["T-005"]
  dependsOn: string[]          // 依赖哪些任务（弱依赖，不阻塞）
  relatedTo: string[]          // 相关任务（关联但不依赖）
}

// ========== v2.4 增强：ChangelogEntry ==========

export interface ChangelogEntryV2 {
  // ===== v2.3 字段 =====
  date: string
  type: ChangeType
  content: string
  author?: string
  tags: string[]
  lineRange: [number, number]
  raw: string

  // ===== v2.4 新增：唯一标识 =====
  id: string                   // 自动生成：C-001, C-002...

  // ===== v2.4 新增：Git 元数据 =====
  git?: GitMetadata

  // ===== v2.4 新增：关系 =====
  references?: References      // 引用了什么

  // ===== v2.4 新增：语义标签 =====
  impact?: ImpactLevel         // 影响程度（从 lines changed 推断）
  category?: string            // 从 tags 聚合：auth, ui, perf
  isBreakingChange?: boolean   // 是否破坏性变更
}

// ========== v2.4 增强：TaskEntry ==========

export interface TaskEntryV2 {
  // ===== v2.3 字段 =====
  id: string
  status: TaskStatus
  title: string
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  tags: string[]
  lineRange: [number, number]
  raw: string
  blockedBy?: string           // v2.3 已有（字符串描述）

  // ===== v2.4 新增：结构化依赖 =====
  dependencies?: Dependencies  // 替代 blockedBy 字符串

  // ===== v2.4 新增：进度追踪 =====
  progress?: ProgressMetadata

  // ===== v2.4 新增：关联变更 =====
  relatedChanges?: string[]    // 相关的 changelog entry IDs

  // ===== v2.4 新增：子任务 =====
  subtasks?: {
    id: string
    title: string
    completed: boolean
  }[]
}

// ========== v2.4 增强：ContextEntry ==========

export interface ContextEntryV2 {
  // ===== v2.3 字段 =====
  date: string
  section: string
  content: string
  tags: string[]
  lineRange: [number, number]
  raw: string

  // ===== v2.4 新增：唯一标识 =====
  id: string                   // 自动生成：CTX-001, CTX-002...

  // ===== v2.4 新增：语义类型 =====
  type?: 'decision' | 'rationale' | 'investigation' | 'insight' | 'note'

  // ===== v2.4 新增：决策关系 =====
  semantics?: {
    relatedDecisions?: string[]  // 关联的其他决策 IDs
    supersedes?: string          // 替代了哪个旧决策
    supersededBy?: string        // 被哪个新决策替代
  }

  // ===== v2.4 新增：关联 =====
  references?: References
}

// ========== v2.4 增强：索引 ==========

export interface MACSIndexV2 {
  version: string
  generatedAt: string
  project: string

  // ===== 实体集合 =====
  changelog: ChangelogEntryV2[]
  tasks: TaskEntryV2[]
  context: ContextEntryV2[]

  // ===== 统计（扩展）=====
  stats: {
    totalTasks: number
    completedTasks: number
    openTasks: number
    blockedTasks: number
    totalChanges: number
    contributors: string[]

    // v2.4 新增
    averageTaskTime?: number     // 平均任务完成时间（小时）
    totalLinesChanged?: number   // 总代码变更行数
    mostChangedFiles?: string[]  // 最常改的文件
    hotspotCategories?: string[] // 热点分类（auth, ui, perf）
  }

  // ===== v2.4 新增：关系图 =====
  graph?: RelationshipGraph
}

// ========== v2.4 新增：关系图 ==========

export interface RelationshipGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphNode {
  id: string                   // T-001, C-001, CTX-001, file:src/auth.ts
  type: 'task' | 'change' | 'context' | 'file' | 'author'
  label: string                // 显示名称
  metadata: Record<string, any>
}

export interface GraphEdge {
  from: string                 // Node ID
  to: string                   // Node ID
  type: EdgeType
  weight?: number              // 关系强度（可选）
}

export type EdgeType =
  | 'implements'               // Task → Change (任务实现了变更)
  | 'blocks'                   // Task → Task (任务阻塞任务)
  | 'depends_on'              // Task → Task (任务依赖任务)
  | 'references'              // Any → Any (引用关系)
  | 'modifies'                // Change → File (变更修改了文件)
  | 'authored_by'             // Change → Author (变更作者)
  | 'relates_to'              // Context → Task/Change (上下文关联)
  | 'supersedes'              // Context → Context (决策替代)

// ========== v2.4 新增：查询选项 ==========

export interface QueryOptionsV2 {
  // ===== v2.3 选项 =====
  type?: ChangeType | ChangeType[]
  tags?: string[]
  since?: string
  until?: string
  author?: string
  status?: TaskStatus
  limit?: number

  // ===== v2.4 新增：关系查询 =====
  taskId?: string              // 查找与某任务相关的变更
  filesChanged?: string[]      // 查找修改了特定文件的变更
  impact?: ImpactLevel         // 按影响程度筛选
  category?: string            // 按分类筛选

  // ===== v2.4 新增：依赖查询 =====
  blockedBy?: string           // 查找被特定任务阻塞的任务
  blocks?: string              // 查找阻塞特定任务的任务

  // ===== v2.4 新增：语义查询 =====
  keyword?: string             // 关键词搜索（现有）
  semanticType?: ContextEntryV2['type']  // 按语义类型筛选上下文
}

// ========== 使用示例 ==========

/**
 * Example: 查找所有与 T-001 相关的变更
 */
// const changes = query.queryChangelog({ taskId: 'T-001' })

/**
 * Example: 查找所有改了 src/auth.ts 的变更
 */
// const authChanges = query.queryChangelog({ filesChanged: ['src/auth.ts'] })

/**
 * Example: 查找所有高影响变更
 */
// const highImpact = query.queryChangelog({ impact: 'high' })

/**
 * Example: 查找所有阻塞 T-003 的任务
 */
// const blockers = query.queryTasks({ blocks: 'T-003' })

/**
 * Example: 查找所有决策类上下文
 */
// const decisions = query.queryContext({ semanticType: 'decision' })
