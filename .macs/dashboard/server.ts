#!/usr/bin/env node
/**
 * MACS Dashboard Server v2
 * - HTTP for static files + /api/data
 * - Server-Sent Events at /api/stream for real-time push (no WebSocket dep needed)
 * - Auto-watches .macs/protocol/ for changes and broadcasts updates
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DashboardAnalyzer } from './analyzer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.MACS_DASH_PORT ?? '3456', 10)

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
}

function startServer(projectPath: string) {
  const analyzer = new DashboardAnalyzer(projectPath)
  const protocolDir = path.join(projectPath, '.macs', 'protocol')

  // SSE client registry
  const sseClients = new Set<http.ServerResponse>()

  function broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const client of sseClients) {
      try { client.write(payload) } catch { sseClients.delete(client) }
    }
  }

  // Watch protocol dir for JSONL changes → push incremental update
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      try {
        const data = analyzer.analyze()
        broadcast('update', data)
      } catch { /* ignore read errors during write */ }
    }, 300)
  }

  if (fs.existsSync(protocolDir)) {
    fs.watch(protocolDir, { recursive: false }, () => scheduleRefresh())
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

    // CORS for dev
    res.setHeader('Access-Control-Allow-Origin', '*')

    try {
      // ── API: full data snapshot ──────────────────────────────────────
      if (url.pathname === '/api/data') {
        const data = analyzer.analyze()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
        return
      }

      // ── API: Server-Sent Events stream ───────────────────────────────
      if (url.pathname === '/api/stream') {
        res.writeHead(200, {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection':    'keep-alive',
        })
        res.write(':ok\n\n')  // initial handshake
        sseClients.add(res)

        // Send snapshot immediately on connect
        try {
          const data = analyzer.analyze()
          res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`)
        } catch { /* empty project */ }

        req.on('close', () => sseClients.delete(res))
        return
      }

      // ── API: event replay slice ──────────────────────────────────────
      if (url.pathname === '/api/replay') {
        const data = analyzer.analyze()
        const from = parseInt(url.searchParams.get('from') ?? '0', 10)
        const slice = data.eventTimeline.filter(e => e.seq >= from)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ events: slice }))
        return
      }

      // ── Static files ─────────────────────────────────────────────────
      const filePath = url.pathname === '/' ? '/ui/index.html' : url.pathname
      const fullPath = path.join(__dirname, filePath)

      if (!fs.existsSync(fullPath)) {
        res.writeHead(404); res.end('Not found'); return
      }

      const ext = path.extname(fullPath)
      const content = fs.readFileSync(fullPath)
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] ?? 'text/plain' })
      res.end(content)
    } catch (err) {
      res.writeHead(500); res.end(String(err))
    }
  })

  server.listen(PORT, async () => {
    console.log(`\n🚀 MACS Dashboard v2 → http://localhost:${PORT}`)
    console.log(`📊 Project: ${projectPath}`)
    console.log(`📡 Real-time via SSE (/api/stream)\n`)

    try {
      const { default: open } = await import('open')
      await open(`http://localhost:${PORT}`)
    } catch {
      console.log('⚠️  Could not auto-open browser.')
    }
  })
}

const projectPath = process.argv[2] || process.cwd()
startServer(projectPath)
