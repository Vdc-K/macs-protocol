/**
 * MACS Plugin Interface (4.1)
 *
 * Create a plugin by implementing the MACSPlugin interface and placing
 * the compiled .js file in your project's .macs/plugins/ directory.
 *
 * MACS auto-loads all *.js files from .macs/plugins/ at startup.
 *
 * Example:
 *   export default myPlugin  (default export)
 *   // or
 *   module.exports = myPlugin  (CommonJS)
 */

import type { TaskState } from '../../.macs/protocol/schema.js'

export interface MACSPlugin {
  /** Plugin identifier */
  name: string

  /** Plugin version (optional) */
  version?: string

  /** Event hooks — only implement the ones you need */
  hooks?: {
    /** Called when a new task is created */
    onTaskCreated?: (task: TaskState) => void

    /** Called when a task is marked completed */
    onTaskCompleted?: (task: TaskState) => void

    /** Called when a task is blocked */
    onTaskBlocked?: (task: TaskState) => void

    /** Called when a task review is submitted */
    onTaskReviewed?: (task: TaskState, result: 'approved' | 'rejected') => void

    /** Called when a new agent registers */
    onAgentRegistered?: (agentId: string, capabilities: string[]) => void

    /** Called when a task is escalated to human */
    onEscalation?: (task: TaskState) => void

    /** Called when an agent is reaped (dead), with reassigned task IDs */
    onDeadAgent?: (agentId: string, reassignedTasks: string[]) => void
  }
}
