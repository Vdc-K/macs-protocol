#!/usr/bin/env node
/**
 * MACS × PACEflow — Stop Hook
 *
 * Prevents Claude from ending the session if there are in-progress
 * MACS tasks without a recent checkpoint (i.e., unverified work).
 *
 * Allows 3 consecutive stops before backing off (anti-loop protection).
 * Install: macs install-hooks --mode pace
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const cwd = process.cwd()
const macsDir = join(cwd, '.macs')
const stateFile = join(macsDir, 'protocol', 'state.json')
const counterFile = join(macsDir, '.stop-count')

// Not a MACS project — pass through
if (!existsSync(stateFile)) process.exit(0)

// Anti-loop: if blocked 3 times in a row, let it through
let stopCount = 0
if (existsSync(counterFile)) {
  stopCount = parseInt(readFileSync(counterFile, 'utf-8').trim()) || 0
}
if (stopCount >= 3) {
  writeFileSync(counterFile, '0')
  process.exit(0)
}

try {
  const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
  const activeTasks = Object.values(state.tasks || {}).filter(t =>
    t.status === 'in_progress'
  )

  if (activeTasks.length === 0) {
    writeFileSync(counterFile, '0')
    process.exit(0)
  }

  // Find tasks with no checkpoint in the last 10 minutes
  const now = Date.now()
  const unverified = activeTasks.filter(t => {
    if (!t.last_checkpoint_at) return true
    const age = now - new Date(t.last_checkpoint_at).getTime()
    return age > 10 * 60 * 1000 // 10 minutes
  })

  if (unverified.length === 0) {
    writeFileSync(counterFile, '0')
    process.exit(0)
  }

  // Block and inform
  const ids = unverified.map(t => `${t.id}: ${t.title}`).join('\n  ')
  writeFileSync(counterFile, String(stopCount + 1))

  console.error(`\n⚠️  MACS×PACE: ${unverified.length} task(s) in progress without verification:\n  ${ids}\n`)
  console.error(`Before stopping, either:`)
  console.error(`  macs checkpoint <task-id> --note "✓ done → next: ... ⚠ issues: ..."`)
  console.error(`  macs done <task-id> --summary "..."`)
  console.error(`  macs block <task-id> --reason "..." --next "..."`)
  console.error(`\n(This check will auto-bypass after 3 attempts)\n`)

  process.exit(2) // exit 2 blocks Claude from stopping
} catch {
  writeFileSync(counterFile, '0')
  process.exit(0)
}
