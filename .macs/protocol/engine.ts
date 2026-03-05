/**
 * MACS Protocol Engine v3.0
 *
 * Core: Append events → Rebuild state → Query state
 * All writes go to JSONL (append-only). State is a cached projection.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type {
  TaskEvent, GlobalEvent, MACSState, TaskState, AgentState,
  AgentMessage, MACSConfig, LockState, ProjectMetrics,
  BlockedRecord, AgentStats
} from './schema.js'

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

  constructor(projectRoot: string) {
    this.dir = join(projectRoot, '.macs')
    this.protocolDir = join(this.dir, 'protocol')
    this.syncDir = join(this.dir, 'sync', 'inbox')
    this.humanDir = join(this.dir, 'human')
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
      version: '3.0',
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
    const full = { ...event, seq } as TaskEvent
    appendJsonl(join(this.protocolDir, 'tasks.jsonl'), full)
    this.rebuildState()
    return full
  }

  appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): GlobalEvent {
    const seq = getNextSeq(this.protocolDir)
    const full = { ...event, seq } as GlobalEvent
    appendJsonl(join(this.protocolDir, 'events.jsonl'), full)
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
      version: '3.0',
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

    // Auto-claim: find best available task (capability-filtered)
    const available = this.findTasks({ status: 'pending', assignee: null, unblocked: true, capable_agent: agentId })
    if (available.length === 0) return null

    // Sort by priority
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
  }): void {
    this.appendGlobalEvent({
      type: 'agent_registered',
      ts: new Date().toISOString(),
      by: agentId,
      data: { agent_id: agentId, ...data },
    })
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
