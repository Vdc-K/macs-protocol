# MACS Plugin System (v4.1)

Extend MACS with custom behavior — notifications, integrations, custom rules.

## How it works

1. Create a `.js` plugin file implementing `MACSPlugin` interface
2. Drop it in `.macs/plugins/` in your project
3. MACS auto-loads it at startup — no config needed

```
your-project/
  .macs/
    plugins/
      slack-notify.js    ← auto-loaded
      my-custom-plugin.js ← auto-loaded
    protocol/
    ...
```

## Plugin interface

```javascript
/** @type {import('macs-protocol/adapters/plugins/plugin-interface').MACSPlugin} */
const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  hooks: {
    onTaskCreated(task) { /* ... */ },
    onTaskCompleted(task) { /* ... */ },
    onTaskBlocked(task) { /* ... */ },
    onTaskReviewed(task, result) { /* 'approved' | 'rejected' */ },
    onAgentRegistered(agentId, capabilities) { /* ... */ },
    onEscalation(task) { /* ... */ },
    onDeadAgent(agentId, reassignedTasks) { /* ... */ },
  },
}

module.exports = myPlugin
```

## Available hooks

| Hook | When it fires | Arguments |
|------|--------------|-----------|
| `onTaskCreated` | New task created | `task: TaskState` |
| `onTaskCompleted` | Task marked done | `task: TaskState` |
| `onTaskBlocked` | Task blocked | `task: TaskState` |
| `onTaskReviewed` | Review submitted | `task: TaskState, result: 'approved'\|'rejected'` |
| `onAgentRegistered` | Agent joins project | `agentId: string, capabilities: string[]` |
| `onEscalation` | Task escalated to human | `task: TaskState` |
| `onDeadAgent` | Agent reaped, tasks reassigned | `agentId: string, reassignedTasks: string[]` |

## Examples

### Slack notifications
```bash
cp adapters/plugins/example-slack-notify.js .macs/plugins/slack-notify.js
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Generic webhook (n8n, Zapier, custom)
```bash
cp adapters/plugins/example-webhook.js .macs/plugins/webhook.js
export MACS_WEBHOOK_URL=https://your-server.com/macs-events
```

## Writing plugins in TypeScript

Compile to CommonJS `.js` before placing in `.macs/plugins/`:

```typescript
// my-plugin.ts
import type { MACSPlugin } from 'macs-protocol/adapters/plugins/plugin-interface'

const plugin: MACSPlugin = {
  name: 'my-plugin',
  hooks: {
    onTaskCompleted(task) {
      console.log(`[plugin] Task done: ${task.id} ${task.title}`)
    },
  },
}

export default plugin
```

```bash
# Compile
tsc my-plugin.ts --module commonjs --target es2020
cp my-plugin.js /path/to/project/.macs/plugins/
```

## Plugin guidelines

- Keep plugins **fast** — hooks run synchronously during event writes
- **Never throw** — plugin errors are silently swallowed to protect the engine
- Use `fire-and-forget` for network calls (don't await in hooks)
- Plugins run in the same process as MACS CLI, so they have access to env vars
