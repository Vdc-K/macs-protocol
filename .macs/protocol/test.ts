/**
 * MACS Protocol v3.0 — Integration Test
 *
 * Simulates: 3 agents, 5 tasks, full lifecycle
 */

import { mkdirSync, rmSync, existsSync } from 'fs'
import { MACSEngine } from './engine.js'
import { HumanGenerator } from './human-generator.js'

const TEST_DIR = '/tmp/macs-protocol-test'

// Clean start
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
mkdirSync(TEST_DIR, { recursive: true })

const engine = new MACSEngine(TEST_DIR)
const generator = new HumanGenerator(TEST_DIR)

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.log(`  ❌ ${msg}`)
  }
}

console.log('\n🧪 MACS Protocol v3.0 — Integration Test\n')

// ── Init ──────────────────────────────────────────
console.log('1. Init')
const config = engine.init('test-project')
assert(config.version === '3.0', 'Config version is 3.0')
assert(config.project === 'test-project', 'Project name correct')

const state0 = engine.getState()
assert(state0.version === '3.0', 'State version is 3.0')
assert(Object.keys(state0.tasks).length === 0, 'No tasks initially')

// ── Register Agents ───────────────────────────────
console.log('\n2. Register Agents')
engine.registerAgent('lead-opus', { capabilities: ['architecture', 'planning'], model: 'opus', role: 'lead' })
engine.registerAgent('engineer-sonnet', { capabilities: ['backend', 'testing'], model: 'sonnet', role: 'engineer' })
engine.registerAgent('frontend-haiku', { capabilities: ['frontend', 'css'], model: 'haiku', role: 'engineer' })

const state1 = engine.getState()
assert(Object.keys(state1.agents).length === 3, '3 agents registered')
assert(state1.agents['lead-opus'].capabilities.includes('architecture'), 'Lead has architecture capability')
assert(state1.metrics.active_agents === 3, '3 active agents')

// ── Create Tasks ──────────────────────────────────
console.log('\n3. Create Tasks')
const t1 = engine.createTask('lead-opus', {
  title: 'Design database schema',
  priority: 'high',
  tags: ['database', 'backend'],
  affects: ['schema/*', 'migrations/*'],
})
assert(t1.id === 'T-001', 'First task ID is T-001')
assert(t1.status === 'pending', 'Task starts as pending')

const t2 = engine.createTask('lead-opus', {
  title: 'Implement JWT auth',
  priority: 'high',
  tags: ['auth', 'backend'],
  depends: ['T-001'],
  affects: ['api/auth/*'],
  estimate_ms: 14400000,
})
assert(t2.id === 'T-002', 'Second task ID is T-002')
assert(t2.depends.includes('T-001'), 'T-002 depends on T-001')

const t3 = engine.createTask('lead-opus', {
  title: 'Build login page',
  priority: 'medium',
  tags: ['frontend', 'auth'],
  depends: ['T-002'],
  affects: ['src/pages/login/*'],
})

const t4 = engine.createTask('lead-opus', {
  title: 'Write API tests',
  priority: 'medium',
  tags: ['testing'],
  depends: ['T-002'],
  affects: ['tests/api/*'],
})

const t5 = engine.createTask('lead-opus', {
  title: 'Setup CI/CD',
  priority: 'low',
  tags: ['devops'],
  affects: ['.github/*'],
})

const state2 = engine.getState()
assert(state2.metrics.total_tasks === 5, '5 tasks created')
assert(state2.metrics.pending === 5, 'All 5 pending')

// ── Task Claiming ─────────────────────────────────
console.log('\n4. Task Claiming')

// T-002 depends on T-001, so auto-claim should pick T-001 (higher priority, no deps)
const claimed1 = engine.claimTask('engineer-sonnet')
assert(claimed1?.id === 'T-001', 'Auto-claim picks T-001 (no deps, high priority)')

// T-002 still blocked by T-001, so auto-claim should pick T-005 (low, no deps)
const claimed2 = engine.claimTask('frontend-haiku')
assert(claimed2?.id === 'T-005', 'Auto-claim picks T-005 (only unblocked task left)')

