/**
 * MACS Protocol v3.0 — Type Definitions
 *
 * Core principle: Append-only JSONL events → rebuildable state → auto-generated Markdown
 * All timestamps are ISO 8601. All IDs are prefixed (T-, C-, E-, MSG-).
 */

// ============================================================
// Event Types — the atomic units of the protocol
// ============================================================

/** All possible event types in tasks.jsonl */
export type TaskEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_unassigned'
  | 'task_started'
  | 'task_blocked'
  | 'task_unblocked'
  | 'task_completed'
  | 'task_cancelled'
  | 'task_priority_changed'
  | 'task_updated'
  | 'task_decomposed'
  | 'task_checkpoint'
  | 'task_review_requested'   // 3.10: task goes to review_required
  | 'task_reviewed'           // 3.10: reviewer approves or rejects
  | 'task_escalated'          // 3.11: escalated to human

/** All possible event types in events.jsonl */
export type GlobalEventType =
  | 'file_modified'
  | 'decision_made'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'test_passed'
  | 'test_failed'
  | 'agent_registered'
  | 'agent_heartbeat'
  | 'agent_offline'
  | 'agent_dead'              // 3.12: agent marked dead, tasks reassigned
  | 'lock_acquired'
  | 'lock_released'
  | 'breaking_change'

// ============================================================
// Task Events (tasks.jsonl)
// ============================================================

export interface TaskEventBase {
  type: TaskEventType
  id: string           // Task ID: T-001, T-002...
  ts: string           // ISO 8601
  by: string           // Agent ID who triggered this event
  seq?: number         // Auto-incremented sequence number
}

export interface TaskCreatedEvent extends TaskEventBase {
  type: 'task_created'
  data: {
    title: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    tags: string[]
    depends: string[]         // Task IDs this depends on
    affects: string[]         // File globs this task will touch
    estimate_ms?: number
    description?: string
    requires_capabilities?: string[]  // 3.1: agent must have ≥1 of these
  }
}

export interface TaskAssignedEvent extends TaskEventBase {
  type: 'task_assigned'
  data: {
    assignee: string          // Agent ID
  }
}

export interface TaskUnassignedEvent extends TaskEventBase {
  type: 'task_unassigned'
  data: {
    previous_assignee: string
    reason?: string
  }
}

export interface TaskStartedEvent extends TaskEventBase {
  type: 'task_started'
  data: {}
}

export interface TaskBlockedEvent extends TaskEventBase {
  type: 'task_blocked'
  data: {
    reason: 'need_decision' | 'dependency' | 'conflict' | 'external' | 'other'
    description: string
    escalate_to?: string      // Agent ID to escalate to
    handoff_note?: string     // Structured handoff: ✓ done / → next / ⚠ issues / ? questions
  }
}

export interface TaskUnblockedEvent extends TaskEventBase {
  type: 'task_unblocked'
  data: {
    decision?: string
    context?: string
  }
}

export interface TaskCompletedEvent extends TaskEventBase {
  type: 'task_completed'
  data: {
    actual_ms?: number
    artifacts: string[]       // Files created/modified
    summary?: string
  }
}

export interface TaskCancelledEvent extends TaskEventBase {
  type: 'task_cancelled'
  data: {
    reason: string
    handoff_note?: string     // Structured handoff for next agent
  }
}

export interface TaskPriorityChangedEvent extends TaskEventBase {
  type: 'task_priority_changed'
  data: {
    from: string
    to: string
    reason?: string
  }
}

export interface TaskUpdatedEvent extends TaskEventBase {
  type: 'task_updated'
  data: {
    field: string
    from: unknown
    to: unknown
  }
}

export interface TaskDecomposedEvent extends TaskEventBase {
  type: 'task_decomposed'
  data: {
    subtask_ids: string[]     // IDs of created subtasks
    rationale?: string        // Why decomposed
  }
}

export interface TaskCheckpointEvent extends TaskEventBase {
  type: 'task_checkpoint'
  data: {
    note: string              // ✓→⚠? format: progress summary
    progress?: number         // 0.0 - 1.0 optional
  }
}

export interface TaskReviewRequestedEvent extends TaskEventBase {
  type: 'task_review_requested'
  data: {
    note?: string             // What the completing agent wants reviewed
    suggested_reviewer?: string
  }
}

