/**
 * Dashboard Analyzer v2
 * Reads Protocol v3 data (state.json + events.jsonl + tasks.jsonl)
 * Replaces old Markdown index approach
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'

// ── Helpers ────────────────────────────────────────────────────────────────

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  try {
    return readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l) as T)
  } catch {
    return []
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface DashboardData {
  project: string
  generatedAt: string
  version: string

  stats: {
    totalTasks: number
    completed: number
    inProgress: number
    pending: number
    blocked: number
    reviewRequired: number
    pendingHuman: number
    cancelled: number
    totalAgents: number
    idleAgents: number
    deadAgents: number
  }

  agents: Array<{
    id: string
    status: string
    capabilities: string[]
    activeTasks: number
    completedTasks: number
    lastHeartbeat: string
  }>

  tasks: Array<{
    id: string
    title: string
    status: string
    priority: string
    assignee: string | null
    depends: string[]
    tags: string[]
    driftSuspected: boolean
    createdAt: string
    startedAt?: string
    completedAt?: string
  }>

  dependencyEdges: Array<{ from: string; to: string }>

  // Last 100 events, newest first
  eventTimeline: Array<{
    seq: number
    ts: string
    type: string
    taskId?: string
    by: string
    summary: string
  }>

  fileHeatmap: Array<{ file: string; count: number }>

  driftAlerts: Array<{
    taskId: string
    title: string
    assignee: string | null
    type: string
    recommended_action: string
    spinningFiles?: Array<{ file: string; count: number }>
  }>

  completionsByDay: Array<{ date: string; count: number }>
}

// ── Analyzer ───────────────────────────────────────────────────────────────

export class DashboardAnalyzer {
  private protocolDir: string
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.protocolDir = path.join(projectPath, '.macs', 'protocol')
  }

  analyze(): DashboardData {
    const stateFile  = path.join(this.protocolDir, 'state.json')
    const eventsFile = path.join(this.protocolDir, 'events.jsonl')
    const tasksFile  = path.join(this.protocolDir, 'tasks.jsonl')
    const configFile = path.join(this.projectPath, '.macs', 'macs.json')

    const config      = readJson<any>(configFile)
    const state       = readJson<any>(stateFile)
    const taskEvents  = readJsonl<any>(tasksFile)
    const globalEvts  = readJsonl<any>(eventsFile)

    if (!state) return this.empty(config?.project ?? path.basename(this.projectPath))

    const tasks  = Object.values(state.tasks  ?? {}) as any[]
    const agents = Object.values(state.agents ?? {}) as any[]

    // Stats
    const stats = {
      totalTasks:    tasks.length,
      completed:     tasks.filter(t => t.status === 'completed').length,
      inProgress:    tasks.filter(t => t.status === 'in_progress').length,
      pending:       tasks.filter(t => t.status === 'pending').length,
      blocked:       tasks.filter(t => t.status === 'blocked').length,
      reviewRequired:tasks.filter(t => t.status === 'review_required').length,
      pendingHuman:  tasks.filter(t => t.status === 'pending_human').length,
      cancelled:     tasks.filter(t => t.status === 'cancelled').length,
      totalAgents:   agents.length,
      idleAgents:    agents.filter((a:any) => a.status === 'idle').length,
      deadAgents:    agents.filter((a:any) => a.status === 'dead').length,
    }

    // Agent workload
    const loadMap: Record<string, number> = {}
    for (const a of agents) loadMap[a.id] = 0
    for (const t of tasks) {
      if (t.assignee && ['in_progress','assigned','review_required'].includes(t.status))
        loadMap[t.assignee] = (loadMap[t.assignee] ?? 0) + 1
    }
    const doneByAgent: Record<string, number> = {}
    for (const e of taskEvents) {
      if (e.type === 'task_completed') doneByAgent[e.by] = (doneByAgent[e.by] ?? 0) + 1
    }
    const agentList = agents
      .map((a:any) => ({
        id: a.id, status: a.status, capabilities: a.capabilities ?? [],
        activeTasks: loadMap[a.id] ?? 0, completedTasks: doneByAgent[a.id] ?? 0,
        lastHeartbeat: a.last_heartbeat ?? '',
      }))
      .sort((x:any, y:any) => y.activeTasks - x.activeTasks)

    // Task list
    const taskList = tasks
      .map((t:any) => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        assignee: t.assignee ?? null, depends: t.depends ?? [], tags: t.tags ?? [],
        driftSuspected: t.drift_suspected ?? false,
        createdAt: t.created_at, startedAt: t.started_at, completedAt: t.completed_at,
      }))
      .sort((a:any, b:any) => a.id.localeCompare(b.id))

    // Dependency edges
    const dependencyEdges: DashboardData['dependencyEdges'] = []
    for (const t of tasks)
      for (const dep of (t.depends ?? []))
        dependencyEdges.push({ from: dep, to: t.id })

    // Event timeline (newest first, last 100)
    const allEvts = [
      ...taskEvents.map((e:any) => ({ ...e, _src: 'task' })),
      ...globalEvts .map((e:any) => ({ ...e, _src: 'global' })),
    ].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0)).slice(0, 100)

    const eventTimeline = allEvts.map((e:any) => ({
      seq:    e.seq ?? 0,
      ts:     e.ts  ?? '',
      type:   e.type,
      taskId: e.id ?? e.task ?? undefined,
      by:     e.by ?? 'system',
      summary: this.summarize(e),
    }))

    // File heatmap
    const fileCnt: Record<string, number> = {}
    for (const e of globalEvts)
      if (e.type === 'file_modified' && e.data?.path)
        fileCnt[e.data.path] = (fileCnt[e.data.path] ?? 0) + 1
    const fileHeatmap = Object.entries(fileCnt)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count).slice(0, 20)

    // Smart drift (spinning)
    const driftAlerts = this.driftScan(tasks, globalEvts)

    // Completions by day
    const dayMap: Record<string, number> = {}
    for (const e of taskEvents)
      if (e.type === 'task_completed' && e.ts)
        dayMap[e.ts.slice(0,10)] = (dayMap[e.ts.slice(0,10)] ?? 0) + 1
    const completionsByDay = Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      project: config?.project ?? path.basename(this.projectPath),
      generatedAt: new Date().toISOString(),
      version: state.version ?? '3.0',
      stats, agents: agentList, tasks: taskList,
      dependencyEdges, eventTimeline, fileHeatmap, driftAlerts, completionsByDay,
    }
  }

  private summarize(e: any): string {
    const id = e.id ?? e.task ?? ''
    const p = id ? `[${id}] ` : ''
    switch (e.type) {
      case 'task_created':          return `${p}created "${e.data?.title ?? ''}"`
      case 'task_assigned':         return `${p}assigned → ${e.data?.assignee ?? '?'}`
      case 'task_started':          return `${p}started by ${e.by}`
      case 'task_completed':        return `${p}completed by ${e.by}`
      case 'task_blocked':          return `${p}blocked: ${e.data?.reason ?? ''}`
      case 'task_unblocked':        return `${p}unblocked`
      case 'task_cancelled':        return `${p}cancelled`
      case 'task_review_requested': return `${p}review requested`
      case 'task_reviewed':         return `${p}reviewed: ${e.data?.result ?? ''}`
      case 'task_escalated':        return `${p}escalated to human`
      case 'agent_dead':            return `agent ${e.data?.agent_id} dead — ${e.data?.reassigned_tasks?.length ?? 0} tasks reassigned`
      case 'file_modified':         return `${p}${e.data?.path} modified`
      case 'decision_made':         return `${p}decision: ${e.data?.decision ?? ''}`
      default:                      return `${e.type} by ${e.by}`
    }
  }

  private driftScan(tasks: any[], globalEvts: any[]): DashboardData['driftAlerts'] {
    const results: DashboardData['driftAlerts'] = []
    for (const t of tasks) {
      if (t.status !== 'in_progress' && t.status !== 'review_required') continue
      const fileMods = globalEvts.filter(e => e.type === 'file_modified' && e.task === t.id)
      const cnt: Record<string, number> = {}
      for (const e of fileMods) cnt[e.data?.path] = (cnt[e.data?.path] ?? 0) + 1
      const spinning = Object.entries(cnt).filter(([,c]) => c >= 3)
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)
      if (spinning.length > 0) {
        results.push({
          taskId: t.id, title: t.title, assignee: t.assignee ?? null, type: 'spinning',
          recommended_action: `Request checkpoint: "${spinning[0].file}" modified ${spinning[0].count}x`,
          spinningFiles: spinning,
        })
      }
    }
    return results
  }

  private empty(project: string): DashboardData {
    return {
      project, generatedAt: new Date().toISOString(), version: '3.0',
      stats: { totalTasks:0,completed:0,inProgress:0,pending:0,blocked:0,reviewRequired:0,pendingHuman:0,cancelled:0,totalAgents:0,idleAgents:0,deadAgents:0 },
      agents:[], tasks:[], dependencyEdges:[], eventTimeline:[], fileHeatmap:[], driftAlerts:[], completionsByDay:[],
    }
  }
}