// Try to claim T-002 explicitly — should fail (depends on T-001 not done)
// Actually claim works regardless of deps for explicit claims
const claimed3 = engine.claimTask('engineer-sonnet', 'T-002')
// This should assign T-002 even though dep not done (explicit claim)
assert(claimed3?.id === 'T-002', 'Explicit claim works for T-002')

// ── Task Lifecycle ────────────────────────────────
console.log('\n5. Task Lifecycle')

engine.startTask('engineer-sonnet', 'T-001')
let stateNow = engine.getState()
assert(stateNow.tasks['T-001'].status === 'in_progress', 'T-001 in progress')
assert(stateNow.tasks['T-001'].started_at !== undefined, 'T-001 has started_at')

// Block T-001
engine.blockTask('engineer-sonnet', 'T-001', {
  reason: 'need_decision',
  description: 'Need database choice: PostgreSQL or MySQL?',
  escalate_to: 'lead-opus',
})
stateNow = engine.getState()
assert(stateNow.tasks['T-001'].status === 'blocked', 'T-001 is blocked')
assert(stateNow.tasks['T-001'].blocked_history.length === 1, 'Block recorded in history')

// Unblock T-001
engine.unblockTask('lead-opus', 'T-001', {
  decision: 'Use PostgreSQL',
  context: 'Better JSON support, team familiarity',
})
stateNow = engine.getState()
assert(stateNow.tasks['T-001'].status === 'in_progress', 'T-001 back to in_progress')
assert(stateNow.tasks['T-001'].blocked_history[0].decision === 'Use PostgreSQL', 'Decision recorded')

// Complete T-001
engine.completeTask('engineer-sonnet', 'T-001', {
  artifacts: ['schema/users.sql', 'schema/sessions.sql'],
  summary: 'PostgreSQL schema with users and sessions tables',
  actual_ms: 7200000,
})
stateNow = engine.getState()
assert(stateNow.tasks['T-001'].status === 'completed', 'T-001 completed')
assert(stateNow.tasks['T-001'].artifacts.length === 2, '2 artifacts recorded')
assert(stateNow.metrics.completed === 1, 'Metrics: 1 completed')

// ── File Locks ────────────────────────────────────
console.log('\n6. File Locks')

const lockOk = engine.acquireLock('engineer-sonnet', 'api/auth/jwt.ts', 'Implementing JWT', 3600000)
assert(lockOk === true, 'Lock acquired successfully')

const lockFail = engine.acquireLock('frontend-haiku', 'api/auth/jwt.ts')
assert(lockFail === false, 'Cannot acquire lock on already-locked file')

stateNow = engine.getState()
assert(stateNow.locks.length === 1, '1 active lock')

engine.releaseLock('engineer-sonnet', 'api/auth/jwt.ts')
stateNow = engine.getState()
assert(stateNow.locks.length === 0, 'Lock released')

// ── Messaging ─────────────────────────────────────
console.log('\n7. Messaging')

engine.sendMessage({
  from: 'lead-opus',
  to: 'engineer-sonnet',
  type: 'general',
  re: 'T-002',
  data: { content: 'T-001 is done, you can start T-002 now' },
})

const inbox = engine.getInbox('engineer-sonnet')
assert(inbox.length === 1, '1 message in inbox')
assert(inbox[0].from === 'lead-opus', 'Message from lead-opus')

const unread = engine.getInbox('engineer-sonnet', true)
assert(unread.length === 1, '1 unread message')

engine.markRead('engineer-sonnet', inbox[0].id)
const unread2 = engine.getInbox('engineer-sonnet', true)
assert(unread2.length === 0, '0 unread after marking read')

// ── Impact Analysis ───────────────────────────────
console.log('\n8. Impact Analysis')

const impact = engine.analyzeImpact('api/auth/login.ts')
assert(impact.affected_tasks.some(t => t.id === 'T-002'), 'T-002 affected by api/auth/* change')

