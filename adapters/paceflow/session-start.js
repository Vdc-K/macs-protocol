#!/usr/bin/env node
/**
 * MACS × PACEflow — Session Start Hook
 *
 * On session start: auto-creates artifact directory for any in-progress task,
 * and prints a reminder about active work.
 * Install: macs install-hooks --mode pace
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const cwd = process.cwd()
const macsDir = join(cwd, '.macs')
const stateFile = join(macsDir, 'protocol', 'state.json')

if (!existsSync(stateFile)) process.exit(0)

try {
  const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
  const activeTasks = Object.values(state.tasks || {}).filter(t =>
    t.status === 'in_progress' || t.status === 'assigned'
  )

  if (activeTasks.length === 0) process.exit(0)

  for (const task of activeTasks) {
    const paceDir = join(macsDir, 'pace', task.id)
    const planFile = join(paceDir, 'plan.md')

    // Create pace dir + plan template if missing
    if (!existsSync(paceDir)) {
      mkdirSync(paceDir, { recursive: true })
    }
    if (!existsSync(planFile)) {
      writeFileSync(planFile, `# Plan: ${task.title}\n\n## Approach\n\n## Files\n- Modify: \n\n## Verification\n- [ ] \n`)
    }
  }

  // Print context injection for Claude
  const taskList = activeTasks.map(t => {
    const hasplan = existsSync(join(macsDir, 'pace', t.id, 'plan.md'))
    const planStatus = hasplan ? '📋 plan ready' : '⚠️  needs plan.md'
    return `  ${t.id}  [${t.status}]  ${t.title}  — ${planStatus}`
  }).join('\n')

  console.log(`\n🔄 MACS Active Tasks:\n${taskList}`)
  console.log(`\nPlan files: .macs/pace/{task-id}/plan.md`)
} catch {
  process.exit(0)
}