export interface TaskReviewedEvent extends TaskEventBase {
  type: 'task_reviewed'
  data: {
    result: 'approved' | 'rejected'
    note?: string             // Reviewer's feedback
  }
}

export interface TaskEscalatedEvent extends TaskEventBase {
  type: 'task_escalated'
  data: {
    reason: string            // Why escalation is needed
    escalate_to?: string      // Human or lead agent ID
    timeout_ms?: number       // Auto-resume after N ms if no response
  }
}

export type TaskEvent =
  | TaskCreatedEvent
  | TaskAssignedEvent
  | TaskUnassignedEvent
  | TaskStartedEvent
  | TaskBlockedEvent
  | TaskUnblockedEvent
  | TaskCompletedEvent
  | TaskCancelledEvent
  | TaskPriorityChangedEvent
  | TaskUpdatedEvent
  | TaskDecomposedEvent
  | TaskCheckpointEvent
  | TaskReviewRequestedEvent
  | TaskReviewedEvent
  | TaskEscalatedEvent

// ============================================================
// Global Events (events.jsonl)
// ============================================================

export interface GlobalEventBase {
  type: GlobalEventType
  ts: string
  by: string
  task?: string              // Related task ID (optional)
  seq?: number
}

export interface FileModifiedEvent extends GlobalEventBase {
  type: 'file_modified'
  data: {
    path: string
    diff_summary: string     // e.g. "+150 -20"
    purpose?: string
  }
}

export interface DecisionMadeEvent extends GlobalEventBase {
  type: 'decision_made'
  data: {
    question: string
    decision: string
    alternatives?: string[]
    rationale: string
  }
}

export interface ConflictDetectedEvent extends GlobalEventBase {
  type: 'conflict_detected'
  by: 'system'
  data: {
    file: string
    agents: string[]
    description?: string
  }
}

export interface ConflictResolvedEvent extends GlobalEventBase {
  type: 'conflict_resolved'
  data: {
    file: string
    strategy: 'last_write_wins' | 'manual' | 'merge'
    winner?: string
    description?: string
  }
}

export interface TestPassedEvent extends GlobalEventBase {
  type: 'test_passed'
  data: {
    suite: string
    tests: number
    passed: number
    duration_ms: number
  }
}

export interface TestFailedEvent extends GlobalEventBase {
  type: 'test_failed'
  data: {
    suite: string
    tests: number
    passed: number
    failed: number
    errors: string[]
    duration_ms: number
  }
}

export interface AgentRegisteredEvent extends GlobalEventBase {
  type: 'agent_registered'
  data: {
    agent_id: string
    capabilities: string[]
    model?: string
    role?: string
  }
}

export interface AgentHeartbeatEvent extends GlobalEventBase {
  type: 'agent_heartbeat'
  data: {
    status: 'busy' | 'idle' | 'blocked'
    current_task?: string
    progress?: number        // 0.0 - 1.0
    eta_ms?: number
  }
}

export interface AgentOfflineEvent extends GlobalEventBase {
  type: 'agent_offline'
  by: 'system'
  data: {
    agent_id: string
    last_seen: string
    current_task?: string
    action: 'reassign_task' | 'wait' | 'none'
  }
}

export interface AgentDeadEvent extends GlobalEventBase {
  type: 'agent_dead'
  by: 'system'
  data: {
    agent_id: string
    last_heartbeat: string
    silent_ms: number
    reassigned_tasks: string[]   // Task IDs reassigned to pending
  }
}

export interface LockAcquiredEvent extends GlobalEventBase {
  type: 'lock_acquired'
  data: {
    file: string
    reason?: string
    eta_ms?: number
  }
}

export interface LockReleasedEvent extends GlobalEventBase {
  type: 'lock_released'
  data: {
    file: string
  }
}

export interface BreakingChangeEvent extends GlobalEventBase {
  type: 'breaking_change'
  data: {
    file: string
    description: string
    affected_agents: string[]
    migration?: string
  }
}