const impact2 = engine.analyzeImpact('src/pages/login/index.tsx')
assert(impact2.affected_tasks.some(t => t.id === 'T-003'), 'T-003 affected by src/pages/login/* change')

// ── Global Events ─────────────────────────────────
console.log('\n9. Global Events')

engine.appendGlobalEvent({
  type: 'file_modified',
  ts: new Date().toISOString(),
  by: 'engineer-sonnet',
  task: 'T-001',
  data: { path: 'schema/users.sql', diff_summary: '+50 -0', purpose: 'Create users table' },
})

engine.appendGlobalEvent({
  type: 'decision_made',
  ts: new Date().toISOString(),
  by: 'lead-opus',
  task: 'T-001',
  data: {
    question: 'Database choice',
    decision: 'PostgreSQL',
    alternatives: ['MySQL', 'SQLite'],
    rationale: 'Better JSON support, team familiarity',
  },
})

engine.appendGlobalEvent({
  type: 'breaking_change',
  ts: new Date().toISOString(),
  by: 'engineer-sonnet',
  task: 'T-002',
  data: {
    file: 'api/auth/jwt.ts',
    description: 'JWT token format changed from HS256 to RS256',
    affected_agents: ['frontend-haiku'],
    migration: 'Update token verification to use public key',
  },
})

const events = engine.getGlobalEvents()
assert(events.length >= 3, 'Global events recorded')

// ── Human Generation ──────────────────────────────
console.log('\n10. Human-Readable Generation')

generator.generate()

const fs = await import('fs')
assert(fs.existsSync(`${TEST_DIR}/.macs/human/TASK.md`), 'TASK.md generated')
assert(fs.existsSync(`${TEST_DIR}/.macs/human/CHANGELOG.md`), 'CHANGELOG.md generated')
assert(fs.existsSync(`${TEST_DIR}/.macs/human/STATUS.md`), 'STATUS.md generated')

const taskMd = fs.readFileSync(`${TEST_DIR}/.macs/human/TASK.md`, 'utf-8')
assert(taskMd.includes('T-001'), 'TASK.md contains T-001')
assert(taskMd.includes('completed'), 'TASK.md shows completed status')
assert(taskMd.includes('Auto-generated'), 'TASK.md has auto-generated notice')

const changelogMd = fs.readFileSync(`${TEST_DIR}/.macs/human/CHANGELOG.md`, 'utf-8')
assert(changelogMd.includes('Decision'), 'CHANGELOG.md contains decisions')
assert(changelogMd.includes('Breaking'), 'CHANGELOG.md contains breaking changes')

const statusMd = fs.readFileSync(`${TEST_DIR}/.macs/human/STATUS.md`, 'utf-8')
assert(statusMd.includes('lead-opus'), 'STATUS.md lists agents')

// ── Agent Stats ───────────────────────────────────
console.log('\n11. Agent Stats')

const finalState = engine.getState()
const sonnetStats = finalState.agents['engineer-sonnet']?.stats
assert(sonnetStats?.tasks_completed === 1, 'Sonnet completed 1 task')
assert(sonnetStats?.blocked_count === 1, 'Sonnet was blocked 1 time')

// ── Task Decomposition (2.27) ─────────────────────
console.log('\n12. Task Decomposition')

const epicTask = engine.createTask('lead-opus', {
  title: 'Build auth system',
  priority: 'high',
  description: 'Implement full authentication flow',
  tags: ['auth'],
  affects: ['src/auth/*'],
})
assert(epicTask.status === 'pending', 'Epic task starts as pending')

const subtasks = engine.decomposeTask('lead-opus', epicTask.id, [
  'Design auth schema',
  'Implement JWT endpoints',
  'Write auth tests',
], 'Auth is too large for one agent')

assert(subtasks.length === 3, 'Decomposed into 3 subtasks')

