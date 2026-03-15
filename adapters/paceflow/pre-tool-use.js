#!/usr/bin/env node
/**
 * MACS × PACEflow — PreToolUse Hook
 *
 * Blocks Write/Edit operations if the active MACS task has no plan.md.
 * Install: macs install-hooks --mode pace
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const cwd = process.cwd()
const macsDir = join(cwd, '.macs')
const stateFile = join(macsDir, 'protocol', 'state.json')

// Not a MACS project — pass through
if (!existsSync(stateFile)) process.exit(0)

// Read hook input from stdin
let input = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', d => input += d)
process.stdin.on('end', () => {
  try {
    const { tool_name } = JSON.parse(input)

    // Only gate write operations
    const writeOps = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']
    if (!writeOps.includes(tool_name)) process.exit(0)

    const state = JSON.parse(readFileSync(stateFile, 'utf-8'))
    const activeTasks = Object.values(state.tasks || {}).filter(t =>
      t.status === 'in_progress' && t.assignee === 'cli'
    )

    if (activeTasks.length === 0) process.exit(0)

    // Check each active task for plan.md
    const unplanned = activeTasks.filter(t => {
      const planPath = join(macsDir, 'pace', t.id, 'plan.md')
      return !existsSync(planPath)
    })

    if (unplanned.length > 0) {
      const ids = unplanned.map(t => t.id).join(', ')
      console.log(JSON.stringify({
        hookSpecificOutput: {
          permissionDecision: 'deny',
          reason: `MACS×PACE: Task ${ids} has no plan.md. Create .macs/pace/${unplanned[0].id}/plan.md before writing code.\n\nTemplate:\n# Plan: ${unplanned[0].title}\n\n## Approach\n...\n\n## Files\n- Modify: ...\n\n## Verification\n- [ ] ...`
        }
      }))
      process.exit(0)
    }

    process.exit(0)
  } catch {
    // Parse error or unexpected state — don't block
    process.exit(0)
  }
})
