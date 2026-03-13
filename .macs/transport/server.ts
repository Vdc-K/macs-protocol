/**
 * MACS Transport API v5.0
 *
 * HTTP server exposing MACS protocol over REST + SSE.
 * Enables remote agents (cloud, CI, containers) to participate without
 * direct filesystem access.
 *
 * Usage:
 *   npx tsx .macs/transport/server.ts [--project /path] [--port 7474]
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { MACSProtocol } from '../protocol/engine.js'
import type { TaskEvent, GlobalEvent } from '../protocol/schema.js'

// ============================================================
// Config
// ============================================================

const DEFAULT_PORT = 7474
const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const projectIdx = args.indexOf('--project')

const PORT = portIdx >= 0 ? parseInt(args[portIdx + 1]) : DEFAULT_PORT
const PROJECT_PATH = projectIdx >= 0
  ? resolve(args[projectIdx + 1])
  : resolve('.')

if (!existsSync(PROJECT_PATH)) {
  console.error(`Project path not found: ${PROJECT_PATH}`)
  process.exit(1)
}

const engine = new MACSProtocol({ project: PROJECT_PATH })

// ============================================================
// SSE clients for real-time push
// ============================================================

const sseClients = new Set<ServerResponse>()

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try { res.write(payload) } catch { sseClients.delete(res) }
  }
}

// ============================================================
// HTTP Router
// ============================================================

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { reject(new Error('Invalid JSON')) }
    })
  })
}

function send(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

function sendError(res: ServerResponse, status: number, message: string) {
  send(res, status, { error: message })
}

async function router(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const path = url.pathname
  const method = req.method ?? 'GET'

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  // ── GET /health ─────────────────────────────────────────
  if (method === 'GET' && path === '/health') {
    send(res, 200, { ok: true, spec_version: '4.1', project: PROJECT_PATH })
    return
  }

  // ── GET /macs/state ─────────────────────────────────────
  if (method === 'GET' && path === '/macs/state') {
    const state = engine.getState()
    send(res, 200, state)
    return
  }

  // ── GET /macs/tasks ─────────────────────────────────────
  if (method === 'GET' && path === '/macs/tasks') {
    const status = url.searchParams.get('status')
    const assignee = url.searchParams.get('assignee')
    const cap = url.searchParams.get('capable_agent')
    const tasks = engine.findTasks({
      ...(status ? { status: status as any } : {}),
      ...(assignee ? { assignee } : {}),
      ...(cap ? { capable_agent: cap } : {}),
    })
    send(res, 200, { tasks })
    return
  }

  // ── GET /macs/agents ────────────────────────────────────
  if (method === 'GET' && path === '/macs/agents') {
    const state = engine.getState()
    send(res, 200, { agents: Object.values(state.agents) })
    return
  }

  // ── GET /macs/events ────────────────────────────────────
  if (method === 'GET' && path === '/macs/events') {
    const since = parseInt(url.searchParams.get('since') ?? '0')
    const taskEvents = engine.getTaskEvents().filter(e => (e.seq ?? 0) > since)
    const globalEvents = engine.getGlobalEvents().filter(e => (e.seq ?? 0) > since)
    send(res, 200, { task_events: taskEvents, global_events: globalEvents })
    return
  }

  // ── POST /macs/events/task ───────────────────────────────
  if (method === 'POST' && path === '/macs/events/task') {
    try {
      const body = await parseBody(req) as Omit<TaskEvent, 'seq'>
      if (!body.type || !body.id || !body.ts || !body.by) {
        sendError(res, 400, 'Missing required fields: type, id, ts, by')
        return
      }
      const event = engine.appendTaskEvent(body)
      broadcast('task_event', event)
      send(res, 201, { event })
    } catch (e: any) {
      sendError(res, 400, e.message)
    }
    return
  }

  // ── POST /macs/events/global ─────────────────────────────
  if (method === 'POST' && path === '/macs/events/global') {
    try {
      const body = await parseBody(req) as Omit<GlobalEvent, 'seq'>
      if (!body.type || !body.ts || !body.by) {
        sendError(res, 400, 'Missing required fields: type, ts, by')
        return
      }
      const event = engine.appendGlobalEvent(body)
      broadcast('global_event', event)
      send(res, 201, { event })
    } catch (e: any) {
      sendError(res, 400, e.message)
    }
    return
  }

  // ── POST /macs/tasks/:id/claim ───────────────────────────
  if (method === 'POST' && path.match(/^\/macs\/tasks\/[^/]+\/claim$/)) {
    const taskId = path.split('/')[3]
    try {
      const body = await parseBody(req) as { agent_id: string }
      if (!body.agent_id) {
        sendError(res, 400, 'Missing required field: agent_id')
        return
      }
      engine.claimTask(body.agent_id, taskId)
      const state = engine.getState()
      const task = state.tasks[taskId]
      broadcast('task_claimed', { task_id: taskId, agent_id: body.agent_id })
      send(res, 200, { task })
    } catch (e: any) {
      sendError(res, 409, e.message)
    }
    return
  }

  // ── POST /macs/agents/register ───────────────────────────
  if (method === 'POST' && path === '/macs/agents/register') {
    try {
      const body = await parseBody(req) as {
        agent_id: string
        capabilities: string[]
        model?: string
        role?: string
        instance_id?: string
        session_id?: string
      }
      if (!body.agent_id || !body.capabilities) {
        sendError(res, 400, 'Missing required fields: agent_id, capabilities')
        return
      }
      engine.registerAgent(body.agent_id, {
        capabilities: body.capabilities,
        model: body.model,
        role: body.role,
        instance_id: body.instance_id,
        session_id: body.session_id,
      })
      send(res, 201, { agent_id: body.agent_id, registered: true })
    } catch (e: any) {
      sendError(res, 400, e.message)
    }
    return
  }

  // ── POST /macs/agents/:id/heartbeat ─────────────────────
  if (method === 'POST' && path.match(/^\/macs\/agents\/[^/]+\/heartbeat$/)) {
    const agentId = path.split('/')[3]
    try {
      const body = await parseBody(req) as {
        status: 'busy' | 'idle' | 'blocked'
        current_task?: string
        progress?: number
      }
      engine.heartbeat(agentId, body)
      send(res, 200, { ok: true })
    } catch (e: any) {
      sendError(res, 400, e.message)
    }
    return
  }

  // ── GET /macs/stream (SSE) ───────────────────────────────
  if (method === 'GET' && path === '/macs/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(`event: connected\ndata: {"spec_version":"4.1"}\n\n`)
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  sendError(res, 404, `Not found: ${method} ${path}`)
}

// ============================================================
// Start
// ============================================================

const server = createServer(router)
server.listen(PORT, () => {
  console.log(`MACS Transport API v5.0`)
  console.log(`  Project: ${PROJECT_PATH}`)
  console.log(`  Listening: http://localhost:${PORT}`)
  console.log()
  console.log(`Endpoints:`)
  console.log(`  GET  /health`)
  console.log(`  GET  /macs/state`)
  console.log(`  GET  /macs/tasks[?status=&assignee=&capable_agent=]`)
  console.log(`  GET  /macs/agents`)
  console.log(`  GET  /macs/events[?since=N]`)
  console.log(`  GET  /macs/stream  (SSE)`)
  console.log(`  POST /macs/events/task`)
  console.log(`  POST /macs/events/global`)
  console.log(`  POST /macs/tasks/:id/claim`)
  console.log(`  POST /macs/agents/register`)
  console.log(`  POST /macs/agents/:id/heartbeat`)
})
