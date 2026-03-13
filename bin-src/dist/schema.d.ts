/**
 * MACS Protocol v4.1 — Type Definitions
 *
 * Core principle: Append-only JSONL events → rebuildable state → auto-generated Markdown
 * All timestamps are ISO 8601. All IDs are prefixed (T-, C-, E-, MSG-).
 */
/** Current spec version — written into every event for forward compatibility */
export declare const MACS_SPEC_VERSION = "4.1";
/** All possible event types in tasks.jsonl */
export type TaskEventType = 'task_created' | 'task_assigned' | 'task_unassigned' | 'task_started' | 'task_blocked' | 'task_unblocked' | 'task_completed' | 'task_cancelled' | 'task_priority_changed' | 'task_updated' | 'task_decomposed' | 'task_checkpoint' | 'task_review_requested' | 'task_reviewed' | 'task_escalated';
/** All possible event types in events.jsonl */
export type GlobalEventType = 'file_modified' | 'decision_made' | 'conflict_detected' | 'conflict_resolved' | 'test_passed' | 'test_failed' | 'agent_registered' | 'agent_heartbeat' | 'agent_offline' | 'agent_dead' | 'lock_acquired' | 'lock_released' | 'breaking_change';
export interface TaskEventBase {
    spec_version?: string;
    type: TaskEventType;
    id: string;
    ts: string;
    by: string;
    seq?: number;
}
export interface TaskCreatedEvent extends TaskEventBase {
    type: 'task_created';
    data: {
        title: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        tags: string[];
        depends: string[];
        affects: string[];
        estimate_ms?: number;
        description?: string;
        requires_capabilities?: string[];
    };
}
export interface TaskAssignedEvent extends TaskEventBase {
    type: 'task_assigned';
    data: {
        assignee: string;
    };
}
export interface TaskUnassignedEvent extends TaskEventBase {
    type: 'task_unassigned';
    data: {
        previous_assignee: string;
        reason?: string;
    };
}
export interface TaskStartedEvent extends TaskEventBase {
    type: 'task_started';
    data: {};
}
export interface TaskBlockedEvent extends TaskEventBase {
    type: 'task_blocked';
    data: {
        reason: 'need_decision' | 'dependency' | 'conflict' | 'external' | 'other';
        description: string;
        escalate_to?: string;
        handoff_note?: string;
    };
}
export interface TaskUnblockedEvent extends TaskEventBase {
    type: 'task_unblocked';
    data: {
        decision?: string;
        context?: string;
    };
}
export interface TaskCompletedEvent extends TaskEventBase {
    type: 'task_completed';
    data: {
        actual_ms?: number;
        artifacts: string[];
        summary?: string;
    };
}
export interface TaskCancelledEvent extends TaskEventBase {
    type: 'task_cancelled';
    data: {
        reason: string;
        handoff_note?: string;
    };
}
export interface TaskPriorityChangedEvent extends TaskEventBase {
    type: 'task_priority_changed';
    data: {
        from: string;
        to: string;
        reason?: string;
    };
}
export interface TaskUpdatedEvent extends TaskEventBase {
    type: 'task_updated';
    data: {
        field: string;
        from: unknown;
        to: unknown;
    };
}
export interface TaskDecomposedEvent extends TaskEventBase {
    type: 'task_decomposed';
    data: {
        subtask_ids: string[];
        rationale?: string;
    };
}
export interface TaskCheckpointEvent extends TaskEventBase {
    type: 'task_checkpoint';
    data: {
        note: string;
        progress?: number;
    };
}
export interface TaskReviewRequestedEvent extends TaskEventBase {
    type: 'task_review_requested';
    data: {
        note?: string;
        suggested_reviewer?: string;
    };
}
export interface TaskReviewedEvent extends TaskEventBase {
    type: 'task_reviewed';
    data: {
        result: 'approved' | 'rejected';
        note?: string;
    };
}
export interface TaskEscalatedEvent extends TaskEventBase {
    type: 'task_escalated';
    data: {
        reason: string;
        escalate_to?: string;
        timeout_ms?: number;
    };
}
export type TaskEvent = TaskCreatedEvent | TaskAssignedEvent | TaskUnassignedEvent | TaskStartedEvent | TaskBlockedEvent | TaskUnblockedEvent | TaskCompletedEvent | TaskCancelledEvent | TaskPriorityChangedEvent | TaskUpdatedEvent | TaskDecomposedEvent | TaskCheckpointEvent | TaskReviewRequestedEvent | TaskReviewedEvent | TaskEscalatedEvent;
export interface GlobalEventBase {
    spec_version?: string;
    type: GlobalEventType;
    ts: string;
    by: string;
    task?: string;
    seq?: number;
}
export interface FileModifiedEvent extends GlobalEventBase {
    type: 'file_modified';
    data: {
        path: string;
        diff_summary: string;
        purpose?: string;
    };
}
export interface DecisionMadeEvent extends GlobalEventBase {
    type: 'decision_made';
    data: {
        question: string;
        decision: string;
        alternatives?: string[];
        rationale: string;
    };
}
export interface ConflictDetectedEvent extends GlobalEventBase {
    type: 'conflict_detected';
    by: 'system';
    data: {
        file: string;
        agents: string[];
        description?: string;
    };
}
export interface ConflictResolvedEvent extends GlobalEventBase {
    type: 'conflict_resolved';
    data: {
        file: string;
        strategy: 'last_write_wins' | 'manual' | 'merge';
        winner?: string;
        description?: string;
    };
}
export interface TestPassedEvent extends GlobalEventBase {
    type: 'test_passed';
    data: {
        suite: string;
        tests: number;
        passed: number;
        duration_ms: number;
    };
}
export interface TestFailedEvent extends GlobalEventBase {
    type: 'test_failed';
    data: {
        suite: string;
        tests: number;
        passed: number;
        failed: number;
        errors: string[];
        duration_ms: number;
    };
}
export interface AgentRegisteredEvent extends GlobalEventBase {
    type: 'agent_registered';
    data: {
        agent_id: string;
        instance_id: string;
        session_id?: string;
        capabilities: string[];
        model?: string;
        role?: string;
    };
}
export interface AgentHeartbeatEvent extends GlobalEventBase {
    type: 'agent_heartbeat';
    data: {
        status: 'busy' | 'idle' | 'blocked';
        current_task?: string;
        progress?: number;
        eta_ms?: number;
    };
}
export interface AgentOfflineEvent extends GlobalEventBase {
    type: 'agent_offline';
    by: 'system';
    data: {
        agent_id: string;
        last_seen: string;
        current_task?: string;
        action: 'reassign_task' | 'wait' | 'none';
    };
}
export interface AgentDeadEvent extends GlobalEventBase {
    type: 'agent_dead';
    by: 'system';
    data: {
        agent_id: string;
        last_heartbeat: string;
        silent_ms: number;
        reassigned_tasks: string[];
    };
}
export interface LockAcquiredEvent extends GlobalEventBase {
    type: 'lock_acquired';
    data: {
        file: string;
        reason?: string;
        eta_ms?: number;
    };
}
export interface LockReleasedEvent extends GlobalEventBase {
    type: 'lock_released';
    data: {
        file: string;
    };
}
export interface BreakingChangeEvent extends GlobalEventBase {
    type: 'breaking_change';
    data: {
        file: string;
        description: string;
        affected_agents: string[];
        migration?: string;
    };
}
export type GlobalEvent = FileModifiedEvent | DecisionMadeEvent | ConflictDetectedEvent | ConflictResolvedEvent | TestPassedEvent | TestFailedEvent | AgentRegisteredEvent | AgentHeartbeatEvent | AgentOfflineEvent | AgentDeadEvent | LockAcquiredEvent | LockReleasedEvent | BreakingChangeEvent;
export interface TaskState {
    id: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'waiting_for_subtasks' | 'review_required' | 'under_review' | 'pending_human';
    title: string;
    assignee: string | null;
    priority: 'critical' | 'high' | 'medium' | 'low';
    tags: string[];
    depends: string[];
    affects: string[];
    requires_capabilities?: string[];
    created_at: string;
    created_by: string;
    started_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    estimate_ms?: number;
    actual_ms?: number;
    artifacts: string[];
    blocked_history: BlockedRecord[];
    description?: string;
    summary?: string;
    handoff_note?: string;
    last_checkpoint_at?: string;
    drift_suspected?: boolean;
    parent_task?: string;
    subtasks?: string[];
    goal_chain?: string[];
    reviewer?: string;
    review_result?: 'approved' | 'rejected';
    review_note?: string;
    review_requested_at?: string;
    escalated_to?: string;
    escalation_reason?: string;
    escalated_at?: string;
    escalation_timeout_ms?: number;
}
export interface BlockedRecord {
    blocked_at: string;
    unblocked_at?: string;
    duration_ms?: number;
    reason: string;
    decision?: string;
    handoff_note?: string;
}
export interface AgentState {
    id: string;
    instance_id?: string;
    session_id?: string;
    status: 'idle' | 'busy' | 'blocked' | 'offline' | 'dead';
    capabilities: string[];
    model?: string;
    role?: string;
    current_task: string | null;
    registered_at: string;
    last_heartbeat: string;
    stats: AgentStats;
}
export interface AgentStats {
    tasks_completed: number;
    tasks_cancelled: number;
    total_time_ms: number;
    avg_task_time_ms: number;
    blocked_count: number;
    blocked_time_ms: number;
}
export interface LockState {
    file: string;
    locked_by: string;
    locked_at: string;
    reason?: string;
    eta_ms?: number;
}
export interface ProjectMetrics {
    total_tasks: number;
    completed: number;
    in_progress: number;
    blocked: number;
    pending: number;
    cancelled: number;
    waiting_for_subtasks: number;
    review_required: number;
    pending_human: number;
    avg_completion_time_ms: number;
    total_events: number;
    active_agents: number;
    dead_agents: number;
    conflict_count: number;
    breaking_changes: number;
}
export interface MACSState {
    version: '3.0' | '4.1';
    project?: string;
    updated_at: string;
    last_event_seq: number;
    tasks: Record<string, TaskState>;
    agents: Record<string, AgentState>;
    locks: LockState[];
    metrics: ProjectMetrics;
}
export interface AgentMessage {
    id: string;
    from: string;
    to: string;
    ts: string;
    type: 'task_assigned' | 'decision_response' | 'conflict_notification' | 'breaking_change_alert' | 'general' | 'review_request';
    re?: string;
    data: Record<string, unknown>;
    read: boolean;
}
export interface MACSConfig {
    version: '3.0' | '4.1';
    project: string;
    created_at: string;
    settings: {
        heartbeat_interval_ms: number;
        offline_threshold_ms: number;
        auto_reassign_on_offline: boolean;
        lock_timeout_ms: number;
        generate_human_readable: boolean;
        conflict_resolution: 'last_write_wins' | 'manual';
        max_concurrent_tasks_per_agent?: number;
        events_sharding?: boolean;
    };
}