export type GlobalEvent =
  | FileModifiedEvent
  | DecisionMadeEvent
  | ConflictDetectedEvent
  | ConflictResolvedEvent
  | TestPassedEvent
  | TestFailedEvent
  | AgentRegisteredEvent
  | AgentHeartbeatEvent
  | AgentOfflineEvent
  | AgentDeadEvent
  | LockAcquiredEvent
  | LockReleasedEvent
  | BreakingChangeEvent

// ============================================================
// State (state.json) — rebuilt from events
// ============================================================

export interface TaskState {
  id: string
  status: 'pending' | 'assigned' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
        | 'waiting_for_subtasks'
        | 'review_required'    // 3.10: awaiting peer review
        | 'under_review'       // 3.10: reviewer is active
        | 'pending_human'      // 3.11: escalated, waiting for human decision
  title: string
  assignee: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  tags: string[]
  depends: string[]
  affects: string[]
  requires_capabilities?: string[]  // 3.1: agent must have ≥1 of these to claim
  created_at: string
  created_by: string
  started_at?: string
  completed_at?: string
  cancelled_at?: string
  estimate_ms?: number
  actual_ms?: number
  artifacts: string[]
  blocked_history: BlockedRecord[]
  description?: string
  summary?: string
  handoff_note?: string        // Most recent handoff (from block or cancel)
  last_checkpoint_at?: string  // Timestamp of last macs checkpoint
  drift_suspected?: boolean    // True if silent longer than drift threshold
  // Decomposition fields (2.27)
  parent_task?: string
  subtasks?: string[]
  goal_chain?: string[]
  // Review fields (3.10)
  reviewer?: string
  review_result?: 'approved' | 'rejected'
  review_note?: string
  review_requested_at?: string
  // Escalation fields (3.11)
  escalated_to?: string
  escalation_reason?: string
  escalated_at?: string
  escalation_timeout_ms?: number
}

export interface BlockedRecord {
  blocked_at: string
  unblocked_at?: string
  duration_ms?: number
  reason: string
  decision?: string
  handoff_note?: string   // Structured handoff left by blocking agent
}

export interface AgentState {
  id: string
  status: 'idle' | 'busy' | 'blocked' | 'offline' | 'dead'  // 3.12
  capabilities: string[]
  model?: string
  role?: string
  current_task: string | null
  registered_at: string
  last_heartbeat: string
  stats: AgentStats
}

export interface AgentStats {
  tasks_completed: number
  tasks_cancelled: number
  total_time_ms: number
  avg_task_time_ms: number
  blocked_count: number
  blocked_time_ms: number
}

export interface LockState {
  file: string
  locked_by: string
  locked_at: string
  reason?: string
  eta_ms?: number
}

export interface ProjectMetrics {
  total_tasks: number
  completed: number
  in_progress: number
  blocked: number
  pending: number
  cancelled: number
  waiting_for_subtasks: number
  review_required: number      // 3.10
  pending_human: number        // 3.11
  avg_completion_time_ms: number
  total_events: number
  active_agents: number
  dead_agents: number          // 3.12
  conflict_count: number
  breaking_changes: number
}

export interface MACSState {
  version: '3.0'
  project?: string
  updated_at: string
  last_event_seq: number
  tasks: Record<string, TaskState>
  agents: Record<string, AgentState>
  locks: LockState[]
  metrics: ProjectMetrics
}

// ============================================================
// Messages (sync/inbox/)
// ============================================================

export interface AgentMessage {
  id: string               // MSG-001, MSG-002...
  from: string
  to: string
  ts: string
  type: 'task_assigned' | 'decision_response' | 'conflict_notification'
      | 'breaking_change_alert' | 'general' | 'review_request'
  re?: string              // Related task ID
  data: Record<string, unknown>
  read: boolean
}

// ============================================================
// Config (.macs/macs.json)
// ============================================================

export interface MACSConfig {
  version: '3.0'
  project: string
  created_at: string
  settings: {
    heartbeat_interval_ms: number       // Default: 300000 (5 min)
    offline_threshold_ms: number        // Default: 900000 (15 min)
    auto_reassign_on_offline: boolean   // Default: true
    lock_timeout_ms: number             // Default: 600000 (10 min)
    generate_human_readable: boolean    // Default: true
    conflict_resolution: 'last_write_wins' | 'manual'  // Default: last_write_wins
    max_concurrent_tasks_per_agent?: number  // Default: 3 (load balancing cap)
  }
}
