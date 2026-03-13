#!/usr/bin/env node
/**
 * MACS MCP Server (4.2) — Expose MACS as Model Context Protocol tools
 *
 * Gives Claude Desktop (and any MCP-compatible client) direct access to
 * your MACS project: list tasks, claim work, complete, block, escalate, etc.
 *
 * Protocol: MCP stdio transport (JSON-RPC 2.0 over stdin/stdout)
 *
 * Usage:
 *   npx tsx macs-mcp-server.ts [project-path]
 *
 * Claude Desktop config (~/.claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "macs": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/macs-mcp-server.ts", "/path/to/your/project"]
 *       }
 *     }
 *   }
 */

import { createInterface } from 'readline'
import { MACSEngine } from '../../.macs/protocol/engine.js'

const projectRoot = process.argv[2] || process.cwd()
const engine = new MACSEngine(projectRoot)

// ============================================================
// MCP Tool Definitions
// ============================================================

const TOOLS = [
  {
    name: 'macs_status',
    description: 'Get the current status of all tasks and agents in the MACS project. Returns a summary of task counts by status and a list of active tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        filter_status: {
          type: 'string',
          description: 'Optional: filter tasks by status (pending, in_progress, blocked, completed, review_required, pending_human)',
        },
      },
    },
  },
  {
    name: 'macs_list_tasks',
    description: 'List tasks in the MACS project with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status' },
        assignee: { type: 'string', description: 'Filter by agent ID' },
        tag: { type: 'string', description: 'Filter by tag' },
        priority: { type: 'string', description: 'Filter by priority: critical, high, medium, low' },
        limit: { type: 'number', description: 'Max tasks to return (default 20)' },
      },
    },
  },
  {
    name: 'macs_get_task',
    description: 'Get detailed information about a specific task including history, handoff notes, and review status.',
    inputSchema: {
      type: 'object',
      required: ['task_id'],
      properties: {
        task_id: { type: 'string', description: 'Task ID, e.g. T-001' },
      },
    },
  },
  {
    name: 'macs_create_task',
    description: 'Create a new task in the MACS project.',
    inputSchema: {
      type: 'object',
      required: ['title', 'agent_id'],
      properties: {
        title: { type: 'string', description: 'Task title' },
        agent_id: { type: 'string', description: 'Agent ID creating this task' },
        priority: { type: 'string', description: 'Priority: critical, high, medium, low (default: medium)' },
        description: { type: 'string', description: 'Task description' },
        tags: { type: 'string', description: 'Comma-separated tags, e.g. "backend,auth"' },
        depends: { type: 'string', description: 'Comma-separated task IDs this depends on' },
        requires_capabilities: { type: 'string', description: 'Comma-separated required capabilities' },
        estimate_hours: { type: 'number', description: 'Estimated hours to complete' },
      },
    },
  },
  {
    name: 'macs_claim_task',
    description: 'Claim the next available task for an agent (or claim a specific task). Respects capability matching and load limits.',
    inputSchema: {
      type: 'object',
      required: ['agent_id'],
      properties: {
        agent_id: { type: 'string', description: 'Agent ID claiming the task' },
        task_id: { type: 'string', description: 'Optional: specific task ID to claim' },
      },
    },
  },
  {
    name: 'macs_complete_task',
    description: 'Mark a task as completed.',
    inputSchema: {
      type: 'object',
      required: ['task_id', 'agent_id'],
      properties: {
        task_id: { type: 'string', description: 'Task ID to complete' },
        agent_id: { type: 'string', description: 'Agent ID completing the task' },
        summary: { type: 'string', description: 'Summary of what was accomplished' },
        artifacts: { type: 'string', description: 'Comma-separated list of files created/modified' },
        request_review: { type: 'boolean', description: 'If true, task enters review_required state instead of completed' },
      },
    },
  },
  {
    name: 'macs_block_task',
    description: 'Mark a task as blocked. Requires a handoff note explaining the situation for the next agent.',
    inputSchema: {
      type: 'object',
      required: ['task_id', 'agent_id', 'reason', 'handoff_note'],
      properties: {
        task_id: { type: 'string', description: 'Task ID to block' },
        agent_id: { type: 'string', description: 'Agent ID blocking the task' },
        reason: { type: 'string', enum: ['need_decision', 'dependency', 'conflict', 'external', 'other'] },
        description: { type: 'string', description: 'Detailed description of the block' },
        handoff_note: { type: 'string', description: 'Structured handoff: "✓ done → next ⚠ issues ? questions"' },
        escalate_to: { type: 'string', description: 'Agent ID to notify/escalate to' },
      },
    },
  },
  {
    name: 'macs_escalate_task',
    description: 'Escalate a task to a human or lead agent when an agent encounters a decision beyond its authority.',
    inputSchema: {
      type: 'object',
      required: ['task_id', 'agent_id', 'reason'],
      properties: {
        task_id: { type: 'string', description: 'Task ID to escalate' },
        agent_id: { type: 'string', description: 'Agent ID escalating' },
        reason: { type: 'string', description: 'Why escalation is needed' },
        to: { type: 'string', description: 'Human or lead agent ID to escalate to' },
        timeout_hours: { type: 'number', description: 'Auto-resume after N hours if no response' },
      },
    },
  },
  {
    name: 'macs_review_task',
    description: 'Approve or reject a task that is in review_required state.',
    inputSchema: {
      type: 'object',
      required: ['task_id', 'agent_id', 'result'],
      properties: {
        task_id: { type: 'string', description: 'Task ID to review' },
        agent_id: { type: 'string', description: 'Reviewer agent ID' },
        result: { type: 'string', enum: ['approve', 'reject'], description: 'Review result' },
        note: { type: 'string', description: 'Reviewer feedback or instructions if rejected' },
      },
    },
  },
  {
    name: 'macs_checkpoint',
    description: 'Record a progress checkpoint for a task. Prevents drift detection false positives.',
    inputSchema: {
      type: 'object',
      required: ['task_id', 'agent_id', 'note'],
      properties: {
        task_id: { type: 'string', description: 'Task ID' },
        agent_id: { type: 'string', description: 'Agent ID' },
        note: { type: 'string', description: 'Progress note: "✓ done → next ⚠ issues ? questions"' },
        progress: { type: 'number', description: 'Progress 0.0–1.0 (optional)' },
      },
    },
  },
  {
    name: 'macs_send_message',
    description: 'Send a message to another agent\'s inbox.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to', 'message'],
      properties: {
        from: { type: 'string', description: 'Sender agent ID' },
        to: { type: 'string', description: 'Recipient agent ID' },
        message: { type: 'string', description: 'Message content' },
        task_id: { type: 'string', description: 'Related task ID (optional)' },
        type: { type: 'string', description: 'Message type: general, review_request, etc.' },
      },
    },
  },
  {
    name: 'macs_get_inbox',
    description: 'Check an agent\'s inbox for messages.',
    inputSchema: {
      type: 'object',
      required: ['agent_id'],
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to check inbox for' },
        unread_only: { type: 'boolean', description: 'Only return unread messages (default true)' },
      },
    },
  },
  {
    name: 'macs_ci_check',
    description: 'Run MACS consistency checks: stale tasks, dead agents, broken dependencies, circular deps. Returns pass/fail for CI use.',
    inputSchema: {
      type: 'object',
      properties: {
        stale_hours: { type: 'number', description: 'Hours without checkpoint before warning (default 2)' },
      },
    },
  },
  {
    name: 'macs_list_templates',
    description: 'List available MACS project templates (saas-mvp, api-service, data-pipeline, cli-tool).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'macs_apply_template',
    description: 'Apply a project template to create a predefined set of tasks with dependencies.',
    inputSchema: {
      type: 'object',
      required: ['template_name', 'agent_id'],
      properties: {
        template_name: { type: 'string', description: 'Template name: saas-mvp, api-service, data-pipeline, cli-tool' },
        agent_id: { type: 'string', description: 'Agent ID applying the template' },
      },
    },
  },
]