const decomposedState = engine.getState()
const parent = decomposedState.tasks[epicTask.id]
assert(parent.status === 'waiting_for_subtasks', 'Parent is waiting_for_subtasks')
assert(parent.subtasks?.length === 3, 'Parent has 3 subtasks')

const sub1 = decomposedState.tasks[subtasks[0].id]
assert(sub1.parent_task === epicTask.id, 'Subtask has parent_task reference')
assert(sub1.goal_chain?.includes('Implement full authentication flow'), 'Subtask inherits goal_chain')
assert(sub1.priority === 'high', 'Subtask inherits priority')
assert(sub1.tags?.includes('auth'), 'Subtask inherits tags')

// Complete all subtasks → parent should auto-complete
engine.registerAgent('agent-test', { capabilities: ['auth'] })
for (const sub of subtasks) {
  engine.claimTask('agent-test', sub.id)
  engine.startTask('agent-test', sub.id)
  engine.completeTask('agent-test', sub.id, { artifacts: [`src/auth/${sub.id}.ts`] })
}

const autoCompletedState = engine.getState()
const autoParent = autoCompletedState.tasks[epicTask.id]
assert(autoParent.status === 'completed', 'Parent auto-completes when all subtasks done')
assert((autoParent.artifacts?.length || 0) === 3, 'Parent inherits artifacts from subtasks')

// Metrics
const m2 = autoCompletedState.metrics
assert(m2.waiting_for_subtasks === 0, 'No tasks stuck in waiting_for_subtasks after completion')

// ── Forced Handoff (2.26) ─────────────────────────
console.log('\n13. Forced Handoff')

const handoffTask = engine.createTask('engineer-sonnet', {
  title: 'Implement OAuth flow',
  priority: 'high',
  tags: ['auth'],
})
engine.claimTask('engineer-sonnet', handoffTask.id)
engine.startTask('engineer-sonnet', handoffTask.id)

// Block with handoff note
const handoffNote = '✓ schema done\n→ implement JWT middleware\n⚠ refresh token not designed\n? which OAuth provider @lead'
engine.blockTask('engineer-sonnet', handoffTask.id, {
  reason: 'need_decision',
  description: 'need OAuth provider decision',
  escalate_to: 'lead-opus',
  handoff_note: handoffNote,
})

const handoffState = engine.getState()
const blockedTask = handoffState.tasks[handoffTask.id]
assert(blockedTask.status === 'blocked', 'Task is blocked')
assert(blockedTask.handoff_note === handoffNote, 'Handoff note stored on task')
assert(blockedTask.blocked_history[0].handoff_note === handoffNote, 'Handoff note in blocked_history')
assert(blockedTask.handoff_note!.includes('→'), 'Handoff contains next step')
assert(blockedTask.handoff_note!.includes('✓'), 'Handoff contains done items')
assert(blockedTask.handoff_note!.includes('⚠'), 'Handoff contains issues')
assert(blockedTask.handoff_note!.includes('?'), 'Handoff contains open questions')

// Cancel with handoff
const cancelTask = engine.createTask('engineer-sonnet', {
  title: 'Refactor legacy code',
  priority: 'low',
})
engine.cancelTask('engineer-sonnet', cancelTask.id, {
  reason: 'out of scope',
  handoff_note: '→ revisit in Phase 3 when core is stable',
})

const cancelState = engine.getState()
const cancelledTask = cancelState.tasks[cancelTask.id]
assert(cancelledTask.status === 'cancelled', 'Task is cancelled')
assert(cancelledTask.handoff_note?.includes('→'), 'Cancelled task has handoff note')

// ── Drift Detection (2.28) ────────────────────────
console.log('\n14. Drift Detection')

// Create a task that will be "silent" (no checkpoint)
const driftTask = engine.createTask('lead-opus', {
  title: 'Silent background task',
  priority: 'medium',
})
engine.claimTask('engineer-sonnet', driftTask.id)
engine.startTask('engineer-sonnet', driftTask.id)

