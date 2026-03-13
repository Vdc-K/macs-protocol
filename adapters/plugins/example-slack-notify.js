/**
 * MACS Plugin Example: Slack Notifications
 *
 * Sends Slack messages when important MACS events happen.
 *
 * Setup:
 *   1. Set SLACK_WEBHOOK_URL env var to your Slack Incoming Webhook URL
 *   2. Copy this file to .macs/plugins/slack-notify.js in your project
 *
 * Usage:
 *   The plugin is auto-loaded when MACS starts.
 */

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

function notify(text) {
  if (!WEBHOOK_URL) return
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {}) // fire-and-forget, don't crash engine
}

/** @type {import('./plugin-interface').MACSPlugin} */
const slackNotifyPlugin = {
  name: 'slack-notify',
  version: '1.0.0',
  hooks: {
    onTaskCompleted(task) {
      notify(`✅ *${task.id}* completed by \`${task.assignee}\`: ${task.title}`)
    },

    onTaskBlocked(task) {
      const note = task.handoff_note ? `\n> ${task.handoff_note}` : ''
      notify(`⚠️ *${task.id}* is blocked (${task.assignee}): ${task.title}${note}`)
    },

    onEscalation(task) {
      notify(`🚨 *${task.id}* escalated to human: ${task.escalation_reason}\nTask: ${task.title}`)
    },

    onDeadAgent(agentId, reassignedTasks) {
      const tasks = reassignedTasks.length > 0
        ? ` Reassigned: ${reassignedTasks.join(', ')}`
        : ''
      notify(`💀 Agent \`${agentId}\` declared dead.${tasks}`)
    },
  },
}

module.exports = slackNotifyPlugin
