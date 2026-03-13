/**
 * MACS Protocol SDK v3.0
 *
 * High-level API for agents. Wraps MACSEngine with ergonomic methods.
 *
 * Usage:
 *   import { createAgent } from '@macs/protocol'
 *   const agent = createAgent({ id: 'engineer-sonnet', capabilities: ['backend'] })
 *   await agent.loop()
 */
import type { TaskState, AgentState, AgentMessage, MACSConfig } from './schema.js';
export type { TaskState, AgentState, AgentMessage, MACSConfig };
export { MACSEngine } from './engine.js';
export { HumanGenerator } from './human-generator.js';
export interface AgentOptions {
    id: string;
    capabilities: string[];
    model?: string;
    role?: string;
    projectRoot?: string;
}
export interface AgentLoopOptions {
    /** Called when a task is claimed. Return artifacts list or throw to block. */
    onTask: (task: TaskState) => Promise<{
        artifacts?: string[];
        summary?: string;
    } | void>;
    /** Called on each inbox message before task loop */
    onMessage?: (msg: AgentMessage) => Promise<void>;
    /** How often to send heartbeat (ms). Default: 60000 */
    heartbeatInterval?: number;
    /** How many tasks to complete before stopping. Default: unlimited */
    maxTasks?: number;
}
export declare class Agent {
    readonly id: string;
    private engine;
    private generator;
    private projectRoot;
    constructor(opts: AgentOptions);
    /** Claim the best available task (by priority + unblocked deps) */
    claimTask(taskId?: string): Promise<TaskState | null>;
    /** Start working on a task */
    startTask(taskId: string): Promise<void>;
    /** Complete a task */
    completeTask(taskId: string, result?: {
        artifacts?: string[];
        summary?: string;
        actual_ms?: number;
    }): Promise<void>;
    /** Block a task and optionally escalate */
    blockTask(taskId: string, opts: {
        reason: string;
        escalate_to?: string;
    }): Promise<void>;
    /** Unblock a task with a decision */
    unblockTask(taskId: string, decision?: string): Promise<void>;
    /** Acquire a file lock before modifying. Returns false if already locked. */
    lock(file: string, reason?: string): Promise<boolean>;
    /** Release a file lock after done */
    unlock(file: string): Promise<void>;
    /** Lock, run fn, unlock. Throws if lock unavailable. */
    withLock<T>(file: string, fn: () => Promise<T>, reason?: string): Promise<T>;
    /** Record a file modification */
    recordFileChange(file: string, diffSummary: string, purpose?: string, taskId?: string): Promise<void>;
    /** Record a decision */
    recordDecision(opts: {
        question: string;
        decision: string;
        rationale: string;
        alternatives?: string[];
        taskId?: string;
    }): Promise<void>;
    /** Flag a breaking change */
    flagBreakingChange(opts: {
        file: string;
        description: string;
        migration?: string;
        taskId?: string;
    }): Promise<void>;
    /** Record test results */
    recordTestResult(suite: string, results: {
        tests: number;
        passed: number;
        duration_ms: number;
        errors?: string[];
        taskId?: string;
    }): Promise<void>;
    /** Read unread messages */
    readInbox(): Promise<AgentMessage[]>;
    /** Send a message to another agent */
    send(to: string, content: string, opts?: {
        type?: AgentMessage['type'];
        re?: string;
    }): Promise<void>;
    /** Mark a message as read */
    markRead(messageId: string): Promise<void>;
    /** Get current project state */
    getState(): import("./schema.js").MACSState;
    /** Analyze what a file change would affect */
    analyzeImpact(file: string): {
        affected_tasks: TaskState[];
        affected_agents: string[];
    };
    /** Send heartbeat */
    heartbeat(status: 'busy' | 'idle' | 'blocked', opts?: {
        current_task?: string;
        progress?: number;
        eta_ms?: number;
    }): void;
    /**
     * Run the agent loop:
     * 1. Check inbox and handle messages
     * 2. Claim and execute a task
     * 3. Send heartbeat
     * 4. Repeat
     *
     * Exits when no more tasks or maxTasks reached.
     */
    loop(opts: AgentLoopOptions): Promise<void>;
}
export declare function createAgent(opts: AgentOptions): Agent;
export declare function initProject(projectRoot: string, name: string): MACSConfig;