// With no checkpoint, task drifts immediately when threshold=0
const driftResults = engine.getDrift(0) // threshold=0ms → everything drifts
assert(driftResults.some(d => d.task.id === driftTask.id), 'Silent task detected as drifting')

const driftEntry = driftResults.find(d => d.task.id === driftTask.id)!
assert(driftEntry.silentMs >= 0, 'silentMs is non-negative')
assert(['suspected', 'confirmed'].includes(driftEntry.level), 'drift level is valid')

// Add checkpoint → resets drift
engine.addCheckpoint('engineer-sonnet', driftTask.id, {
  note: '✓ background processing done → finalize output',
  progress: 0.7,
})

const afterCheckpoint = engine.getState()
const checkedTask = afterCheckpoint.tasks[driftTask.id]
assert(checkedTask.last_checkpoint_at !== undefined, 'last_checkpoint_at recorded')

// With a recent checkpoint, getDrift with very small threshold still works
// (the task just checkpointed, so silentMs ≈ 0)
const driftAfter = engine.getDrift(5000) // 5 sec threshold
const stillDrifting = driftAfter.find(d => d.task.id === driftTask.id)
// A just-checkpointed task should NOT be drifting for 5 sec threshold
assert(!stillDrifting, 'Checkpointed task is no longer drifting')

// getDrift returns empty for tasks not in_progress
const noActiveDrift = engine.getDrift(0).filter(d =>
  d.task.status !== 'in_progress'
)
assert(noActiveDrift.length === 0, 'Drift only reports in_progress tasks')

// ── Section 15: Swarm Orchestration ──────────────
console.log('\n15. Swarm Orchestration')

// Create a small dependency chain for swarm
const sw1 = engine.createTask('lead-opus', { title: 'Swarm: Schema design', priority: 'high' })
const sw2 = engine.createTask('lead-opus', {
  title: 'Swarm: Build API',
  priority: 'high',
  depends: [sw1.id],
})
const sw3 = engine.createTask('lead-opus', {
  title: 'Swarm: Write tests',
  priority: 'medium',
  depends: [sw2.id],
})
const sw4 = engine.createTask('lead-opus', {
  title: 'Swarm: Deploy',
  priority: 'low',
  depends: [sw3.id],
})

assert(engine.getState().tasks[sw1.id].status === 'pending', 'Swarm tasks created as pending')

// Register swarm agents
engine.registerAgent('swarm-1', { capabilities: ['backend'] })
engine.registerAgent('swarm-2', { capabilities: ['testing'] })
assert(engine.getState().agents['swarm-1'] !== undefined, 'swarm-1 registered')

// Simulate what `macs swarm --simulate` does: loop rounds of claim+start+complete
const swarmPriority: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const swarmAgents = ['swarm-1', 'swarm-2']

function swarmRound(): number {
  const available = engine
    .findTasks({ status: 'pending', assignee: null, unblocked: true })
    .sort((a, b) => (swarmPriority[a.priority] ?? 2) - (swarmPriority[b.priority] ?? 2))
  if (available.length === 0) return 0
  let count = 0
  let taskIdx = 0
  for (const agentId of swarmAgents) {
    if (taskIdx >= available.length) break
    const task = available[taskIdx++]
    engine.claimTask(agentId, task.id)
    engine.startTask(agentId, task.id)
    engine.completeTask(agentId, task.id, { summary: 'swarm-test', artifacts: [] })
    count++
  }
  return count
}

// Round 1: only sw1 available (sw2-sw4 have unmet deps)
const r1 = swarmRound()
assert(r1 === 1, 'Round 1: exactly 1 task available (sw1, deps chain)')

const stateR1 = engine.getState()
assert(stateR1.tasks[sw1.id].status === 'completed', 'sw1 completed in round 1')
assert(stateR1.tasks[sw2.id].status === 'pending', 'sw2 still pending after round 1')

// Round 2: sw2 unblocked (sw1 done)
const r2 = swarmRound()
assert(r2 === 1, 'Round 2: sw2 now unblocked and completed')
assert(engine.getState().tasks[sw2.id].status === 'completed', 'sw2 completed in round 2')