// ============================================================
// Tool Handlers
// ============================================================

function handleTool(name: string, input: Record<string, any>): unknown {
  switch (name) {
    case 'macs_status': {
      const state = engine.getState()
      const tasks = Object.values(state.tasks)
      const filtered = input.filter_status
        ? tasks.filter(t => t.status === input.filter_status)
        : tasks

      const byStatus: Record<string, number> = {}
      for (const t of tasks) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1
      }

      return {
        project: state.project,
        metrics: state.metrics,
        tasks_by_status: byStatus,
        active_tasks: filtered
          .filter(t => !['completed', 'cancelled'].includes(t.status))
          .map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assignee: t.assignee,
            priority: t.priority,
            tags: t.tags,
          })),
        agents: Object.values(state.agents).map(a => ({
          id: a.id,
          status: a.status,
          current_task: a.current_task,
          capabilities: a.capabilities,
        })),
      }
    }

    case 'macs_list_tasks': {
      const state = engine.getState()
      let tasks = Object.values(state.tasks)
      if (input.status) tasks = tasks.filter(t => t.status === input.status)
      if (input.assignee) tasks = tasks.filter(t => t.assignee === input.assignee)
      if (input.tag) tasks = tasks.filter(t => t.tags.includes(input.tag))
      if (input.priority) tasks = tasks.filter(t => t.priority === input.priority)
      const limit = input.limit || 20
      return tasks.slice(0, limit).map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        assignee: t.assignee, tags: t.tags, depends: t.depends,
        requires_capabilities: t.requires_capabilities,
        handoff_note: t.handoff_note,
      }))
    }

    case 'macs_get_task': {
      const state = engine.getState()
      const task = state.tasks[input.task_id]
      if (!task) throw new Error(`Task ${input.task_id} not found`)
      return task
    }

    case 'macs_create_task': {
      const task = engine.createTask(input.agent_id, {
        title: input.title,
        priority: input.priority,
        description: input.description,
        tags: input.tags ? input.tags.split(',').map((s: string) => s.trim()) : [],
        depends: input.depends ? input.depends.split(',').map((s: string) => s.trim()) : [],
        requires_capabilities: input.requires_capabilities
          ? input.requires_capabilities.split(',').map((s: string) => s.trim())
          : undefined,
        estimate_ms: input.estimate_hours ? input.estimate_hours * 3600000 : undefined,
      })
      return { task_id: task.id, title: task.title, status: 'pending' }
    }

    case 'macs_claim_task': {
      if (input.task_id) {
        const state = engine.getState()
        const task = state.tasks[input.task_id]
        if (!task) throw new Error(`Task ${input.task_id} not found`)
        engine.appendTaskEvent({
          type: 'task_assigned',
          id: input.task_id,
          ts: new Date().toISOString(),
          by: input.agent_id,
          data: { assignee: input.agent_id },
        })
        engine.appendTaskEvent({
          type: 'task_started',
          id: input.task_id,
          ts: new Date().toISOString(),
          by: input.agent_id,
          data: {},
        })
        return { task_id: input.task_id, title: task.title, status: 'in_progress' }
      }

      const agentState = engine.getState().agents[input.agent_id]
      const caps = agentState?.capabilities || []
      const claimed = engine.claimTask(input.agent_id, { capable_agent: input.agent_id })
      if (!claimed) return { result: 'no_available_tasks' }
      return { task_id: claimed.id, title: claimed.title, status: claimed.status }
    }

    case 'macs_complete_task': {
      const artifacts = input.artifacts
        ? input.artifacts.split(',').map((s: string) => s.trim())
        : []

      if (input.request_review) {
        engine.appendTaskEvent({
          type: 'task_review_requested',
          id: input.task_id,
          ts: new Date().toISOString(),
          by: input.agent_id,
          data: { note: input.summary },
        })
        return { status: 'review_required', task_id: input.task_id }
      }

      engine.appendTaskEvent({
        type: 'task_completed',
        id: input.task_id,
        ts: new Date().toISOString(),
        by: input.agent_id,
        data: { artifacts, summary: input.summary },
      })
      return { status: 'completed', task_id: input.task_id }
    }

    case 'macs_block_task': {
      engine.blockTask(input.agent_id, input.task_id, {
        reason: input.reason,
        description: input.description || input.reason,
        handoff_note: input.handoff_note,
        escalate_to: input.escalate_to,
      })
      return { status: 'blocked', task_id: input.task_id }
    }

    case 'macs_escalate_task': {
      engine.escalateTask(input.agent_id, input.task_id, {
        reason: input.reason,
        escalate_to: input.to,
        timeout_ms: input.timeout_hours ? input.timeout_hours * 3600000 : undefined,
      })
      return { status: 'pending_human', task_id: input.task_id }
    }

    case 'macs_review_task': {
      engine.reviewTask(input.agent_id, input.task_id, {
        result: input.result,
        note: input.note,
      })
      const finalStatus = input.result === 'approve' ? 'completed' : 'in_progress'
      return { status: finalStatus, task_id: input.task_id, result: input.result }
    }

    case 'macs_checkpoint': {
      engine.appendTaskEvent({
        type: 'task_checkpoint',
        id: input.task_id,
        ts: new Date().toISOString(),
        by: input.agent_id,
        data: { note: input.note, progress: input.progress },
      })
      return { status: 'checkpoint_recorded', task_id: input.task_id }
    }

    case 'macs_send_message': {
      const msg = engine.sendMessage({
        from: input.from,
        to: input.to,
        type: input.type || 'general',
        re: input.task_id,
        data: { message: input.message },
      })
      return { message_id: msg.id, status: 'sent' }
    }

    case 'macs_get_inbox': {
      const msgs = engine.getInbox(input.agent_id, input.unread_only !== false)
      return msgs.map(m => ({
        id: m.id, from: m.from, type: m.type, re: m.re,
        ts: m.ts, read: m.read, data: m.data,
      }))
    }

    case 'macs_ci_check': {
      return engine.ciCheck({ staleHours: input.stale_hours })
    }

    case 'macs_list_templates': {
      const templates = MACSEngine.getTemplates()
      return Object.entries(templates).map(([key, t]) => ({
        name: key,
        display_name: t.name,
        description: t.description,
        tags: t.tags,
        task_count: t.tasks.length,
      }))
    }

    case 'macs_apply_template': {
      const result = engine.applyTemplate(input.template_name, input.agent_id)
      const state = engine.getState()
      return {
        template: input.template_name,
        tasks_created: result.count,
        task_ids: result.taskIds,
        tasks: result.taskIds.map(id => ({
          id,
          title: state.tasks[id]?.title,
          priority: state.tasks[id]?.priority,
          depends: state.tasks[id]?.depends,
          requires_capabilities: state.tasks[id]?.requires_capabilities,
        })),
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ============================================================
// MCP stdio Transport (JSON-RPC 2.0)
// ============================================================

const rl = createInterface({ input: process.stdin, terminal: false })

function send(obj: object) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

rl.on('line', (line) => {
  let req: any
  try {
    req = JSON.parse(line)
  } catch {
    return
  }

  const { id, method, params } = req

  // Handle MCP protocol methods
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'macs-mcp-server', version: '4.0.0' },
      },
    })
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
  } else if (method === 'tools/call') {
    try {
      const result = handleTool(params.name, params.arguments || {})
      send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      })
    } catch (err: any) {
      send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        },
      })
    }
  } else if (method === 'notifications/initialized') {
    // no-op
  } else {
    send({
      jsonrpc: '2.0', id,
      error: { code: -32601, message: `Method not found: ${method}` },
    })
  }
})

process.stderr.write(`MACS MCP Server ready — project: ${projectRoot}\n`)
