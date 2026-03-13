/**
 * MACS Protocol Engine v3.0
 *
 * Core: Append events → Rebuild state → Query state
 * All writes go to JSONL (append-only). State is a cached projection.
 */
import type { TaskEvent, GlobalEvent, MACSState, TaskState, AgentState, AgentMessage, MACSConfig } from './schema.js';
export declare class MACSEngine {
    private dir;
    private protocolDir;
    private syncDir;
    private humanDir;
    constructor(projectRoot: string);
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
    analyzeImpact(file: string): {
        affected_tasks: TaskState[];
        affected_agents: string[];
    };
}