// Rounds 3 & 4: sw3 then sw4
swarmRound()
swarmRound()

const stateSwarmFinal = engine.getState()
assert(stateSwarmFinal.tasks[sw3.id].status === 'completed', 'sw3 completed via swarm')
assert(stateSwarmFinal.tasks[sw4.id].status === 'completed', 'sw4 completed via swarm')

const swarmTaskIds = [sw1.id, sw2.id, sw3.id, sw4.id]
const allSwarmDone = swarmTaskIds.every(id => stateSwarmFinal.tasks[id].status === 'completed')
assert(allSwarmDone, 'All 4 swarm tasks completed via round orchestration')

// Agent stats reflect completed work
const s1stats = stateSwarmFinal.agents['swarm-1'].stats
const s2stats = stateSwarmFinal.agents['swarm-2'].stats
assert(s1stats.tasks_completed + s2stats.tasks_completed === 4, 'Swarm agents completed 4 tasks total')

// ── Section 16: Capability Routing (3.1) ───────────
console.log('\n16. Capability Routing (3.1)')

// Create a task that requires 'ml' capability
const mlTask = engine.createTask('lead-opus', {
  title: 'Train embedding model',
  priority: 'high',
  tags: ['ml'],
  requires_capabilities: ['ml'],
})
assert(mlTask.requires_capabilities?.includes('ml') === true, '3.1: requires_capabilities stored on task')

// engineer-sonnet has ['backend','testing'] — cannot claim ml task
const capFilteredNoMatch = engine.findTasks({ status: 'pending', unblocked: true, capable_agent: 'engineer-sonnet' })
assert(!capFilteredNoMatch.find(t => t.id === mlTask.id), '3.1: engineer-sonnet cannot see ml task via capable_agent filter')

// Register a new agent with ml capability
engine.registerAgent('ml-agent', { capabilities: ['ml'], model: 'sonnet' })
const capFilteredMatch = engine.findTasks({ status: 'pending', unblocked: true, capable_agent: 'ml-agent' })
assert(!!capFilteredMatch.find(t => t.id === mlTask.id), '3.1: ml-agent can see ml task via capable_agent filter')

// Auto-claim: engineer-sonnet should skip ml task (not capable)
const noClaim = engine.claimTask('engineer-sonnet')
const engineerClaimed = noClaim ? noClaim.id !== mlTask.id : true
assert(engineerClaimed, '3.1: auto-claim skips tasks the agent cannot do')

// ml-agent can claim the ml task
const mlClaimed = engine.claimTask('ml-agent', mlTask.id)
assert(!!mlClaimed, '3.1: ml-agent can claim ml task')
assert(mlClaimed?.assignee === 'ml-agent', '3.1: ml task assigned to ml-agent')

// ── Section 17: Review Chain (3.10) ─────────────────
console.log('\n17. Review Chain (3.10)')

// Create and complete a task, then request review
const reviewTask = engine.createTask('engineer-sonnet', {
  title: 'Implement payment flow',
  priority: 'high',
})
engine.claimTask('engineer-sonnet', reviewTask.id)
engine.startTask('engineer-sonnet', reviewTask.id)

// Request review instead of direct completion
engine.requestReview('engineer-sonnet', reviewTask.id, {
  note: 'Please review the Stripe integration logic',
  suggested_reviewer: 'lead-opus',
})
const stateAfterReviewReq = engine.getState()
assert(stateAfterReviewReq.tasks[reviewTask.id].status === 'review_required', '3.10: task status is review_required after requestReview')
assert(stateAfterReviewReq.tasks[reviewTask.id].reviewer === 'lead-opus', '3.10: suggested reviewer stored')
assert(stateAfterReviewReq.metrics.review_required === 1, '3.10: metrics.review_required === 1')

