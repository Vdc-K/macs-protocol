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
import { MACSEngine } from './engine.js';
import { HumanGenerator } from './human-generator.js';
export { MACSEngine } from './engine.js';
export { HumanGenerator } from './human-generator.js';
export class Agent {
    id;
    engine;
    generator;
    projectRoot;
    constructor(opts) {
        this.id = opts.id;
        this.projectRoot = opts.projectRoot || process.cwd();
        this.engine = new MACSEngine(this.projectRoot);
        this.generator = new HumanGenerator(this.projectRoot);
        // Auto-register on creation
        this.engine.registerAgent(opts.id, {
            capabilities: opts.capabilities,
            model: opts.model,
            role: opts.role,
        });
    }
    // ----------------------------------------------------------
    // Task operations
    // ----------------------------------------------------------
    /** Claim the best available task (by priority + unblocked deps) */
    async claimTask(taskId) {
        return this.engine.claimTask(this.id, taskId);
    }
    /** Start working on a task */
    async startTask(taskId) {
        this.engine.startTask(this.id, taskId);
    }
    /** Complete a task */
    async completeTask(taskId, result = {}) {
        this.engine.completeTask(this.id, taskId, result);
        this.generator.generate();
    }
    /** Block a task and optionally escalate */
    async blockTask(taskId, opts) {
        this.engine.blockTask(this.id, taskId, {
            reason: 'other',
            description: opts.reason,
            escalate_to: opts.escalate_to,
        });
    }
    /** Unblock a task with a decision */
    async unblockTask(taskId, decision) {
        this.engine.unblockTask(this.id, taskId, { decision });
    }
    // ----------------------------------------------------------
    // File locks
    // ----------------------------------------------------------
    /** Acquire a file lock before modifying. Returns false if already locked. */
    async lock(file, reason) {
        return this.engine.acquireLock(this.id, file, reason);
    }
    /** Release a file lock after done */
    async unlock(file) {
        this.engine.releaseLock(this.id, file);
    }
    /** Lock, run fn, unlock. Throws if lock unavailable. */
    async withLock(file, fn, reason) {
        const ok = await this.lock(file, reason);
        if (!ok) {
            const state = this.engine.getState();
            const lock = state.locks.find(l => l.file === file);
            throw new Error(`File ${file} is locked by ${lock?.locked_by || 'another agent'}`);
        }
        try {
            return await fn();
        }
        finally {
            await this.unlock(file);
        }
    }
    // ----------------------------------------------------------
    // Events
    // ----------------------------------------------------------
    /** Record a file modification */
    async recordFileChange(file, diffSummary, purpose, taskId) {
        this.engine.appendGlobalEvent({
            type: 'file_modified',
            ts: new Date().toISOString(),
            by: this.id,
            task: taskId,
            data: { path: file, diff_summary: diffSummary, purpose },
        });
    }
    /** Record a decision */
    async recordDecision(opts) {
        this.engine.appendGlobalEvent({
            type: 'decision_made',
            ts: new Date().toISOString(),
            by: this.id,
            task: opts.taskId,
            data: {
                question: opts.question,
                decision: opts.decision,
                rationale: opts.rationale,
                alternatives: opts.alternatives,
            },
        });
    }
    /** Flag a breaking change */
    async flagBreakingChange(opts) {
        const impact = this.engine.analyzeImpact(opts.file);
        this.engine.appendGlobalEvent({
            type: 'breaking_change',
            ts: new Date().toISOString(),
            by: this.id,
            task: opts.taskId,
            data: {
                file: opts.file,
                description: opts.description,
                affected_agents: impact.affected_agents,
                migration: opts.migration,
            },
        });
        // Notify affected agents
        for (const agentId of impact.affected_agents) {
            if (agentId !== this.id) {
                this.engine.sendMessage({
                    from: this.id,
                    to: agentId,
                    type: 'breaking_change_alert',
                    data: {
                        file: opts.file,
                        description: opts.description,
                        migration: opts.migration,
                    },
                });
            }
        }
    }
    /** Record test results */
    async recordTestResult(suite, results) {
        const failed = results.tests - results.passed;
        if (failed === 0) {
            this.engine.appendGlobalEvent({
                type: 'test_passed',
                ts: new Date().toISOString(),
                by: this.id,
                task: results.taskId,
                data: { suite, tests: results.tests, passed: results.passed, duration_ms: results.duration_ms },
            });
        }
        else {
            this.engine.appendGlobalEvent({
                type: 'test_failed',
                ts: new Date().toISOString(),
                by: this.id,
                task: results.taskId,
                data: {
                    suite,
                    tests: results.tests,
                    passed: results.passed,
                    failed,
                    errors: results.errors || [],
                    duration_ms: results.duration_ms,
                },
            });
        }
    }
    // ----------------------------------------------------------
    // Messaging
    // ----------------------------------------------------------
    /** Read unread messages */
    async readInbox() {
        return this.engine.getInbox(this.id, true);
    }
    /** Send a message to another agent */
    async send(to, content, opts = {}) {
        this.engine.sendMessage({
            from: this.id,
            to,
            type: opts.type || 'general',
            re: opts.re,
            data: { content },
        });
    }
    /** Mark a message as read */
    async markRead(messageId) {
        this.engine.markRead(this.id, messageId);
    }
    // ----------------------------------------------------------
    // State queries
    // ----------------------------------------------------------
    /** Get current project state */
    getState() {
        return this.engine.getState();
    }
    /** Analyze what a file change would affect */
    analyzeImpact(file) {
        return this.engine.analyzeImpact(file);
    }
    /** Send heartbeat */
    heartbeat(status, opts = {}) {
        this.engine.heartbeat(this.id, { status, ...opts });
    }
    // ----------------------------------------------------------
    // Agent Loop — the main workflow
    // ----------------------------------------------------------
    /**
     * Run the agent loop:
     * 1. Check inbox and handle messages
     * 2. Claim and execute a task
     * 3. Send heartbeat
     * 4. Repeat
     *
     * Exits when no more tasks or maxTasks reached.
     */
    async loop(opts) {
        let tasksCompleted = 0;
        const heartbeatInterval = opts.heartbeatInterval ?? 60000;
        let heartbeatTimer = null;
        // Start heartbeat
        heartbeatTimer = setInterval(() => {
            this.heartbeat('busy');
        }, heartbeatInterval);
        try {
            while (true) {
                // 1. Read and handle inbox
                const messages = await this.readInbox();
                for (const msg of messages) {
                    if (opts.onMessage)
                        await opts.onMessage(msg);
                    await this.markRead(msg.id);
                }
                // 2. Claim a task
                const task = await this.claimTask();
                if (!task) {
                    this.heartbeat('idle');
                    break; // No more tasks
                }
                // 3. Start task
                await this.startTask(task.id);
                this.heartbeat('busy', { current_task: task.id });
                const startedAt = Date.now();
                // 4. Execute task
                try {
                    const result = await opts.onTask(task);
                    await this.completeTask(task.id, {
                        artifacts: result?.artifacts,
                        summary: result?.summary,
                        actual_ms: Date.now() - startedAt,
                    });
                    tasksCompleted++;
                }
                catch (err) {
                    // Task threw — block it with the error message
                    await this.blockTask(task.id, {
                        reason: err.message || String(err),
                    });
                    this.heartbeat('blocked', { current_task: task.id });
                }
                // 5. Check limit
                if (opts.maxTasks && tasksCompleted >= opts.maxTasks)
                    break;
            }
        }
        finally {
            if (heartbeatTimer)
                clearInterval(heartbeatTimer);
        }
    }
}
// ============================================================
// Factory function
// ============================================================
export function createAgent(opts) {
    return new Agent(opts);
}
// ============================================================
// Utility: init a project
// ============================================================
export function initProject(projectRoot, name) {
    const engine = new MACSEngine(projectRoot);
    const config = engine.init(name);
    const generator = new HumanGenerator(projectRoot);
    generator.generate();
    return config;
}
