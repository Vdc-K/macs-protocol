/**
 * MACS Protocol Engine v3.0
 *
 * Core: Append events → Rebuild state → Query state
 * All writes go to JSONL (append-only). State is a cached projection.
 */
import type { TaskEvent, GlobalEvent, MACSState, TaskState, AgentState, AgentMessage, MACSConfig } from './schema.js';
export interface MACSPlugin {
    name: string;
    version?: string;
    hooks?: {
        onTaskCreated?: (task: TaskState) => void;
        onTaskCompleted?: (task: TaskState) => void;
        onTaskBlocked?: (task: TaskState) => void;
        onTaskReviewed?: (task: TaskState, result: 'approved' | 'rejected') => void;
        onAgentRegistered?: (agentId: string, capabilities: string[]) => void;
        onEscalation?: (task: TaskState) => void;
        onDeadAgent?: (agentId: string, reassignedTasks: string[]) => void;
    };
}
export declare class MACSEngine {
    private dir;
    private protocolDir;
    private syncDir;
    private humanDir;
    private plugins;
    constructor(projectRoot: string);
    getPlugins(): MACSPlugin[];
    registerPlugin(plugin: MACSPlugin): void;
    private emit;
    init(projectName: string): MACSConfig;
    appendTaskEvent(event: Omit<TaskEvent, 'seq'>): TaskEvent;
    appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): GlobalEvent;
    getTaskEvents(): TaskEvent[];
    getGlobalEvents(): GlobalEvent[];
    rebuildState(): MACSState;
    getState(): MACSState;
    findTasks(filter: {
        status?: TaskState['status'];
        assignee?: string | null;
        priority?: TaskState['priority'];
        tag?: string;
        unblocked?: boolean;
        capable_agent?: string;
    }): TaskState[];
    findIdleAgents(): AgentState[];
    /** Returns active task count per agent (in_progress + assigned + review_required) */
    getAgentWorkload(): Record<string, number>;
    /**
     * Suggests the best available agent for a task.
     * Prefers idle agents, then least-loaded, filtered by capability.
     */
    suggestAgent(taskId: string): AgentState | null;
    createTask(by: string, data: {
        title: string;
        priority?: 'critical' | 'high' | 'medium' | 'low';
        tags?: string[];
        depends?: string[];
        affects?: string[];
        estimate_ms?: number;
        description?: string;
        requires_capabilities?: string[];
    }): TaskState;
    decomposeTask(agentId: string, parentTaskId: string, subtaskTitles: string[], rationale?: string): TaskState[];
    claimTask(agentId: string, taskId?: string): TaskState | null;
    startTask(agentId: string, taskId: string): void;
    completeTask(agentId: string, taskId: string, data: {
        artifacts?: string[];
        actual_ms?: number;
        summary?: string;
    }): void;
    blockTask(agentId: string, taskId: string, data: {
        reason: 'need_decision' | 'dependency' | 'conflict' | 'external' | 'other';
        description: string;
        escalate_to?: string;
        handoff_note?: string;
    }): void;
    cancelTask(agentId: string, taskId: string, data: {
        reason: string;
        handoff_note?: string;
    }): void;
    unblockTask(agentId: string, taskId: string, data: {
        decision?: string;
        context?: string;
    }): void;
    addCheckpoint(agentId: string, taskId: string, data: {
        note: string;
        progress?: number;
    }): void;
    getDrift(thresholdMs?: number): Array<{
        task: TaskState;
        silentMs: number;
        level: 'suspected' | 'confirmed';
    }>;
    /**
     * Analyzes task behavior patterns to detect:
     * - "Spinning": same file modified 3+ times (agent is looping)
     * - "Direction drift": artifacts don't match task title/tags
     *
     * Returns actionable analysis with recommended interventions.
     */
    analyzeSmartDrift(): Array<{
        taskId: string;
        task: TaskState;
        type: 'spinning' | 'direction_drift' | 'both';
        details: {
            spinning?: Array<{
                file: string;
                count: number;
            }>;
            direction_drift?: Array<{
                artifact: string;
                reason: string;
            }>;
        };
        recommended_action: string;
    }>;
    requestReview(agentId: string, taskId: string, data: {
        note?: string;
        suggested_reviewer?: string;
    }): void;
    submitReview(reviewerId: string, taskId: string, data: {
        result: 'approved' | 'rejected';
        note?: string;
    }): void;
    escalateTask(agentId: string, taskId: string, data: {
        reason: string;
        escalate_to?: string;
        timeout_ms?: number;
    }): void;
    reapDeadAgents(thresholdMs?: number): Array<{
        agentId: string;
        reassigned: string[];
    }>;
    registerAgent(agentId: string, data: {
        capabilities: string[];
        model?: string;
        role?: string;
    }): void;
    heartbeat(agentId: string, data: {
        status: 'busy' | 'idle' | 'blocked';
        current_task?: string;
        progress?: number;
        eta_ms?: number;
    }): void;
    acquireLock(agentId: string, file: string, reason?: string, eta_ms?: number): boolean;
    releaseLock(agentId: string, file: string): void;
    sendMessage(msg: Omit<AgentMessage, 'id' | 'ts' | 'read'>): AgentMessage;
    getInbox(agentId: string, unreadOnly?: boolean): AgentMessage[];
    markRead(agentId: string, messageId: string): void;
    ciCheck(options?: {
        staleHours?: number;
    }): {
        ok: boolean;
        errors: {
            type: string;
            id?: string;
            message: string;
        }[];
        warnings: {
            type: string;
            id?: string;
            message: string;
        }[];
        summary: string;
    };
    private _hasCircularDep;
    static getTemplates(): Record<string, {
        name: string;
        description: string;
        tags: string[];
        tasks: Array<{
            _ref: string;
            title: string;
            priority?: 'critical' | 'high' | 'medium' | 'low';
            tags?: string[];
            depends_on?: string[];
            affects?: string[];
            estimate_ms?: number;
            description?: string;
            requires_capabilities?: string[];
        }>;
    }>;
    applyTemplate(templateName: string, agentId: string): {
        taskIds: string[];
        count: number;
    };
    analyzeImpact(file: string): {
        affected_tasks: TaskState[];
        affected_agents: string[];
    };
}
