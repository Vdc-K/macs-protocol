/**
 * MACS Storage Backend Abstraction v5.0
 *
 * Decouples the protocol engine from the filesystem.
 * Default: FileStorageBackend (local .macs/ directory)
 * Optional: HTTPStorageBackend (connect to a remote MACS Transport server)
 *
 * Future: RedisStorageBackend, S3StorageBackend, etc.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import type { TaskEvent, GlobalEvent, MACSState, AgentMessage } from '../protocol/schema.js'

// ============================================================
// Interface
// ============================================================

export interface StorageBackend {
  /** Append a task event. Returns the event with seq filled in. */
  appendTaskEvent(event: Omit<TaskEvent, 'seq'>): Promise<TaskEvent>

  /** Append a global event. Returns the event with seq filled in. */
  appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): Promise<GlobalEvent>

  /** Read all task events, sorted by seq. */
  getTaskEvents(): Promise<TaskEvent[]>

  /** Read all global events (merged from shards if applicable), sorted by seq. */
  getGlobalEvents(): Promise<GlobalEvent[]>

  /** Read current state snapshot. */
  getState(): Promise<MACSState>

  /** Write state snapshot (called after rebuild). */
  writeState(state: MACSState): Promise<void>

  /** Read messages from an agent's inbox. */
  getInbox(agentId: string): Promise<AgentMessage[]>

  /** Write messages to an agent's inbox. */
  writeInbox(agentId: string, messages: AgentMessage[]): Promise<void>

  /** Get next monotonic sequence number. */
  nextSeq(): Promise<number>
}

// ============================================================
// FileStorageBackend — default, wraps local filesystem
// ============================================================

function readJsonl<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8').trim()
  if (!content) return []
  return content.split('\n').filter(Boolean).map(line => JSON.parse(line) as T)
}

export class FileStorageBackend implements StorageBackend {
  private protocolDir: string
  private syncDir: string

  constructor(macsDir: string) {
    this.protocolDir = join(macsDir, 'protocol')
    this.syncDir = join(macsDir, 'sync', 'inbox')
  }

  async nextSeq(): Promise<number> {
    const seqFile = join(this.protocolDir, '.seq')
    let seq = 0
    if (existsSync(seqFile)) {
      seq = parseInt(readFileSync(seqFile, 'utf-8').trim(), 10) || 0
    }
    seq++
    writeFileSync(seqFile, String(seq), 'utf-8')
    return seq
  }

  async appendTaskEvent(event: Omit<TaskEvent, 'seq'>): Promise<TaskEvent> {
    const seq = await this.nextSeq()
    const full = { ...event, seq } as TaskEvent
    const line = JSON.stringify(full) + '\n'
    appendFileSync(join(this.protocolDir, 'tasks.jsonl'), line, 'utf-8')
    return full
  }

  async appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): Promise<GlobalEvent> {
    const seq = await this.nextSeq()
    const full = { ...event, seq } as GlobalEvent
    const line = JSON.stringify(full) + '\n'
    const shardDir = join(this.protocolDir, 'events')
    if (existsSync(shardDir)) {
      // sharding mode
      appendFileSync(join(shardDir, `${event.by}.jsonl`), line, 'utf-8')
    } else {
      appendFileSync(join(this.protocolDir, 'events.jsonl'), line, 'utf-8')
    }
    return full
  }

  async getTaskEvents(): Promise<TaskEvent[]> {
    return readJsonl<TaskEvent>(join(this.protocolDir, 'tasks.jsonl'))
  }

  async getGlobalEvents(): Promise<GlobalEvent[]> {
    const shardDir = join(this.protocolDir, 'events')
    if (existsSync(shardDir)) {
      const files = readdirSync(shardDir).filter(f => f.endsWith('.jsonl'))
      const all: GlobalEvent[] = []
      for (const f of files) {
        all.push(...readJsonl<GlobalEvent>(join(shardDir, f)))
      }
      return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }
    return readJsonl<GlobalEvent>(join(this.protocolDir, 'events.jsonl'))
  }

  async getState(): Promise<MACSState> {
    const stateFile = join(this.protocolDir, 'state.json')
    if (!existsSync(stateFile)) throw new Error('state.json not found — run macs init first')
    return JSON.parse(readFileSync(stateFile, 'utf-8')) as MACSState
  }

  async writeState(state: MACSState): Promise<void> {
    writeFileSync(join(this.protocolDir, 'state.json'), JSON.stringify(state, null, 2), 'utf-8')
  }

  async getInbox(agentId: string): Promise<AgentMessage[]> {
    const inboxFile = join(this.syncDir, agentId, 'messages.jsonl')
    return readJsonl<AgentMessage>(inboxFile)
  }

  async writeInbox(agentId: string, messages: AgentMessage[]): Promise<void> {
    const dir = join(this.syncDir, agentId)
    mkdirSync(dir, { recursive: true })
    const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n'
    writeFileSync(join(dir, 'messages.jsonl'), content, 'utf-8')
  }
}

// ============================================================
// HTTPStorageBackend — connects to a remote MACS Transport server
// ============================================================

export class HTTPStorageBackend implements StorageBackend {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(serverUrl: string, opts: { token?: string } = {}) {
    this.baseUrl = serverUrl.replace(/\/$/, '')
    this.headers = {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    }
  }

  private async fetch(path: string, init?: RequestInit): Promise<any> {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MACS HTTP ${res.status}: ${body}`)
    }
    return res.json()
  }

  async nextSeq(): Promise<number> {
    // Server manages sequence numbers — not called client-side
    throw new Error('nextSeq() not available on HTTPStorageBackend')
  }

  async appendTaskEvent(event: Omit<TaskEvent, 'seq'>): Promise<TaskEvent> {
    const { event: full } = await this.fetch('/macs/events/task', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    return full
  }

  async appendGlobalEvent(event: Omit<GlobalEvent, 'seq'>): Promise<GlobalEvent> {
    const { event: full } = await this.fetch('/macs/events/global', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    return full
  }

  async getTaskEvents(): Promise<TaskEvent[]> {
    const { task_events } = await this.fetch('/macs/events')
    return task_events
  }

  async getGlobalEvents(): Promise<GlobalEvent[]> {
    const { global_events } = await this.fetch('/macs/events')
    return global_events
  }

  async getState(): Promise<MACSState> {
    return this.fetch('/macs/state')
  }

  async writeState(_state: MACSState): Promise<void> {
    // State is managed server-side; client cannot write it directly
  }

  async getInbox(agentId: string): Promise<AgentMessage[]> {
    const { messages } = await this.fetch(`/macs/agents/${agentId}/inbox`)
    return messages
  }

  async writeInbox(_agentId: string, _messages: AgentMessage[]): Promise<void> {
    // Inbox writes happen via event append on the server
  }
}
