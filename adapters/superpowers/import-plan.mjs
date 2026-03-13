#!/usr/bin/env node
/**
 * MACS × Superpowers — Import Plan
 * Parses a Superpowers-generated plan file and batch-creates MACS tasks.
 *
 * Usage:
 *   node import-plan.mjs <plan-file> [--agent <id>] [--dry-run]
 *
 * Example:
 *   node import-plan.mjs docs/superpowers/plans/2026-03-13-auth.md --agent pm
 */

import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { basename } from 'path'

const args = process.argv.slice(2)
const planFile = args.find(a => !a.startsWith('--'))
const agentId = args[args.indexOf('--agent') + 1] || 'pm'
const dryRun = args.includes('--dry-run')

if (!planFile) {
  console.error('Usage: node import-plan.mjs <plan-file> [--agent <id>] [--dry-run]')
  process.exit(1)
}

const content = readFileSync(planFile, 'utf-8')
const lines = content.split('\n')

// --- Parse goal from header ---
const goalMatch = content.match(/\*\*Goal:\*\*\s*(.+)/)
const goal = goalMatch?.[1]?.trim() || basename(planFile, '.md')

// --- Parse tech stack for tags ---
const stackMatch = content.match(/\*\*Tech Stack:\*\*\s*(.+)/)
const stackTags = (stackMatch?.[1] || '').split(/[,/\s]+/).map(s => s.toLowerCase().trim()).filter(s => s.length > 2 && s.length < 20)

// --- Parse tasks: ### Task N: Title ---
const taskRegex = /^###\s+(?:Task\s+\d+[:\s]+)?(.+)$/
const tasks = []

let currentTask = null
let currentFiles = []
let inFilesBlock = false

for (const line of lines) {
  const taskMatch = line.match(taskRegex)
  if (taskMatch && !line.startsWith('####')) {
    if (currentTask) {
      tasks.push({ ...currentTask, files: currentFiles })
    }
    currentTask = { title: taskMatch[1].trim() }
    currentFiles = []
    inFilesBlock = false
    continue
  }

  if (!currentTask) continue

  if (line.trim() === '**Files:**') {
    inFilesBlock = true
    continue
  }
  if (inFilesBlock) {
    if (line.startsWith('- ')) {
      const fileMatch = line.match(/`([^`]+)`/)
      if (fileMatch) currentFiles.push(fileMatch[1])
    } else if (line.trim() === '' || line.startsWith('- [ ]')) {
      inFilesBlock = false
    }
  }
}
if (currentTask) {
  tasks.push({ ...currentTask, files: currentFiles })
}

if (tasks.length === 0) {
  console.error('No tasks found. Expected "### Task N: Title" headers.')
  process.exit(1)
}

// --- Infer priority ---
function inferPriority(title) {
  const t = title.toLowerCase()
  if (/test|mock|fixture|spec/.test(t)) return 'low'
  if (/auth|core|api|security|critical|foundation/.test(t)) return 'high'
  return 'medium'
}

// --- Infer tags from file paths ---
function inferTags(title, files) {
  const tags = new Set(stackTags.slice(0, 3))
  const t = title.toLowerCase()
  if (/test/.test(t)) tags.add('testing')
  if (/api|endpoint|route/.test(t)) tags.add('backend')
  if (/ui|component|page|view/.test(t)) tags.add('frontend')
  if (/db|database|migration|model/.test(t)) tags.add('database')
  for (const f of files) {
    if (f.includes('test')) tags.add('testing')
    if (f.includes('api') || f.includes('route')) tags.add('backend')
  }
  return [...tags].slice(0, 4)
}

// --- Print plan ---
console.log(`\n📋 Superpowers Plan: ${goal}`)
console.log(`   ${tasks.length} tasks found in ${planFile}`)
console.log(`${'─'.repeat(50)}`)

tasks.forEach((t, i) => {
  const p = inferPriority(t.title)
  const tags = inferTags(t.title, t.files)
  console.log(`  [${i + 1}] [${p}] ${t.title}`)
  if (t.files.length > 0) console.log(`       files: ${t.files.slice(0, 3).join(', ')}`)
  if (tags.length > 0) console.log(`       tags:  ${tags.join(', ')}`)
})

console.log('')

if (dryRun) {
  console.log('✋ Dry run — no tasks created. Remove --dry-run to create.')
  process.exit(0)
}

// --- Batch create tasks ---
let created = 0
const taskIds = []

for (const task of tasks) {
  const priority = inferPriority(task.title)
  const tags = inferTags(task.title, task.files)
  const prev = taskIds[taskIds.length - 1]

  const titleArg = task.title.replace(/"/g, '\\"')
  const tagsArg = tags.length > 0 ? `--tags "${tags.join(',')}"` : ''
  const depArg = prev ? `--depends "${prev}"` : ''
  const cmd = `macs create "${titleArg}" --priority ${priority} ${tagsArg} ${depArg}`

  try {
    const out = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim()
    // Extract task ID from output: "✅ Created T-042: ..."
    const idMatch = out.match(/Created (T-\d+)/)
    if (idMatch) taskIds.push(idMatch[1])
    console.log(out)
    created++
  } catch (err) {
    console.error(`❌ Failed: ${task.title}`)
    console.error(err.message)
  }
}

console.log(`\n✅ Created ${created}/${tasks.length} tasks from Superpowers plan`)
if (taskIds.length > 0) {
  console.log(`   Tasks: ${taskIds.join(' → ')} (chained dependencies)`)
}
console.log(`\nNext: macs swarm --agents 3 --simulate`)