// Reviewer rejects
engine.submitReview('lead-opus', reviewTask.id, { result: 'rejected', note: 'Missing error handling' })
const stateAfterReject = engine.getState()
assert(stateAfterReject.tasks[reviewTask.id].status === 'in_progress', '3.10: rejected task back to in_progress')
assert(stateAfterReject.tasks[reviewTask.id].review_result === 'rejected', '3.10: review_result stored')
assert(stateAfterReject.tasks[reviewTask.id].review_note === 'Missing error handling', '3.10: review_note stored')

// Re-request review and approve
engine.requestReview('engineer-sonnet', reviewTask.id, { note: 'Error handling added' })
engine.submitReview('lead-opus', reviewTask.id, { result: 'approved' })
const stateAfterApprove = engine.getState()
assert(stateAfterApprove.tasks[reviewTask.id].status === 'completed', '3.10: approved task becomes completed')
assert(stateAfterApprove.tasks[reviewTask.id].review_result === 'approved', '3.10: final review_result is approved')

// ── Section 18: Escalation (3.11) ───────────────────
console.log('\n18. Escalation (3.11)')

const escalateTask = engine.createTask('engineer-sonnet', {
  title: 'Resolve data privacy compliance',
  priority: 'critical',
})
engine.claimTask('engineer-sonnet', escalateTask.id)
engine.startTask('engineer-sonnet', escalateTask.id)
engine.escalateTask('engineer-sonnet', escalateTask.id, {
  reason: 'Requires legal sign-off on GDPR data retention policy',
  escalate_to: 'human-cto',
  timeout_ms: 3600000,
})
const stateAfterEscalate = engine.getState()
assert(stateAfterEscalate.tasks[escalateTask.id].status === 'pending_human', '3.11: escalated task is pending_human')
assert(stateAfterEscalate.tasks[escalateTask.id].escalation_reason?.includes('GDPR') === true, '3.11: escalation_reason stored')
assert(stateAfterEscalate.tasks[escalateTask.id].escalated_to === 'human-cto', '3.11: escalated_to stored')
assert(stateAfterEscalate.tasks[escalateTask.id].escalation_timeout_ms === 3600000, '3.11: escalation timeout stored')
assert(stateAfterEscalate.metrics.pending_human === 1, '3.11: metrics.pending_human === 1')

// ── Section 19: Dead Agent Reaping (3.12) ───────────
console.log('\n19. Dead Agent Reaping (3.12)')

// Register an agent and assign it a task
engine.registerAgent('zombie-agent', { capabilities: ['backend'], model: 'haiku' })
const zombieTask = engine.createTask('lead-opus', {
  title: 'Zombie agent task',
  priority: 'medium',
})
engine.claimTask('zombie-agent', zombieTask.id)
engine.startTask('zombie-agent', zombieTask.id)

// Verify task is assigned
assert(engine.getState().tasks[zombieTask.id].assignee === 'zombie-agent', '3.12: zombie task assigned')

// Reap with threshold=0ms (all agents with heartbeat in the past are dead)
const reaped = engine.reapDeadAgents(0)
assert(reaped.length > 0, '3.12: reapDeadAgents returns at least one dead agent')
const zombieReap = reaped.find(r => r.agentId === 'zombie-agent')
assert(!!zombieReap, '3.12: zombie-agent is reaped')
assert(zombieReap?.reassigned.includes(zombieTask.id) === true, '3.12: zombie task included in reassigned')

const stateAfterReap = engine.getState()
assert(stateAfterReap.agents['zombie-agent'].status === 'dead', '3.12: zombie-agent status is dead')
assert(stateAfterReap.tasks[zombieTask.id].assignee === null, '3.12: reassigned task has null assignee')
assert(stateAfterReap.tasks[zombieTask.id].status === 'pending', '3.12: reassigned task is back to pending')
assert(stateAfterReap.metrics.dead_agents >= 1, '3.12: metrics.dead_agents >= 1')

// ── Summary ───────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`${'═'.repeat(50)}\n`)

if (failed > 0) process.exit(1)

// Cleanup
rmSync(TEST_DIR, { recursive: true })
console.log('🧹 Test directory cleaned up\n')
