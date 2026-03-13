/**
 * MACS Protocol Engine v4.1
 *
 * Core: Append events → Rebuild state → Query state
 * All writes go to JSONL (append-only). State is a cached projection.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { createRequire } from 'module'
import type {
  TaskEvent, GlobalEvent, MACSState, TaskState, AgentState,
  AgentMessage, MACSConfig, LockState, ProjectMetrics,
  BlockedRecord, AgentStats
} from './schema.js'
import { MACS_SPEC_VERSION } from './schema.js'

// ============================================================
// Plugin System (4.1)
// ============================================================

export interface MACSPlugin {
  name: string
  version?: string
  hooks?: {
    onTaskCreated?: (task: TaskState) => void
    onTaskCompleted?: (task: TaskState) => void
    onTaskBlocked?: (task: TaskState) => void
    onTaskReviewed?: (task: TaskState, result: 'approved' | 'rejected') => void
    onAgentRegistered?: (agentId: string, capabilities: string[]) => void
    onEscalation?: (task: TaskState) => void
    onDeadAgent?: (agentId: string, reassignedTasks: string[]) => void
  }
}

function loadPlugins(projectRoot: string): MACSPlugin[] {
  const pluginsDir = join(projectRoot, '.macs', 'plugins')
  if (!existsSync(pluginsDir)) return []

  const plugins: MACSPlugin[] = []
  let entries: string[]
  try {
    entries = readdirSync(pluginsDir)
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.endsWith('.js') && !entry.endsWith('.cjs')) continue
    try {
      const pluginPath = resolve(join(pluginsDir, entry))
      const req = createRequire(import.meta.url)
      const mod = req(pluginPath)
      const plugin: MACSPlugin = mod.default || mod
      if (plugin && plugin.name) {
        plugins.push(plugin)
      }
    } catch {
      // skip invalid plugins
    }
  }
  return plugins
}

// ============================================================
// File I/O — JSONL read/write
// ============================================================

function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content.split('\n').map(line => JSON.parse(line))
}

function appendJsonl<T>(filePath: string, event: T): void {
  const line = JSON.stringify(event) + '\n'
  appendFileSync(filePath, line, 'utf-8')
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function writeJson<T>(filePath: string, data: T): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ============================================================
// Sequence Counter — monotonic, no conflicts
// ============================================================

function getNextSeq(dir: string): number {
  const seqFile = join(dir, '.seq')
  let seq = 0
  if (existsSync(seqFile)) {
    seq = parseInt(readFileSync(seqFile, 'utf-8').trim(), 10) || 0
  }
  seq++
  writeFileSync(seqFile, String(seq), 'utf-8')
  return seq
}

// ============================================================
// MACSEngine — the core
// ============================================================

export class MACSEngine {
  private dir: string
  private protocolDir: string
  private syncDir: string
  private humanDir: string
  private plugins: MACSPlugin[]

  constructor(projectRoot: string) {
    this.dir = join(projectRoot, '.macs')
    this.protocolDir = join(this.dir, 'protocol')
    this.syncDir = join(this.dir, 'sync', 'inbox')
    this.humanDir = join(this.dir, 'human')
    this.plugins = loadPlugins(projectRoot)
  }

  // Plugin access
  getPlugins(): MACSPlugin[] { return this.plugins }

  registerPlugin(plugin: MACSPlugin): void {
    this.plugins.push(plugin)
  }

  private emit<K extends keyof Required<MACSPlugin>['hooks']>(
    hook: K,
    ...args: Parameters<NonNullable<Required<MACSPlugin>['hooks'][K]>>
  ): void {
    for (const plugin of this.plugins) {
      const fn = plugin.hooks?.[hook] as ((...a: any[]) => void) | undefined
      if (fn) {
        try { fn(...args) } catch { /* plugin errors don't crash engine */ }
      }
    }
  }

  // ----------------------------------------------------------
  // Init — create directory structure
  // ----------------------------------------------------------

  init(projectName: string): MACSConfig {
    const dirs = [
      this.protocolDir,
      this.syncDir,
      this.humanDir,
    ]
    for (const d of dirs) {
      mkdirSync(d, { recursive: true })
    }

    // Create empty files
    const tasksFile = join(this.protocolDir, 'tasks.jsonl')
    const eventsFile = join(this.protocolDir, 'events.jsonl')
    if (!existsSync(tasksFile)) writeFileSync(tasksFile, '', 'utf-8')
    if (!existsSync(eventsFile)) writeFileSync(eventsFile, '', 'utf-8')

    // Config
    const config: MACSConfig = {
      version: '4.1',
      project: projectName,
      created_at: new Date().toISOString(),
      settings: {
        heartbeat_interval_ms: 300000,
        offline_threshold_ms: 900000,
        auto_reassign_on_offline: true,
        lock_timeout_ms: 600000,
        generate_human_readable: true,
        conflict_resolution: 'last_write_wins',
      }
    }
    writeJson(join(this.dir, 'macs.json'), config)

    // Initial state
    this.rebuildState()

    return config
  }

  // ----------------------------------------------------------
  // Write Events
  // ----------------------------------------------------------

  appendTaskEvent(event: Omit<TaskEvent, 'seq'>): TaskEvent {
    const seq = getNextSeq(this.protocolDir)
    const full = { spec_version: MACS_SPEC_VERSION, ...event, seq } as TaskEvent
    appendJsonl(join(this.protocolDir, 'tasks.jsonl'), full)
    this.rebuildState()
    // Plugin hooks
    const state = this.getState()
    const task = state.tasks[full.id]
    if (task) {
      if (full.type === 'task_created') this.emit('onTaskCreated', task)
      else if (full.type === 'task_completed') this.emit('onTaskCompleted', task)
      else if (full.type === 'task_blocked') this.emit('onTaskBlocked', task)
      else if (full.type === 'task_escalated') this.emit('onEscalation', task)
      else if (full.type === 'task_reviewed') {
        const ev = full as import('./schema.js').TaskReviewedEvent
        this.emit('onTaskReviewed', task, ev.data.result)
      }
    }
    return full
  }

  appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): GlobalEvent {
    const seq = getNextSeq(this.protocolDir)
    const full = { spec_version: MACS_SPEC_VERSION, ...event, seq } as GlobalEvent
    const config = readJson<import('./schema.js').MACSConfig>(join(this.dir, 'macs.json'))
    if (config?.settings.events_sharding) {
      // v5: per-agent shard — events/{agent-id}.jsonl
      const shardDir = join(this.protocolDir, 'events')
      mkdirSync(shardDir, { recursive: true })
      appendJsonl(join(shardDir, `${event.by}.jsonl`), full)
    } else {
      appendJsonl(join(this.protocolDir, 'events.jsonl'), full)
    }
    this.rebuildState()
    return full
  }

  // ----------------------------------------------------------
  // Read Events
  // ----------------------------------------------------------

  getTaskEvents(): TaskEvent[] {
    return readJsonl<TaskEvent>(join(this.protocolDir, 'tasks.jsonl'))
  }

  getGlobalEvents(): GlobalEvent[] {
    const shardDir = join(this.protocolDir, 'events')
    if (existsSync(shardDir)) {
      // v5: merge all per-agent shards, sorted by seq
      const files = readdirSync(shardDir).filter(f => f.endsWith('.jsonl'))
      const all: GlobalEvent[] = []
      for (const f of files) {
        all.push(...readJsonl<GlobalEvent>(join(shardDir, f)))
      }
      return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }
    return readJsonl<GlobalEvent>(join(this.protocolDir, 'events.jsonl'))
  }

  // ----------------------------------------------------------
  // State Rebuild — the heart of Event Sourcing
  // ----------------------------------------------------------

  rebuildState(): MACSState {
    const taskEvents = this.getTaskEvents()
    const globalEvents = this.getGlobalEvents()

    const tasks: Record<string, TaskState> = {}
    const agents: Record<string, AgentState> = {}
    const locks: LockState[] = []
    let lastSeq = 0

    // Process task events
    for (const event of taskEvents) {
      if (event.seq && event.seq > lastSeq) lastSeq = event.seq

      switch (event.type) {
        case 'task_created': {
          tasks[event.id] = {
            id: event.id,
            status: 'pending',
            title: event.data.title,
            assignee: null,
            priority: event.data.priority,
            tags: event.data.tags,
            depends: event.data.depends,
            affects: event.data.affects,
            created_at: event.ts,
            created_by: event.by,
            estimate_ms: event.data.estimate_ms,
            description: event.data.description,
            requires_capabilities: event.data.requires_capabilities,
            artifacts: [],
            blocked_history: [],
          }
          break
        }

        case 'task_assigned': {
          const task = tasks[event.id]
          if (task) {
            task.assignee = event.data.assignee
            task.status = 'assigned'
          }
          break
        }

        case 'task_unassigned': {
          const task = tasks[event.id]
          if (task) {
            task.assignee = null
            task.status = 'pending'
          }
          break
        }

        case 'task_started': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'in_progress'
            task.started_at = event.ts
          }
          break
        }

        case 'task_blocked': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'blocked'
            task.blocked_history.push({
              blocked_at: event.ts,
              reason: event.data.description,
              handoff_note: event.data.handoff_note,
            })
            if (event.data.handoff_note) task.handoff_note = event.data.handoff_note
          }
          break
        }

        case 'task_unblocked': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'in_progress'
            const lastBlock = task.blocked_history[task.blocked_history.length - 1]
            if (lastBlock && !lastBlock.unblocked_at) {
              lastBlock.unblocked_at = event.ts
              lastBlock.duration_ms = new Date(event.ts).getTime() - new Date(lastBlock.blocked_at).getTime()
              lastBlock.decision = event.data.decision
            }
          }
          break
        }

        case 'task_completed': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'completed'
            task.completed_at = event.ts
            task.actual_ms = event.data.actual_ms
            task.artifacts = event.data.artifacts
            task.summary = event.data.summary
          }
          break
        }

        case 'task_cancelled': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'cancelled'
            task.cancelled_at = event.ts
            if (event.data.handoff_note) task.handoff_note = event.data.handoff_note
          }
          break
        }

        case 'task_priority_changed': {
          const task = tasks[event.id]
          if (task) {
            task.priority = event.data.to as TaskState['priority']
          }
          break
        }

        case 'task_updated': {
          const task = tasks[event.id]
          if (task) {
            (task as any)[event.data.field] = event.data.to
          }
          break
        }

        case 'task_decomposed': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'waiting_for_subtasks'
            task.subtasks = event.data.subtask_ids
          }
          // Set parent_task and goal_chain on each subtask
          for (const subId of event.data.subtask_ids) {
            if (tasks[subId] && task) {
              tasks[subId].parent_task = event.id
              tasks[subId].goal_chain = [
                ...(task.goal_chain || []),
                task.description || task.title,
              ]
            }
          }
          break
        }

        case 'task_checkpoint': {
          const task = tasks[event.id]
          if (task) {
            task.last_checkpoint_at = event.ts
          }
          break
        }

        case 'task_review_requested': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'review_required'
            task.review_requested_at = event.ts
            if (event.data.suggested_reviewer) task.reviewer = event.data.suggested_reviewer
          }
          break
        }

        case 'task_reviewed': {
          const task = tasks[event.id]
          if (task) {
            task.review_result = event.data.result
            task.review_note = event.data.note
            task.reviewer = event.by
            if (event.data.result === 'approved') {
              task.status = 'completed'
              task.completed_at = event.ts
            } else {
              // rejected: back to in_progress for rework
              task.status = 'in_progress'
            }
          }
          break
        }

        case 'task_escalated': {
          const task = tasks[event.id]
          if (task) {
            task.status = 'pending_human'
            task.escalation_reason = event.data.reason
            task.escalated_to = event.data.escalate_to
            task.escalated_at = event.ts
            task.escalation_timeout_ms = event.data.timeout_ms
          }
          break
        }
      }
    }

    // Auto-complete parent tasks when all subtasks are done (derived state)
    for (const task of Object.values(tasks)) {
      if (task.status === 'waiting_for_subtasks' && task.subtasks && task.subtasks.length > 0) {
        const allDone = task.subtasks.every(subId => tasks[subId]?.status === 'completed')
        if (allDone) {
          task.status = 'completed'
          // Use the latest subtask completion time
          task.completed_at = task.subtasks
            .map(subId => tasks[subId]?.completed_at || '')
            .sort()
            .pop() || new Date().toISOString()
          // Merge artifacts from all subtasks
          task.artifacts = task.subtasks.flatMap(subId => tasks[subId]?.artifacts || [])
        }
      }
    }

    // Compute drift_suspected for in_progress tasks (Lobster-Guardian Chill Factor pattern)
    const config = readJson<MACSConfig>(join(this.dir, 'macs.json'))
    const driftThresholdMs = config?.settings.offline_threshold_ms ?? 1800000 // default 30 min
    const nowMs = Date.now()
    for (const task of Object.values(tasks)) {
      if (task.status !== 'in_progress') {
        task.drift_suspected = false
        continue
      }
      const lastActivity = task.last_checkpoint_at || task.started_at || task.created_at
      const silentMs = nowMs - new Date(lastActivity).getTime()
      task.drift_suspected = silentMs > driftThresholdMs
    }

    // Process global events for agents and locks
    for (const event of globalEvents) {
      if (event.seq && event.seq > lastSeq) lastSeq = event.seq

      switch (event.type) {
        case 'agent_registered': {
          agents[event.data.agent_id] = {
            id: event.data.agent_id,
            instance_id: event.data.instance_id,
            session_id: event.data.session_id,
            status: 'idle',
            capabilities: event.data.capabilities,
            model: event.data.model,
            role: event.data.role,
            current_task: null,
            registered_at: event.ts,
            last_heartbeat: event.ts,
            stats: {
              tasks_completed: 0,
              tasks_cancelled: 0,
              total_time_ms: 0,
              avg_task_time_ms: 0,
              blocked_count: 0,
              blocked_time_ms: 0,
            }
          }
          break
        }

        case 'agent_heartbeat': {
          const agent = agents[event.by]
          if (agent) {
            agent.status = event.data.status
            agent.current_task = event.data.current_task || null
            agent.last_heartbeat = event.ts
          }
          break
        }

        case 'agent_offline': {
          const agent = agents[event.data.agent_id]
          if (agent) {
            agent.status = 'offline'
          }
          break
        }

        case 'agent_dead': {
          const agent = agents[event.data.agent_id]
          if (agent) {
            agent.status = 'dead'
            agent.current_task = null
          }
          // Reset reassigned tasks back to unassigned pending
          for (const taskId of event.data.reassigned_tasks) {
            const task = tasks[taskId]
            if (task) {
              task.assignee = null
              task.status = 'pending'
            }
          }
          break
        }

        case 'lock_acquired': {
          locks.push({
            file: event.data.file,
            locked_by: event.by,
            locked_at: event.ts,
            reason: event.data.reason,
            eta_ms: event.data.eta_ms,
          })
          break
        }

        case 'lock_released': {
          const idx = locks.findIndex(l => l.file === event.data.file && l.locked_by === event.by)
          if (idx >= 0) locks.splice(idx, 1)
          break
        }
      }
    }

    // Compute agent stats from task events
    for (const event of taskEvents) {
      if (event.type === 'task_completed') {
        const task = tasks[event.id]
        if (task?.assignee && agents[task.assignee]) {
          const agent = agents[task.assignee]
          agent.stats.tasks_completed++
          if (task.actual_ms) {
            agent.stats.total_time_ms += task.actual_ms
            agent.stats.avg_task_time_ms = agent.stats.total_time_ms / agent.stats.tasks_completed
          }
        }
      }
      if (event.type === 'task_blocked') {
        const task = tasks[event.id]
        if (task?.assignee && agents[task.assignee]) {
          agents[task.assignee].stats.blocked_count++
        }
      }
    }

    // Sync agent current_task from task state
    for (const task of Object.values(tasks)) {
      if (task.assignee && agents[task.assignee] && task.status === 'in_progress') {
        agents[task.assignee].current_task = task.id
        agents[task.assignee].status = 'busy'
      }
    }

    // Compute metrics
    const taskList = Object.values(tasks)
    const completedTasks = taskList.filter(t => t.status === 'completed')
    const avgTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + (t.actual_ms || 0), 0) / completedTasks.length
      : 0

    const conflictCount = globalEvents.filter(e => e.type === 'conflict_detected').length
    const breakingCount = globalEvents.filter(e => e.type === 'breaking_change').length

    const metrics: ProjectMetrics = {
      total_tasks: taskList.length,
      completed: taskList.filter(t => t.status === 'completed').length,
      in_progress: taskList.filter(t => t.status === 'in_progress').length,
      blocked: taskList.filter(t => t.status === 'blocked').length,
      pending: taskList.filter(t => t.status === 'pending' || t.status === 'assigned').length,
      cancelled: taskList.filter(t => t.status === 'cancelled').length,
      waiting_for_subtasks: taskList.filter(t => t.status === 'waiting_for_subtasks').length,
      review_required: taskList.filter(t => t.status === 'review_required' || t.status === 'under_review').length,
      pending_human: taskList.filter(t => t.status === 'pending_human').length,
      avg_completion_time_ms: avgTime,
      total_events: taskEvents.length + globalEvents.length,
      active_agents: Object.values(agents).filter(a => a.status !== 'offline' && a.status !== 'dead').length,
      dead_agents: Object.values(agents).filter(a => a.status === 'dead').length,
      conflict_count: conflictCount,
      breaking_changes: breakingCount,
    }

    const state: MACSState = {
      version: '4.1',
      updated_at: new Date().toISOString(),
      last_event_seq: lastSeq,
      tasks,
      agents,
      locks,
      metrics,
    }

    writeJson(join(this.protocolDir, 'state.json'), state)
    return state
  }

  // ----------------------------------------------------------
  // State Query
  // ----------------------------------------------------------

  getState(): MACSState {
    const state = readJson<MACSState>(join(this.protocolDir, 'state.json'))
    if (!state) return this.rebuildState()
    return state
  }

  findTasks(filter: {
    status?: TaskState['status']
    assignee?: string | null
    priority?: TaskState['priority']
    tag?: string
    unblocked?: boolean
    capable_agent?: string   // 3.1: only tasks this agent can claim
  }): TaskState[] {
    const state = this.getState()
    let tasks = Object.values(state.tasks)

    if (filter.status) tasks = tasks.filter(t => t.status === filter.status)
    if (filter.assignee !== undefined) tasks = tasks.filter(t => t.assignee === filter.assignee)
    if (filter.priority) tasks = tasks.filter(t => t.priority === filter.priority)
    if (filter.tag) tasks = tasks.filter(t => t.tags.includes(filter.tag!))
    if (filter.unblocked) {
      tasks = tasks.filter(t => {
        if (t.depends.length === 0) return true
        return t.depends.every(depId => state.tasks[depId]?.status === 'completed')
      })
    }
    if (filter.capable_agent) {
      const agentCaps = state.agents[filter.capable_agent]?.capabilities ?? []
      tasks = tasks.filter(t => {
        if (!t.requires_capabilities || t.requires_capabilities.length === 0) return true
        return t.requires_capabilities.some(cap => agentCaps.includes(cap))
      })
    }

    return tasks
  }

  findIdleAgents(): AgentState[] {
    const state = this.getState()
    return Object.values(state.agents).filter(a => a.status === 'idle')
  }

  // ----------------------------------------------------------
  // Load Balancing (3.2)
  // ----------------------------------------------------------

  /** Returns active task count per agent (in_progress + assigned + review_required) */
  getAgentWorkload(): Record<string, number> {
    const state = this.getState()
    const workload: Record<string, number> = {}
    for (const agent of Object.values(state.agents)) workload[agent.id] = 0
    for (const task of Object.values(state.tasks)) {
      if (task.assignee && ['in_progress', 'assigned', 'review_required'].includes(task.status)) {
        workload[task.assignee] = (workload[task.assignee] ?? 0) + 1
      }
    }
    return workload
  }

  /**
   * Suggests the best available agent for a task.
   * Prefers idle agents, then least-loaded, filtered by capability.
   */
  suggestAgent(taskId: string): AgentState | null {
    const state = this.getState()
    const task = state.tasks[taskId]
    if (!task) return null

    const workload = this.getAgentWorkload()
    const candidates = Object.values(state.agents)
      .filter(a => a.status !== 'dead')
      .filter(a => {
        if (!task.requires_capabilities || task.requires_capabilities.length === 0) return true
        return task.requires_capabilities.some(cap => a.capabilities.includes(cap))
      })
      .sort((a, b) => {
        const statusScore = (s: string) => s === 'idle' ? 0 : 1
        const statusDiff = statusScore(a.status) - statusScore(b.status)
        if (statusDiff !== 0) return statusDiff
        return (workload[a.id] ?? 0) - (workload[b.id] ?? 0)
      })

    return candidates[0] ?? null
  }

  // ----------------------------------------------------------
  // Task Operations (high-level, wraps events)
  // ----------------------------------------------------------

  createTask(by: string, data: {
    title: string
    priority?: 'critical' | 'high' | 'medium' | 'low'
    tags?: string[]
    depends?: string[]
    affects?: string[]
    estimate_ms?: number
    description?: string
    requires_capabilities?: string[]
  }): TaskState {
    const state = this.getState()
    const existingIds = Object.keys(state.tasks)
    const maxNum = existingIds.reduce((max, id) => {
      const num = parseInt(id.replace('T-', ''), 10)
      return num > max ? num : max
    }, 0)
    const id = `T-${String(maxNum + 1).padStart(3, '0')}`

    this.appendTaskEvent({
      type: 'task_created',
      id,
      ts: new Date().toISOString(),
      by,
      data: {
        title: data.title,
        priority: data.priority || 'medium',
        tags: data.tags || [],
        depends: data.depends || [],
        affects: data.affects || [],
        estimate_ms: data.estimate_ms,
        description: data.description,
        requires_capabilities: data.requires_capabilities,
      }
    })

    return this.getState().tasks[id]
  }

  decomposeTask(agentId: string, parentTaskId: string, subtaskTitles: string[], rationale?: string): TaskState[] {
    const state = this.getState()
    const parentTask = state.tasks[parentTaskId]
    if (!parentTask) throw new Error(`Task ${parentTaskId} not found`)

    // Build goal_chain: inherited goals + parent's own goal
    const inheritedGoals = [
      ...(parentTask.goal_chain || []),
      parentTask.description || parentTask.title,
    ]

    const subtaskIds: string[] = []
    let maxNum = Object.keys(state.tasks).reduce((max, id) => {
      const num = parseInt(id.replace('T-', ''), 10)
      return num > max ? num : max
    }, 0)

    for (const title of subtaskTitles) {
      maxNum++
      const id = `T-${String(maxNum).padStart(3, '0')}`
      this.appendTaskEvent({
        type: 'task_created',
        id,
        ts: new Date().toISOString(),
        by: agentId,
        data: {
          title,
          priority: parentTask.priority,
          tags: [...parentTask.tags],
          depends: [],
          affects: [...parentTask.affects],
          description: inheritedGoals.join(' → '),
        }
      })
      subtaskIds.push(id)
    }

    // Mark parent as waiting_for_subtasks
    this.appendTaskEvent({
      type: 'task_decomposed',
      id: parentTaskId,
      ts: new Date().toISOString(),
      by: agentId,
      data: { subtask_ids: subtaskIds, rationale },
    })

    const finalState = this.getState()
    return subtaskIds.map(id => finalState.tasks[id])
  }

  claimTask(agentId: string, taskId?: string): TaskState | null {
    if (taskId) {
      const state = this.getState()
      const task = state.tasks[taskId]
      if (!task || task.status !== 'pending') return null

      this.appendTaskEvent({
        type: 'task_assigned',
        id: taskId,
        ts: new Date().toISOString(),
        by: agentId,
        data: { assignee: agentId }
      })
      return this.getState().tasks[taskId]
    }

    // Auto-claim: check workload cap before grabbing more tasks
    const config = readJson<MACSConfig>(join(this.dir, 'macs.json'))
    const maxConcurrent = config?.settings.max_concurrent_tasks_per_agent ?? 3
    const workload = this.getAgentWorkload()
    if ((workload[agentId] ?? 0) >= maxConcurrent) return null

    // Find best available task (capability-filtered, priority-sorted)
    const available = this.findTasks({ status: 'pending', assignee: null, unblocked: true, capable_agent: agentId })
    if (available.length === 0) return null

    // Sort by priority (3.3)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    available.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    const task = available[0]
    this.appendTaskEvent({
      type: 'task_assigned',
      id: task.id,
      ts: new Date().toISOString(),
      by: agentId,
      data: { assignee: agentId }
    })
    return this.getState().tasks[task.id]
  }

  startTask(agentId: string, taskId: string): void {
    this.appendTaskEvent({
      type: 'task_started',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data: {}
    })
  }

  completeTask(agentId: string, taskId: string, data: {
    artifacts?: string[]
    actual_ms?: number
    summary?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_completed',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data: {
        artifacts: data.artifacts || [],
        actual_ms: data.actual_ms,
        summary: data.summary,
      }
    })
  }

  blockTask(agentId: string, taskId: string, data: {
    reason: 'need_decision' | 'dependency' | 'conflict' | 'external' | 'other'
    description: string
    escalate_to?: string
    handoff_note?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_blocked',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  cancelTask(agentId: string, taskId: string, data: {
    reason: string
    handoff_note?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_cancelled',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  unblockTask(agentId: string, taskId: string, data: {
    decision?: string
    context?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_unblocked',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  // ----------------------------------------------------------
  // Checkpoint & Drift Detection (2.28)
  // ----------------------------------------------------------

  addCheckpoint(agentId: string, taskId: string, data: {
    note: string
    progress?: number
  }): void {
    this.appendTaskEvent({
      type: 'task_checkpoint',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  getDrift(thresholdMs?: number): Array<{
    task: TaskState
    silentMs: number
    level: 'suspected' | 'confirmed'
  }> {
    const config = readJson<MACSConfig>(join(this.dir, 'macs.json'))
    const threshold = thresholdMs ?? config?.settings.offline_threshold_ms ?? 1800000
    const state = this.getState()
    const nowMs = Date.now()
    const results = []

    for (const task of Object.values(state.tasks)) {
      if (task.status !== 'in_progress') continue
      const lastActivity = task.last_checkpoint_at || task.started_at || task.created_at
      const silentMs = nowMs - new Date(lastActivity).getTime()
      if (silentMs >= threshold) {
        results.push({
          task,
          silentMs,
          level: (silentMs > threshold * 2 ? 'confirmed' : 'suspected') as 'suspected' | 'confirmed',
        })
      }
    }

    return results.sort((a, b) => b.silentMs - a.silentMs)
  }

  // ----------------------------------------------------------
  // Smart Drift Analysis (3.13)
  // ----------------------------------------------------------

  /**
   * Analyzes task behavior patterns to detect:
   * - "Spinning": same file modified 3+ times (agent is looping)
   * - "Direction drift": artifacts don't match task title/tags
   *
   * Returns actionable analysis with recommended interventions.
   */
  analyzeSmartDrift(): Array<{
    taskId: string
    task: TaskState
    type: 'spinning' | 'direction_drift' | 'both'
    details: {
      spinning?: Array<{ file: string; count: number }>
      direction_drift?: Array<{ artifact: string; reason: string }>
    }
    recommended_action: string
  }> {
    const state = this.getState()
    const globalEvents = readJsonl<GlobalEvent>(join(this.protocolDir, 'events.jsonl'))
    const results = []

    const activeTasks = Object.values(state.tasks).filter(
      t => t.status === 'in_progress' || t.status === 'review_required'
    )

    for (const task of activeTasks) {
      // --- Spinning detection: file_modified churn per task ---
      const fileModEvents = globalEvents.filter(
        e => e.type === 'file_modified' && e.task === task.id
      ) as Array<{ type: 'file_modified'; task?: string; data: { path: string; diff_summary: string } }>

      const fileCounts: Record<string, number> = {}
      for (const ev of fileModEvents) {
        fileCounts[ev.data.path] = (fileCounts[ev.data.path] ?? 0) + 1
      }
      const spinningFiles = Object.entries(fileCounts)
        .filter(([, count]) => count >= 3)
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)

      // --- Direction drift: artifacts vs task keywords ---
      const keywords = [
        ...task.title.toLowerCase().split(/\W+/).filter(w => w.length > 3),
        ...(task.tags ?? []).map(t => t.toLowerCase()),
      ]
      const driftArtifacts = task.artifacts
        .filter(artifact => {
          const normalized = artifact.toLowerCase()
          return keywords.length > 0 && !keywords.some(kw => normalized.includes(kw))
        })
        .map(artifact => ({
          artifact,
          reason: `artifact path "${artifact}" has no overlap with task keywords [${keywords.slice(0, 3).join(', ')}]`,
        }))

      const hasSpinning = spinningFiles.length > 0
      const hasDrift = driftArtifacts.length > 0 && task.artifacts.length > 0

      if (!hasSpinning && !hasDrift) continue

      const type = hasSpinning && hasDrift ? 'both'
        : hasSpinning ? 'spinning'
        : 'direction_drift'

      const recommended_action = type === 'both'
        ? `Escalate to lead: agent appears stuck AND producing off-topic artifacts`
        : type === 'spinning'
        ? `Request checkpoint from ${task.assignee ?? 'agent'}: file "${spinningFiles[0].file}" modified ${spinningFiles[0].count}x`
        : `Review artifacts with ${task.assignee ?? 'agent'}: output may not match task goal`

      results.push({
        taskId: task.id,
        task,
        type: type as 'spinning' | 'direction_drift' | 'both',
        details: {
          ...(hasSpinning && { spinning: spinningFiles }),
          ...(hasDrift && { direction_drift: driftArtifacts }),
        },
        recommended_action,
      })
    }

    return results
  }

  // ----------------------------------------------------------
  // Review Chain (3.10)
  // ----------------------------------------------------------

  requestReview(agentId: string, taskId: string, data: {
    note?: string
    suggested_reviewer?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_review_requested',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  submitReview(reviewerId: string, taskId: string, data: {
    result: 'approved' | 'rejected'
    note?: string
  }): void {
    this.appendTaskEvent({
      type: 'task_reviewed',
      id: taskId,
      ts: new Date().toISOString(),
      by: reviewerId,
      data,
    })
  }

  // ----------------------------------------------------------
  // Escalation (3.11)
  // ----------------------------------------------------------

  escalateTask(agentId: string, taskId: string, data: {
    reason: string
    escalate_to?: string
    timeout_ms?: number
  }): void {
    this.appendTaskEvent({
      type: 'task_escalated',
      id: taskId,
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  // ----------------------------------------------------------
  // Dead Agent Reaping (3.12)
  // ----------------------------------------------------------

  reapDeadAgents(thresholdMs?: number): Array<{ agentId: string; reassigned: string[] }> {
    const config = readJson<MACSConfig>(join(this.dir, 'macs.json'))
    const threshold = thresholdMs ?? (config?.settings.offline_threshold_ms ?? 900000) * 3 // 3× offline = dead
    const state = this.getState()
    const nowMs = Date.now()
    const results: Array<{ agentId: string; reassigned: string[] }> = []

    for (const agent of Object.values(state.agents)) {
      if (agent.status === 'dead') continue  // already reaped
      const silentMs = nowMs - new Date(agent.last_heartbeat).getTime()
      if (silentMs < threshold) continue

      // Find tasks assigned to this agent that are in_progress or assigned
      const reassignedTasks = Object.values(state.tasks)
        .filter(t => t.assignee === agent.id && (t.status === 'in_progress' || t.status === 'assigned'))
        .map(t => t.id)

      this.appendGlobalEvent({
        type: 'agent_dead',
        ts: new Date().toISOString(),
        by: 'system',
        data: {
          agent_id: agent.id,
          last_heartbeat: agent.last_heartbeat,
          silent_ms: silentMs,
          reassigned_tasks: reassignedTasks,
        },
      })

      this.emit('onDeadAgent', agent.id, reassignedTasks)
      results.push({ agentId: agent.id, reassigned: reassignedTasks })
    }

    return results
  }

  // ----------------------------------------------------------
  // Agent Operations
  // ----------------------------------------------------------

  registerAgent(agentId: string, data: {
    capabilities: string[]
    model?: string
    role?: string
    instance_id?: string
    session_id?: string
  }): void {
    const instance_id = data.instance_id ?? `${agentId}-${Date.now()}`
    this.appendGlobalEvent({
      type: 'agent_registered',
      ts: new Date().toISOString(),
      by: agentId,
      data: { agent_id: agentId, instance_id, ...data },
    })
    this.emit('onAgentRegistered', agentId, data.capabilities)
  }

  heartbeat(agentId: string, data: {
    status: 'busy' | 'idle' | 'blocked'
    current_task?: string
    progress?: number
    eta_ms?: number
  }): void {
    this.appendGlobalEvent({
      type: 'agent_heartbeat',
      ts: new Date().toISOString(),
      by: agentId,
      data,
    })
  }

  // ----------------------------------------------------------
  // Lock Operations
  // ----------------------------------------------------------

  acquireLock(agentId: string, file: string, reason?: string, eta_ms?: number): boolean {
    const state = this.getState()
    const existing = state.locks.find(l => l.file === file)
    if (existing) return false

    this.appendGlobalEvent({
      type: 'lock_acquired',
      ts: new Date().toISOString(),
      by: agentId,
      data: { file, reason, eta_ms },
    })
    return true
  }

  releaseLock(agentId: string, file: string): void {
    this.appendGlobalEvent({
      type: 'lock_released',
      ts: new Date().toISOString(),
      by: agentId,
      data: { file },
    })
  }

  // ----------------------------------------------------------
  // Messaging
  // ----------------------------------------------------------

  sendMessage(msg: Omit<AgentMessage, 'id' | 'ts' | 'read'>): AgentMessage {
    const inboxDir = join(this.syncDir, msg.to)
    mkdirSync(inboxDir, { recursive: true })

    const existing = existsSync(inboxDir)
      ? readJsonl<AgentMessage>(join(inboxDir, 'messages.jsonl')).length
      : 0
    const id = `MSG-${String(existing + 1).padStart(3, '0')}`

    const full: AgentMessage = {
      ...msg,
      id,
      ts: new Date().toISOString(),
      read: false,
    }

    appendJsonl(join(inboxDir, 'messages.jsonl'), full)
    return full
  }

  getInbox(agentId: string, unreadOnly = false): AgentMessage[] {
    const inboxFile = join(this.syncDir, agentId, 'messages.jsonl')
    const messages = readJsonl<AgentMessage>(inboxFile)
    if (unreadOnly) return messages.filter(m => !m.read)
    return messages
  }

  markRead(agentId: string, messageId: string): void {
    const inboxFile = join(this.syncDir, agentId, 'messages.jsonl')
    const messages = readJsonl<AgentMessage>(inboxFile)
    const updated = messages.map(m => m.id === messageId ? { ...m, read: true } : m)
    writeFileSync(inboxFile, updated.map(m => JSON.stringify(m)).join('\n') + '\n', 'utf-8')
  }

  // ----------------------------------------------------------
  // Impact Analysis
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // CI/CD Consistency Check (4.5)
  // ----------------------------------------------------------

  ciCheck(options: { staleHours?: number } = {}): {
    ok: boolean
    errors: { type: string; id?: string; message: string }[]
    warnings: { type: string; id?: string; message: string }[]
    summary: string
  } {
    const state = this.getState()
    const errors: { type: string; id?: string; message: string }[] = []
    const warnings: { type: string; id?: string; message: string }[] = []
    const now = Date.now()
    const staleMs = (options.staleHours ?? 2) * 60 * 60 * 1000

    // 1. Stale in_progress tasks (no recent checkpoint)
    for (const task of Object.values(state.tasks)) {
      if (task.status === 'in_progress') {
        const lastActivity = task.last_checkpoint_at || task.started_at
        if (lastActivity && now - new Date(lastActivity).getTime() > staleMs) {
          const hours = Math.floor((now - new Date(lastActivity).getTime()) / 3600000)
          warnings.push({
            type: 'stale_task',
            id: task.id,
            message: `${task.id} "${task.title}" in_progress ${hours}h without checkpoint`,
          })
        }
      }
    }

    // 2. Dead agents with active tasks
    for (const [agentId, agent] of Object.entries(state.agents)) {
      if (agent.status === 'dead') {
        const activeTasks = Object.values(state.tasks).filter(
          t => t.assignee === agentId && ['in_progress', 'blocked'].includes(t.status)
        )
        if (activeTasks.length > 0) {
          errors.push({
            type: 'dead_agent_tasks',
            id: agentId,
            message: `Dead agent ${agentId} owns ${activeTasks.length} active task(s): ${activeTasks.map(t => t.id).join(', ')}. Run: macs reap`,
          })
        }
      }
    }

    // 3. Escalation timeout exceeded
    for (const task of Object.values(state.tasks)) {
      if (task.status === 'pending_human' && task.escalated_at) {
        const elapsed = now - new Date(task.escalated_at).getTime()
        if (task.escalation_timeout_ms && elapsed > task.escalation_timeout_ms) {
          errors.push({
            type: 'escalation_timeout',
            id: task.id,
            message: `${task.id} escalation timeout exceeded (${Math.floor(elapsed / 60000)}min elapsed)`,
          })
        } else if (elapsed > 24 * 60 * 60 * 1000) {
          warnings.push({
            type: 'escalation_stale',
            id: task.id,
            message: `${task.id} pending_human for >24h`,
          })
        }
      }
    }

    // 4. Reviews stale >4h
    for (const task of Object.values(state.tasks)) {
      if (task.status === 'review_required' && task.review_requested_at) {
        const elapsed = now - new Date(task.review_requested_at).getTime()
        if (elapsed > 4 * 60 * 60 * 1000) {
          warnings.push({
            type: 'review_stale',
            id: task.id,
            message: `${task.id} "${task.title}" awaiting review for ${Math.floor(elapsed / 3600000)}h`,
          })
        }
      }
    }

    // 5. Broken dependencies
    for (const task of Object.values(state.tasks)) {
      for (const dep of task.depends) {
        if (!state.tasks[dep]) {
          errors.push({
            type: 'broken_dependency',
            id: task.id,
            message: `${task.id} depends on non-existent task ${dep}`,
          })
        }
      }
    }

    // 6. Circular dependencies
    for (const task of Object.values(state.tasks)) {
      if (this._hasCircularDep(task.id, task.depends, state.tasks, new Set())) {
        errors.push({
          type: 'circular_dependency',
          id: task.id,
          message: `${task.id} has a circular dependency chain`,
        })
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    }
  }

  private _hasCircularDep(
    start: string,
    deps: string[],
    allTasks: Record<string, TaskState>,
    visited: Set<string>
  ): boolean {
    for (const dep of deps) {
      if (dep === start) return true
      if (visited.has(dep)) continue
      visited.add(dep)
      const depTask = allTasks[dep]
      if (depTask && this._hasCircularDep(start, depTask.depends, allTasks, visited)) return true
    }
    return false
  }

  // ----------------------------------------------------------
  // Template Market (4.4)
  // ----------------------------------------------------------

  static getTemplates(): Record<string, {
    name: string
    description: string
    tags: string[]
    tasks: Array<{
      _ref: string
      title: string
      priority?: 'critical' | 'high' | 'medium' | 'low'
      tags?: string[]
      depends_on?: string[]
      affects?: string[]
      estimate_ms?: number
      description?: string
      requires_capabilities?: string[]
    }>
  }> {
    return {
      'saas-mvp': {
        name: 'SaaS MVP',
        description: 'Standard SaaS MVP: auth, API, DB, frontend, deploy',
        tags: ['saas', 'web', 'fullstack'],
        tasks: [
          { _ref: 'db', title: 'Database schema & migrations', priority: 'critical', tags: ['backend', 'db'], affects: ['migrations/*', 'schema/*'], requires_capabilities: ['backend'], estimate_ms: 14400000 },
          { _ref: 'auth', title: 'User authentication (JWT/OAuth)', priority: 'critical', tags: ['backend', 'auth'], depends_on: ['db'], affects: ['src/auth/*'], requires_capabilities: ['backend'], estimate_ms: 18000000 },
          { _ref: 'api', title: 'REST API core endpoints', priority: 'high', tags: ['backend', 'api'], depends_on: ['db', 'auth'], affects: ['src/api/*'], requires_capabilities: ['backend'], estimate_ms: 28800000 },
          { _ref: 'frontend', title: 'Frontend app scaffold', priority: 'high', tags: ['frontend'], affects: ['src/frontend/*', 'src/components/*'], requires_capabilities: ['frontend'], estimate_ms: 21600000 },
          { _ref: 'ui-auth', title: 'Login/signup UI', priority: 'high', tags: ['frontend', 'auth'], depends_on: ['frontend', 'auth'], affects: ['src/components/auth/*'], requires_capabilities: ['frontend'], estimate_ms: 14400000 },
          { _ref: 'ui-main', title: 'Main dashboard UI', priority: 'medium', tags: ['frontend'], depends_on: ['ui-auth', 'api'], affects: ['src/components/dashboard/*'], requires_capabilities: ['frontend'], estimate_ms: 21600000 },
          { _ref: 'tests', title: 'Integration tests', priority: 'high', tags: ['testing'], depends_on: ['api', 'auth'], affects: ['tests/*'], requires_capabilities: ['testing'], estimate_ms: 14400000 },
          { _ref: 'deploy', title: 'CI/CD & deployment config', priority: 'medium', tags: ['devops'], depends_on: ['tests'], affects: ['.github/workflows/*', 'Dockerfile'], requires_capabilities: ['devops'], estimate_ms: 10800000 },
        ],
      },
      'api-service': {
        name: 'API Service',
        description: 'Standalone REST/GraphQL API service',
        tags: ['api', 'backend'],
        tasks: [
          { _ref: 'schema', title: 'API schema & data models', priority: 'critical', tags: ['backend'], affects: ['src/models/*'], requires_capabilities: ['backend'], estimate_ms: 10800000 },
          { _ref: 'endpoints', title: 'Core API endpoints', priority: 'critical', tags: ['backend', 'api'], depends_on: ['schema'], affects: ['src/routes/*', 'src/controllers/*'], requires_capabilities: ['backend'], estimate_ms: 28800000 },
          { _ref: 'auth', title: 'API key / JWT authentication', priority: 'high', tags: ['backend', 'auth'], depends_on: ['schema'], affects: ['src/middleware/*'], requires_capabilities: ['backend'], estimate_ms: 14400000 },
          { _ref: 'docs', title: 'OpenAPI / Swagger docs', priority: 'medium', tags: ['docs'], depends_on: ['endpoints'], affects: ['openapi.yaml', 'docs/*'], estimate_ms: 7200000 },
          { _ref: 'tests', title: 'API integration tests', priority: 'high', tags: ['testing'], depends_on: ['endpoints', 'auth'], affects: ['tests/*'], requires_capabilities: ['testing'], estimate_ms: 10800000 },
          { _ref: 'rate-limit', title: 'Rate limiting & security headers', priority: 'medium', tags: ['backend', 'security'], depends_on: ['auth'], affects: ['src/middleware/*'], requires_capabilities: ['backend'], estimate_ms: 7200000 },
        ],
      },
      'data-pipeline': {
        name: 'Data Pipeline',
        description: 'ETL pipeline: ingest → transform → store → visualize',
        tags: ['data', 'etl', 'analytics'],
        tasks: [
          { _ref: 'ingest', title: 'Data ingestion layer', priority: 'critical', tags: ['data', 'backend'], affects: ['src/ingest/*'], requires_capabilities: ['data', 'backend'], estimate_ms: 18000000 },
          { _ref: 'transform', title: 'Data transformation pipeline', priority: 'critical', tags: ['data'], depends_on: ['ingest'], affects: ['src/transform/*'], requires_capabilities: ['data'], estimate_ms: 21600000 },
          { _ref: 'storage', title: 'Data storage & schema', priority: 'high', tags: ['data', 'db'], depends_on: ['transform'], affects: ['src/storage/*', 'migrations/*'], requires_capabilities: ['data', 'backend'], estimate_ms: 14400000 },
          { _ref: 'api', title: 'Query API', priority: 'medium', tags: ['backend', 'api'], depends_on: ['storage'], affects: ['src/api/*'], requires_capabilities: ['backend'], estimate_ms: 14400000 },
          { _ref: 'viz', title: 'Visualization dashboard', priority: 'low', tags: ['frontend', 'data'], depends_on: ['api'], affects: ['src/dashboard/*'], requires_capabilities: ['frontend', 'data'], estimate_ms: 21600000 },
          { _ref: 'monitor', title: 'Pipeline monitoring & alerts', priority: 'medium', tags: ['devops', 'data'], depends_on: ['storage'], affects: ['src/monitoring/*'], estimate_ms: 10800000 },
        ],
      },
      'cli-tool': {
        name: 'CLI Tool',
        description: 'Command-line tool with install script and docs',
        tags: ['cli', 'tooling'],
        tasks: [
          { _ref: 'core', title: 'Core CLI logic', priority: 'critical', tags: ['backend'], affects: ['src/*', 'bin/*'], requires_capabilities: ['backend'], estimate_ms: 18000000 },
          { _ref: 'commands', title: 'Command definitions & help text', priority: 'high', tags: ['backend'], depends_on: ['core'], affects: ['src/commands/*'], requires_capabilities: ['backend'], estimate_ms: 14400000 },
          { _ref: 'config', title: 'Config file & env handling', priority: 'medium', tags: ['backend'], depends_on: ['core'], affects: ['src/config/*'], requires_capabilities: ['backend'], estimate_ms: 7200000 },
          { _ref: 'tests', title: 'CLI tests', priority: 'high', tags: ['testing'], depends_on: ['commands'], affects: ['tests/*'], requires_capabilities: ['testing'], estimate_ms: 10800000 },
          { _ref: 'install', title: 'Install script (cross-platform)', priority: 'medium', tags: ['devops'], depends_on: ['core'], affects: ['install.sh', 'scripts/*'], estimate_ms: 7200000 },
          { _ref: 'docs', title: 'README & usage docs', priority: 'medium', tags: ['docs'], depends_on: ['commands'], affects: ['README.md', 'docs/*'], estimate_ms: 5400000 },
        ],
      },
    }
  }

  applyTemplate(templateName: string, agentId: string): { taskIds: string[]; count: number } {
    const templates = MACSEngine.getTemplates()
    const template = templates[templateName]
    if (!template) {
      throw new Error(`Template "${templateName}" not found. Available: ${Object.keys(templates).join(', ')}`)
    }

    const idMap: Record<string, string> = {}
    const taskIds: string[] = []

    // Pass 1: create all tasks without dependencies
    for (const taskDef of template.tasks) {
      const task = this.createTask(agentId, {
        title: taskDef.title,
        priority: taskDef.priority || 'medium',
        tags: taskDef.tags || [],
        depends: [],
        affects: taskDef.affects || [],
        estimate_ms: taskDef.estimate_ms,
        description: taskDef.description,
        requires_capabilities: taskDef.requires_capabilities,
      })
      idMap[taskDef._ref] = task.id
      taskIds.push(task.id)
    }

    // Pass 2: wire up dependencies
    for (const taskDef of template.tasks) {
      if (taskDef.depends_on && taskDef.depends_on.length > 0) {
        const depIds = taskDef.depends_on.map(ref => idMap[ref]).filter(Boolean)
        if (depIds.length > 0) {
          this.appendTaskEvent({
            type: 'task_updated',
            id: idMap[taskDef._ref],
            ts: new Date().toISOString(),
            by: agentId,
            data: { field: 'depends', from: [], to: depIds },
          })
        }
      }
    }

    return { taskIds, count: taskIds.length }
  }

  analyzeImpact(file: string): {
    affected_tasks: TaskState[]
    affected_agents: string[]
  } {
    const state = this.getState()
    const affectedTasks: TaskState[] = []
    const affectedAgents = new Set<string>()

    for (const task of Object.values(state.tasks)) {
      if (task.status === 'completed' || task.status === 'cancelled') continue

      const isAffected = task.affects.some(pattern => {
        if (pattern.endsWith('*')) {
          return file.startsWith(pattern.slice(0, -1))
        }
        return file === pattern
      })

      if (isAffected) {
        affectedTasks.push(task)
        if (task.assignee) affectedAgents.add(task.assignee)
      }
    }

    return {
      affected_tasks: affectedTasks,
      affected_agents: Array.from(affectedAgents),
    }
  }
}
