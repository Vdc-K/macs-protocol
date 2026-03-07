/**
 * MACS Plugin Example: Generic Webhook
 *
 * POSTs all MACS events to a webhook endpoint (e.g. n8n, Zapier, custom server).
 *
 * Setup:
 *   1. Set MACS_WEBHOOK_URL env var
 *   2. Copy to .macs/plugins/webhook.js in your project
 */

const WEBHOOK_URL = process.env.MACS_WEBHOOK_URL

function post(event, data) {
  if (!WEBHOOK_URL) return
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data, ts: new Date().toISOString() }),
  }).catch(() => {})
}

/** @type {import('./plugin-interface').MACSPlugin} */
const webhookPlugin = {
  name: 'webhook',
  version: '1.0.0',
  hooks: {
    onTaskCreated(task) { post('task.created', task) },
    onTaskCompleted(task) { post('task.completed', task) },
    onTaskBlocked(task) { post('task.blocked', task) },
    onTaskReviewed(task, result) { post('task.reviewed', { ...task, review_result: result }) },
    onAgentRegistered(agentId, capabilities) { post('agent.registered', { agentId, capabilities }) },
    onEscalation(task) { post('task.escalated', task) },
    onDeadAgent(agentId, reassignedTasks) { post('agent.dead', { agentId, reassignedTasks }) },
  },
}

module.exports = webhookPlugin
