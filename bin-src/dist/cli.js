#!/usr/bin/env node
/**
 * MACS CLI v3.0
 *
 * Usage:
 *   macs boot --agent <id> [--capabilities a,b] [--model sonnet]
 *   macs init [project-name]
 *   macs status
 *   macs create <title> [--priority high] [--depends T-001] [--tags auth,backend] [--requires cap1,cap2]
 *   macs claim [task-id]
 *   macs start <task-id>
 *   macs done <task-id> [--summary "..."] [--artifacts file1,file2]
 *   macs block <task-id> --reason "..." --next "..." [--done "..."] [--issue "..."] [--question "..."]
 *   macs cancel <task-id> --reason "..." --next "..." [--agent id]
 *   macs unblock <task-id> [--decision "..."]
 *   macs checkpoint <task-id> --agent <id> --note "✓ done → next ⚠ issue" [--progress 0.6]
 *   macs drift [--threshold 30]
 *   macs decompose <task-id> --into "subtask1,subtask2" [--rationale "..."] [--agent id]
 *   macs review <task-id> --agent <id> --result approve|reject [--note "..."]
 *   macs escalate <task-id> --reason "..." [--to human-id] [--timeout 60] [--agent id]
 *   macs reap [--threshold 45]
 *   macs swarm --agents "name[:caps]|..." [--simulate] [--delay 800]
 *   macs swarm --agents N [--capabilities cap1,cap2] [--simulate] [--delay 800]
 *   macs register <agent-id> --capabilities backend,testing [--model sonnet]
 *   macs log [--limit 20]
 *   macs impact <file-path>
 *   macs inbox <agent-id>
 *   macs send <from> <to> <message> [--type general] [--re T-001]
 *   macs generate
 */
import { MACSEngine } from './engine.js';
import { HumanGenerator } from './human-generator.js';
const args = process.argv.slice(2);
const command = args[0];
const projectRoot = process.cwd();
const engine = new MACSEngine(projectRoot);
const generator = new HumanGenerator(projectRoot);
function getArg(flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && idx + 1 < args.length)
        return args[idx + 1];
    return undefined;
}
function hasFlag(flag) {
    return args.includes(flag);
}
function autoGenerate() {
    try {
        generator.generate();
    }
    catch { }
}
function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2)
        return '刚刚';
    if (minutes < 60)
        return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
}
switch (command) {
    case 'init': {
        const name = args[1] || projectRoot.split('/').pop() || 'project';
        const config = engine.init(name);
        autoGenerate();
        console.log(`✅ MACS initialized: ${name}`);
        console.log(`   .macs/protocol/  — agent data (JSONL)`);
        console.log(`   .macs/human/     — human-readable (auto-generated)`);
        console.log(`   .macs/sync/inbox/ — agent messaging`);
        console.log(`\nNext: macs register <agent-id> --capabilities backend,testing`);
        break;
    }
    case 'status': {
        const state = engine.getState();
        const m = state.metrics;
        console.log(`\n📊 Project Status`);
        console.log(`${'─'.repeat(50)}`);
        console.log(`Tasks:  ${m.completed}/${m.total_tasks} completed | ${m.in_progress} in progress | ${m.blocked} blocked | ${m.pending} pending`);
        if (m.review_required > 0)
            console.log(`        ${m.review_required} awaiting review`);
        if (m.pending_human > 0)
            console.log(`        ${m.pending_human} escalated to human`);
        console.log(`Agents: ${m.active_agents} active${m.dead_agents > 0 ? ` | ${m.dead_agents} dead` : ''}`);
        if (m.conflict_count > 0)
            console.log(`⚠️  Conflicts: ${m.conflict_count}`);
        if (m.breaking_changes > 0)
            console.log(`⚠️  Breaking changes: ${m.breaking_changes}`);
        // Show active tasks
        const activeTasks = Object.values(state.tasks).filter(t => t.status === 'in_progress' || t.status === 'blocked' || t.status === 'assigned');
        if (activeTasks.length > 0) {
            console.log(`\n📋 Active Tasks`);
            console.log(`${'─'.repeat(50)}`);
            for (const t of activeTasks) {
                const driftTag = t.drift_suspected ? ' 🌀 drift' : '';
                const statusIcon = t.status === 'in_progress' ? '🔄' : t.status === 'blocked' ? '🚫' : '📋';
                console.log(`${statusIcon} ${t.id} ${t.title}${driftTag}`);
                console.log(`   owner: ${t.assignee || 'unassigned'} | priority: ${t.priority}`);
                if (t.last_checkpoint_at)
                    console.log(`   last checkpoint: ${timeAgo(t.last_checkpoint_at)}`);
                if (t.parent_task)
                    console.log(`   subtask of: ${t.parent_task}`);
            }
        }
        // Show decomposed tasks
        const decomposedTasks = Object.values(state.tasks).filter(t => t.status === 'waiting_for_subtasks');
        if (decomposedTasks.length > 0) {
            console.log(`\n🧩 Decomposed Tasks`);
            console.log(`${'─'.repeat(50)}`);
            for (const t of decomposedTasks) {
                const done = (t.subtasks || []).filter(id => state.tasks[id]?.status === 'completed').length;
                const total = (t.subtasks || []).length;
                console.log(`⏳ ${t.id} ${t.title} [${done}/${total} subtasks done]`);
                for (const subId of (t.subtasks || [])) {
                    const sub = state.tasks[subId];
                    if (sub) {
                        const icon = sub.status === 'completed' ? '✅' : sub.status === 'in_progress' ? '🔄' : '⬜';
                        console.log(`   ${icon} ${subId}: ${sub.title} (${sub.assignee || 'unassigned'})`);
                    }
                }
            }
        }
        // Show review queue
        const reviewTasks = Object.values(state.tasks).filter(t => t.status === 'review_required' || t.status === 'under_review');
        if (reviewTasks.length > 0) {
            console.log(`\n🔍 Review Queue`);
            console.log(`${'─'.repeat(50)}`);
            for (const t of reviewTasks) {
                console.log(`👀 ${t.id} ${t.title} [${t.status}]`);
                if (t.reviewer)
                    console.log(`   reviewer: ${t.reviewer}`);
                if (t.review_requested_at)
                    console.log(`   requested: ${timeAgo(t.review_requested_at)}`);
            }
        }
        // Show escalated tasks
        const escalatedTasks = Object.values(state.tasks).filter(t => t.status === 'pending_human');
        if (escalatedTasks.length > 0) {
            console.log(`\n🆘 Escalated (Pending Human)`);
            console.log(`${'─'.repeat(50)}`);
            for (const t of escalatedTasks) {
                console.log(`🚨 ${t.id} ${t.title}`);
                if (t.escalation_reason)
                    console.log(`   reason: ${t.escalation_reason}`);
                if (t.escalated_to)
                    console.log(`   escalated to: ${t.escalated_to}`);
                if (t.escalated_at)
                    console.log(`   since: ${timeAgo(t.escalated_at)}`);
            }
        }
        // Show agents
        const agents = Object.values(state.agents);
        if (agents.length > 0) {
            console.log(`\n🤖 Agents`);
            console.log(`${'─'.repeat(50)}`);
            for (const a of agents) {
                const icon = a.status === 'busy' ? '🟢' : a.status === 'idle' ? '🟡' : a.status === 'offline' ? '🔴' : a.status === 'dead' ? '💀' : '🟠';
                const capStr = a.capabilities?.length ? ` [${a.capabilities.join(',')}]` : '';
                console.log(`${icon} ${a.id} (${a.status})${capStr} — tasks done: ${a.stats.tasks_completed}`);
            }
        }
        // Show locks
        if (state.locks.length > 0) {
            console.log(`\n🔒 Active Locks`);
            console.log(`${'─'.repeat(50)}`);
            for (const l of state.locks) {
                console.log(`  ${l.file} — locked by ${l.locked_by}`);
            }
        }
        console.log('');
        break;
    }
    case 'create': {
        const title = args[1];
        if (!title) {
            console.error('Usage: macs create <title>');
            process.exit(1);
        }
        const priority = (getArg('--priority') || 'medium');
        const tags = getArg('--tags')?.split(',') || [];
        const depends = getArg('--depends')?.split(',') || [];
        const affects = getArg('--affects')?.split(',') || [];
        const requires_capabilities = getArg('--requires')?.split(',').map(c => c.trim()).filter(Boolean);
        const task = engine.createTask('cli', { title, priority, tags, depends, affects, requires_capabilities });
        autoGenerate();
        console.log(`✅ Created ${task.id}: ${task.title} [${task.priority}]`);
        break;
    }
    case 'claim': {
        const agentId = getArg('--agent') || 'cli';
        // Only treat args[1] as taskId if it's not a flag (doesn't start with --)
        const taskId = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
        const task = engine.claimTask(agentId, taskId);
        if (task) {
            autoGenerate();
            console.log(`✅ ${agentId} claimed ${task.id}: ${task.title}`);
        }
        else {
            console.log('❌ No available tasks to claim');
        }
        break;
    }
    case 'start': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        if (!taskId) {
            console.error('Usage: macs start <task-id>');
            process.exit(1);
        }
        engine.startTask(agentId, taskId);
        autoGenerate();
        console.log(`🔄 ${agentId} started ${taskId}`);
        break;
    }
    case 'done': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        if (!taskId) {
            console.error('Usage: macs done <task-id>');
            process.exit(1);
        }
        const summary = getArg('--summary');
        const artifacts = getArg('--artifacts')?.split(',') || [];
        engine.completeTask(agentId, taskId, { summary, artifacts });
        autoGenerate();
        console.log(`✅ ${taskId} completed`);
        break;
    }
    case 'block': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        const reason = getArg('--reason') || 'unspecified';
        const escalate = getArg('--escalate');
        if (!taskId) {
            console.error('Usage: macs block <task-id> --reason "..." --next "..."');
            process.exit(1);
        }
        const next = getArg('--next');
        if (!next) {
            console.error('❌ --next is required when blocking a task (handoff protocol)');
            console.error('\nHandoff format:');
            console.error('  --next "what the next agent should do"  (required)');
            console.error('  --done "what you completed"             (optional)');
            console.error('  --issue "known problems"                (optional)');
            console.error('  --question "open questions @lead"       (optional)');
            console.error('\nExample:');
            console.error('  macs block T-001 --reason "need OAuth decision" --next "wire JWT into middleware" --done "schema done" --issue "refresh token not designed"');
            process.exit(1);
        }
        const parts = [];
        const done = getArg('--done');
        const issue = getArg('--issue');
        const question = getArg('--question');
        if (done)
            parts.push(`✓ ${done}`);
        parts.push(`→ ${next}`);
        if (issue)
            parts.push(`⚠ ${issue}`);
        if (question)
            parts.push(`? ${question}`);
        const handoff_note = parts.join('\n');
        engine.blockTask(agentId, taskId, {
            reason: 'other',
            description: reason,
            escalate_to: escalate,
            handoff_note,
        });
        autoGenerate();
        console.log(`🚫 ${taskId} blocked: ${reason}`);
        console.log(`\nHandoff note saved:`);
        for (const line of parts)
            console.log(`  ${line}`);
        break;
    }
    case 'cancel': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        const reason = getArg('--reason') || 'unspecified';
        if (!taskId) {
            console.error('Usage: macs cancel <task-id> --reason "..." --next "..."');
            process.exit(1);
        }
        const next = getArg('--next');
        if (!next) {
            console.error('❌ --next is required when cancelling a task (handoff protocol)');
            console.error('Example: macs cancel T-001 --reason "out of scope" --next "revisit in Phase 3"');
            process.exit(1);
        }
        const parts = [];
        const done = getArg('--done');
        const issue = getArg('--issue');
        const question = getArg('--question');
        if (done)
            parts.push(`✓ ${done}`);
        parts.push(`→ ${next}`);
        if (issue)
            parts.push(`⚠ ${issue}`);
        if (question)
            parts.push(`? ${question}`);
        const handoff_note = parts.join('\n');
        engine.cancelTask(agentId, taskId, { reason, handoff_note });
        autoGenerate();
        console.log(`🗑  ${taskId} cancelled: ${reason}`);
        console.log(`\nHandoff note saved:`);
        for (const line of parts)
            console.log(`  ${line}`);
        break;
    }
    case 'checkpoint': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        if (!taskId) {
            console.error('Usage: macs checkpoint <task-id> --agent <id> --note "✓ done → next"');
            process.exit(1);
        }
        const note = getArg('--note');
        if (!note) {
            console.error('❌ --note is required');
            console.error('Format: --note "✓ what done → what next ⚠ issues ? questions"');
            process.exit(1);
        }
        const progress = getArg('--progress') ? parseFloat(getArg('--progress')) : undefined;
        engine.addCheckpoint(agentId, taskId, { note, progress });
        const pct = progress !== undefined ? ` (${Math.round(progress * 100)}%)` : '';
        console.log(`✅ Checkpoint recorded for ${taskId}${pct}`);
        console.log(`   ${note}`);
        break;
    }
    case 'drift': {
        const thresholdMin = parseInt(getArg('--threshold') || '30', 10);
        const thresholdMs = thresholdMin * 60 * 1000;
        const drifting = engine.getDrift(thresholdMs);
        console.log(`\n🌀 Drift Report (threshold: ${thresholdMin} min)`);
        console.log(`${'─'.repeat(50)}`);
        if (drifting.length === 0) {
            console.log('  ✅ No drifting tasks detected.');
        }
        else {
            for (const { task, silentMs, level } of drifting) {
                const silentMin = Math.round(silentMs / 60000);
                const icon = level === 'confirmed' ? '🔴' : '🟡';
                console.log(`${icon} ${task.id} ${task.title} [${level}] — silent ${silentMin} min`);
                console.log(`   owner: ${task.assignee || 'unassigned'}`);
                if (task.last_checkpoint_at) {
                    console.log(`   last checkpoint: ${timeAgo(task.last_checkpoint_at)}`);
                }
                else {
                    console.log(`   no checkpoint recorded`);
                }
                if (level === 'confirmed') {
                    console.log(`   ⚠ Consider: macs block ${task.id} --reason "drift" --next "investigate or reassign"`);
                }
            }
        }
        console.log('');
        break;
    }
    case 'decompose': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        if (!taskId) {
            console.error('Usage: macs decompose <task-id> --into "subtask1,subtask2"');
            process.exit(1);
        }
        const into = getArg('--into');
        if (!into) {
            console.error('--into "subtask1,subtask2" is required');
            process.exit(1);
        }
        const subtaskTitles = into.split(',').map(s => s.trim()).filter(Boolean);
        if (subtaskTitles.length < 2) {
            console.error('At least 2 subtasks required');
            process.exit(1);
        }
        const rationale = getArg('--rationale');
        const subtasks = engine.decomposeTask(agentId, taskId, subtaskTitles, rationale);
        autoGenerate();
        console.log(`✅ ${taskId} decomposed into ${subtasks.length} subtasks (status: waiting_for_subtasks)`);
        for (const sub of subtasks) {
            console.log(`   ${sub.id}: ${sub.title}`);
        }
        console.log(`\nParent auto-completes when all subtasks done.`);
        console.log(`Run \`macs claim --agent <id>\` to assign subtasks.`);
        break;
    }
    case 'unblock': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        const decision = getArg('--decision');
        if (!taskId) {
            console.error('Usage: macs unblock <task-id>');
            process.exit(1);
        }
        engine.unblockTask(agentId, taskId, { decision });
        autoGenerate();
        console.log(`✅ ${taskId} unblocked${decision ? `: ${decision}` : ''}`);
        break;
    }
    case 'register': {
        const agentId = args[1];
        if (!agentId) {
            console.error('Usage: macs register <agent-id> --capabilities backend,testing');
            process.exit(1);
        }
        const capabilities = getArg('--capabilities')?.split(',') || [];
        const model = getArg('--model');
        const role = getArg('--role');
        engine.registerAgent(agentId, { capabilities, model, role });
        autoGenerate();
        console.log(`✅ Agent registered: ${agentId} (${capabilities.join(', ')})`);
        break;
    }
    case 'log': {
        const limit = parseInt(getArg('--limit') || '20', 10);
        const taskEvents = engine.getTaskEvents();
        const globalEvents = engine.getGlobalEvents();
        // Merge and sort by timestamp
        const all = [
            ...taskEvents.map(e => ({ ...e, source: 'task' })),
            ...globalEvents.map(e => ({ ...e, source: 'global' })),
        ].sort((a, b) => a.ts.localeCompare(b.ts));
        const recent = all.slice(-limit);
        console.log(`\n📜 Event Log (last ${recent.length})`);
        console.log(`${'─'.repeat(60)}`);
        for (const event of recent) {
            const time = event.ts.split('T')[1]?.slice(0, 8) || '';
            const id = ('id' in event) ? ` ${event.id}` : '';
            const task = ('task' in event && event.task) ? ` (${event.task})` : '';
            console.log(`  ${time} [${event.type}]${id}${task} — by ${event.by}`);
        }
        console.log('');
        break;
    }
    case 'impact': {
        const file = args[1];
        if (!file) {
            console.error('Usage: macs impact <file-path>');
            process.exit(1);
        }
        const result = engine.analyzeImpact(file);
        console.log(`\n🎯 Impact Analysis: ${file}`);
        console.log(`${'─'.repeat(50)}`);
        if (result.affected_tasks.length === 0 && result.affected_agents.length === 0) {
            console.log('  No known impact.');
        }
        else {
            if (result.affected_tasks.length > 0) {
                console.log(`\n  Affected tasks:`);
                for (const t of result.affected_tasks) {
                    console.log(`    ${t.id} ${t.title} (${t.status}, owner: ${t.assignee || 'none'})`);
                }
            }
            if (result.affected_agents.length > 0) {
                console.log(`\n  Affected agents: ${result.affected_agents.join(', ')}`);
            }
        }
        console.log('');
        break;
    }
    case 'inbox': {
        const agentId = args[1];
        if (!agentId) {
            console.error('Usage: macs inbox <agent-id>');
            process.exit(1);
        }
        const unreadOnly = hasFlag('--unread');
        const messages = engine.getInbox(agentId, unreadOnly);
        console.log(`\n📬 Inbox: ${agentId} (${messages.length} messages${unreadOnly ? ', unread only' : ''})`);
        console.log(`${'─'.repeat(50)}`);
        for (const msg of messages) {
            const readIcon = msg.read ? '  ' : '🔵';
            console.log(`${readIcon} ${msg.id} from ${msg.from} [${msg.type}] ${msg.ts.split('T')[1]?.slice(0, 8)}`);
            if (msg.re)
                console.log(`   re: ${msg.re}`);
        }
        console.log('');
        break;
    }
    case 'send': {
        const from = args[1];
        const to = args[2];
        const content = args[3];
        if (!from || !to || !content) {
            console.error('Usage: macs send <from> <to> <message>');
            process.exit(1);
        }
        const type = (getArg('--type') || 'general');
        const re = getArg('--re');
        const msg = engine.sendMessage({ from, to, type, re, data: { content } });
        console.log(`✅ Message sent: ${msg.id} (${from} → ${to})`);
        break;
    }
    case 'boot': {
        const agentId = getArg('--agent');
        if (!agentId) {
            console.error('Usage: macs boot --agent <id> [--capabilities backend,testing] [--model sonnet]');
            process.exit(1);
        }
        let state = engine.getState();
        // Auto-register if not seen before
        if (!state.agents[agentId]) {
            const capabilities = getArg('--capabilities')?.split(',') || [];
            const model = getArg('--model');
            engine.registerAgent(agentId, { capabilities, model });
            state = engine.getState();
        }
        const agent = state.agents[agentId];
        const lastHeartbeatMs = new Date(agent.last_heartbeat).getTime();
        const isFirstSession = agent.last_heartbeat === agent.registered_at;
        // Record heartbeat for this session
        engine.heartbeat(agentId, { status: 'idle' });
        // Find last completed task by this agent
        const taskEvents = engine.getTaskEvents();
        const globalEvents = engine.getGlobalEvents();
        const myLastCompleted = [...taskEvents]
            .reverse()
            .find(e => e.type === 'task_completed' && e.by === agentId);
        const lastCompletedTask = myLastCompleted ? state.tasks[myLastCompleted.id] : null;
        // Breaking changes since last heartbeat
        const recentBreaking = globalEvents.filter(e => e.type === 'breaking_change' &&
            new Date(e.ts).getTime() > lastHeartbeatMs);
        // Newly unblocked tasks: pending tasks whose deps were completed after last heartbeat
        const allTasks = Object.values(state.tasks);
        const newlyUnblocked = allTasks.filter(t => {
            if (t.status !== 'pending' || t.depends.length === 0)
                return false;
            const allDepsCompleted = t.depends.every(depId => state.tasks[depId]?.status === 'completed');
            if (!allDepsCompleted)
                return false;
            return t.depends.some(depId => {
                const depDoneEvent = [...taskEvents]
                    .reverse()
                    .find(e => e.type === 'task_completed' && e.id === depId);
                return depDoneEvent && new Date(depDoneEvent.ts).getTime() > lastHeartbeatMs;
            });
        });
        // Unread inbox messages
        const unread = engine.getInbox(agentId, true);
        // Recommended next task: pending + unblocked, sorted by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const available = allTasks
            .filter(t => {
            if (t.status !== 'pending')
                return false;
            return t.depends.every(depId => state.tasks[depId]?.status === 'completed');
        })
            .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        const recommended = available[0];
        const myInProgress = allTasks.find(t => t.assignee === agentId && t.status === 'in_progress');
        // --- Output ---
        const caps = agent.capabilities?.join(', ') || '未声明';
        console.log(`\n你是 ${agentId} (${caps})`);
        if (isFirstSession) {
            console.log('首次会话，初始化完成');
        }
        else if (lastCompletedTask) {
            console.log(`上次会话：${timeAgo(agent.last_heartbeat)}，完成了 ${lastCompletedTask.id} (${lastCompletedTask.title})`);
        }
        else {
            console.log(`上次会话：${timeAgo(agent.last_heartbeat)}`);
        }
        const changes = [];
        for (const msg of unread) {
            changes.push(`📬 ${msg.from} 发来消息 [${msg.type}]`);
        }
        for (const e of recentBreaking) {
            const file = e.data?.file || e.data?.path || '未知文件';
            changes.push(`⚠️  ${e.by} 做了 breaking change: ${file}`);
        }
        for (const t of newlyUnblocked) {
            changes.push(`🔓 ${t.id} 的依赖 ${t.depends.join(', ')} 已完成，可以开始了`);
        }
        if (changes.length > 0) {
            console.log('\n变化提醒（与你有关）：');
            for (const c of changes)
                console.log(`  ${c}`);
        }
        if (myInProgress) {
            console.log(`\n当前任务：${myInProgress.id} (${myInProgress.title}) — 进行中`);
            if (myInProgress.goal_chain?.length) {
                console.log(`目标链：${myInProgress.goal_chain.join(' → ')}`);
            }
            console.log(`完成后运行：\`macs done ${myInProgress.id} --agent ${agentId}\``);
        }
        else if (recommended) {
            console.log(`\n推荐下一步：认领 ${recommended.id} (${recommended.title}) [${recommended.priority}]`);
            if (recommended.goal_chain?.length) {
                console.log(`目标链：${recommended.goal_chain.join(' → ')}`);
            }
            if (recommended.parent_task) {
                console.log(`父任务：${recommended.parent_task}`);
            }
            if (recommended.handoff_note) {
                console.log(`\n上一个 agent 的 handoff：`);
                for (const line of recommended.handoff_note.split('\n'))
                    console.log(`  ${line}`);
            }
            console.log(`\n运行 \`macs claim ${recommended.id} --agent ${agentId}\` 开始`);
        }
        else {
            console.log('\n当前没有可认领的任务，等待新任务分配。');
        }
        console.log('');
        break;
    }
    case 'swarm': {
        const agentSpec = getArg('--agents');
        if (!agentSpec) {
            console.error('Usage: macs swarm --agents "name[:caps]|..." [--simulate] [--delay 800]');
            console.error('       macs swarm --agents N [--capabilities cap1,cap2] [--simulate]');
            process.exit(1);
        }
        const isSimulate = hasFlag('--simulate');
        const delayMs = parseInt(getArg('--delay') || '800', 10);
        // Parse agent spec: number OR "name:cap1,cap2|name:cap1,cap2"
        const agentCount = parseInt(agentSpec, 10);
        let agentDefs;
        if (!isNaN(agentCount) && agentCount > 0) {
            const caps = getArg('--capabilities')?.split(',').map(c => c.trim()).filter(Boolean) || [];
            agentDefs = Array.from({ length: agentCount }, (_, i) => ({
                name: `swarm-${i + 1}`,
                capabilities: caps,
            }));
        }
        else {
            agentDefs = agentSpec.split('|').map(s => {
                const colonIdx = s.indexOf(':');
                if (colonIdx === -1)
                    return { name: s.trim(), capabilities: [] };
                return {
                    name: s.slice(0, colonIdx).trim(),
                    capabilities: s.slice(colonIdx + 1).split(',').map(c => c.trim()).filter(Boolean),
                };
            }).filter(a => a.name);
        }
        if (agentDefs.length === 0) {
            console.error('❌ No valid agents specified');
            process.exit(1);
        }
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        (async () => {
            console.log(`\n🐝 MACS Swarm — ${agentDefs.length} agent(s)${isSimulate ? ' [simulate]' : ''}`);
            console.log('─'.repeat(50));
            // Register agents (skip if already registered)
            const existingState = engine.getState();
            for (const { name, capabilities } of agentDefs) {
                if (!existingState.agents[name]) {
                    engine.registerAgent(name, { capabilities });
                }
            }
            for (const { name, capabilities } of agentDefs) {
                console.log(`  🤖 ${name}${capabilities.length ? ` (${capabilities.join(', ')})` : ''}`);
            }
            // Check project has tasks
            const initialState = engine.getState();
            const m0 = initialState.metrics;
            if (m0.total_tasks === 0) {
                console.log('\n⚠️  No tasks in project. Create tasks first:');
                console.log('   macs create "Task title" --priority high');
                return;
            }
            console.log(`\nProject: ${m0.total_tasks} tasks | ${m0.completed} done | ${m0.pending} pending | ${m0.in_progress} in-progress`);
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (isSimulate) {
                // ── Simulation Mode ─────────────────────────────────────────
                console.log(`\nSimulating task execution (${delayMs}ms per round)...\n`);
                let round = 0;
                let totalCompleted = 0;
                while (true) {
                    // Capability-aware: each agent picks from tasks it can do
                    const batch = [];
                    const assignedThisRound = new Set();
                    for (const { name } of agentDefs) {
                        const available = engine.findTasks({
                            status: 'pending', assignee: null, unblocked: true, capable_agent: name,
                        }).filter(t => !assignedThisRound.has(t.id));
                        if (available.length === 0)
                            continue;
                        available.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
                        const task = available[0];
                        assignedThisRound.add(task.id);
                        engine.claimTask(name, task.id);
                        engine.startTask(name, task.id);
                        batch.push({ agent: name, taskId: task.id });
                    }
                    if (batch.length === 0)
                        break;
                    round++;
                    console.log(`▶ Round ${round}`);
                    for (const { agent, taskId } of batch) {
                        const task = engine.getState().tasks[taskId];
                        console.log(`  🔄 ${agent.padEnd(14)} → ${taskId}: ${task?.title || taskId} [${task?.priority || '?'}]`);
                    }
                    await sleep(delayMs);
                    for (const { agent, taskId } of batch) {
                        engine.completeTask(agent, taskId, { summary: 'swarm-simulated', artifacts: [] });
                        totalCompleted++;
                        console.log(`  ✅ ${agent.padEnd(14)} ← ${taskId} done`);
                        const parent = engine.getState().tasks[engine.getState().tasks[taskId]?.parent_task || ''];
                        if (parent?.status === 'completed') {
                            console.log(`     🧩 ${parent.id} (parent) auto-completed`);
                        }
                    }
                    console.log('');
                }
                const finalState = engine.getState();
                const m = finalState.metrics;
                console.log('─'.repeat(50));
                console.log(`🏁 Swarm simulation complete!`);
                console.log(`   ${m.completed}/${m.total_tasks} tasks done | ${round} round(s) | ${agentDefs.length} agent(s)`);
                if (m.blocked > 0)
                    console.log(`   ⚠️  ${m.blocked} blocked (need manual intervention)`);
                if (m.pending > 0)
                    console.log(`   ⏳ ${m.pending} pending (unsatisfied dependencies?)`);
                console.log(`   Events: .macs/protocol/tasks.jsonl`);
                console.log('');
                autoGenerate();
            }
            else {
                // ── Real Mode: assign available tasks, print boot instructions ──
                console.log('\n📋 Auto-assigning available tasks...');
                const available = engine.findTasks({ status: 'pending', assignee: null, unblocked: true });
                available.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
                let taskIdx = 0;
                for (const { name } of agentDefs) {
                    if (taskIdx >= available.length)
                        break;
                    const task = available[taskIdx++];
                    engine.claimTask(name, task.id);
                    console.log(`  ${name.padEnd(14)} → ${task.id}: ${task.title} [${task.priority}]`);
                }
                if (available.length === 0) {
                    console.log('  (no tasks available right now — check macs status for dependencies)');
                }
                console.log('\n▶ Start each agent session:');
                for (const { name } of agentDefs) {
                    console.log(`  macs boot --agent ${name}`);
                }
                console.log('');
                autoGenerate();
            }
        })();
        break;
    }
    case 'review': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        const result = getArg('--result');
        if (!taskId) {
            console.error('Usage: macs review <task-id> --agent <id> --result approve|reject [--note "..."]');
            process.exit(1);
        }
        if (!result || (result !== 'approved' && result !== 'rejected')) {
            console.error('❌ --result must be "approved" or "rejected"');
            process.exit(1);
        }
        const note = getArg('--note');
        engine.submitReview(agentId, taskId, { result, note });
        autoGenerate();
        const icon = result === 'approved' ? '✅' : '❌';
        console.log(`${icon} ${agentId} reviewed ${taskId}: ${result}${note ? ` — ${note}` : ''}`);
        if (result === 'approved') {
            console.log(`   Task marked completed.`);
        }
        else {
            console.log(`   Task returned to in_progress for rework.`);
        }
        break;
    }
    case 'escalate': {
        const taskId = args[1];
        const agentId = getArg('--agent') || 'cli';
        const reason = getArg('--reason');
        if (!taskId) {
            console.error('Usage: macs escalate <task-id> --reason "..." [--to human-id] [--timeout 60]');
            process.exit(1);
        }
        if (!reason) {
            console.error('❌ --reason is required for escalation');
            process.exit(1);
        }
        const escalate_to = getArg('--to');
        const timeoutMin = parseInt(getArg('--timeout') || '0', 10);
        const timeout_ms = timeoutMin > 0 ? timeoutMin * 60 * 1000 : undefined;
        engine.escalateTask(agentId, taskId, { reason, escalate_to, timeout_ms });
        autoGenerate();
        console.log(`🆘 ${taskId} escalated to human`);
        console.log(`   reason: ${reason}`);
        if (escalate_to)
            console.log(`   escalated to: ${escalate_to}`);
        if (timeout_ms)
            console.log(`   auto-resume after: ${timeoutMin} min`);
        break;
    }
    case 'reap': {
        const thresholdMin = parseInt(getArg('--threshold') || '45', 10);
        const thresholdMs = thresholdMin * 60 * 1000;
        const reaped = engine.reapDeadAgents(thresholdMs);
        console.log(`\n💀 Dead Agent Reaper (threshold: ${thresholdMin} min silent)`);
        console.log(`${'─'.repeat(50)}`);
        if (reaped.length === 0) {
            console.log('  ✅ No dead agents found.');
        }
        else {
            for (const { agentId, reassigned } of reaped) {
                console.log(`💀 ${agentId} — marked dead, ${reassigned.length} task(s) reassigned`);
                for (const taskId of reassigned) {
                    console.log(`   ↩ ${taskId} → pending`);
                }
            }
            autoGenerate();
        }
        console.log('');
        break;
    }
    case 'workload': {
        // 3.2: Show agent workload distribution
        const state = engine.getState();
        const workload = engine.getAgentWorkload();
        const agents = Object.values(state.agents);
        console.log(`\n⚖️  Agent Workload`);
        console.log(`${'─'.repeat(50)}`);
        if (agents.length === 0) {
            console.log('  No agents registered.');
        }
        else {
            const sorted = agents.sort((a, b) => (workload[b.id] ?? 0) - (workload[a.id] ?? 0));
            for (const agent of sorted) {
                const load = workload[agent.id] ?? 0;
                const bar = '█'.repeat(Math.min(load, 10)) + '░'.repeat(Math.max(0, 3 - load));
                const statusIcon = agent.status === 'idle' ? '🟢' : agent.status === 'dead' ? '💀' : '🔵';
                const caps = agent.capabilities.length > 0 ? ` [${agent.capabilities.join(', ')}]` : '';
                console.log(`${statusIcon} ${agent.id.padEnd(24)} ${bar} ${load} active${caps}`);
            }
            const totalLoad = Object.values(workload).reduce((s, n) => s + n, 0);
            const idleCount = agents.filter(a => a.status === 'idle').length;
            console.log(`\n  Total active tasks: ${totalLoad} | Idle agents: ${idleCount}/${agents.length}`);
        }
        console.log('');
        break;
    }
    case 'smart-drift': {
        // 3.13: Smart drift analysis (spinning + direction drift)
        const analysis = engine.analyzeSmartDrift();
        console.log(`\n🧠 Smart Drift Analysis`);
        console.log(`${'─'.repeat(50)}`);
        if (analysis.length === 0) {
            console.log('  ✅ No suspicious patterns detected.');
        }
        else {
            for (const { taskId, task, type, details, recommended_action } of analysis) {
                const icon = type === 'both' ? '🔴' : type === 'spinning' ? '🌀' : '🧭';
                console.log(`${icon} ${taskId} "${task.title}" [${type}]`);
                console.log(`   owner: ${task.assignee || 'unassigned'}`);
                if (details.spinning) {
                    console.log(`   🌀 Spinning files:`);
                    for (const { file, count } of details.spinning) {
                        console.log(`      ${file} — modified ${count}x`);
                    }
                }
                if (details.direction_drift) {
                    console.log(`   🧭 Direction drift:`);
                    for (const { artifact, reason } of details.direction_drift) {
                        console.log(`      ${artifact}`);
                        console.log(`        → ${reason}`);
                    }
                }
                console.log(`   💡 ${recommended_action}`);
                console.log('');
            }
        }
        console.log('');
        break;
    }
    case 'generate': {
        generator.generate();
        console.log('✅ human/ directory updated (TASK.md, CHANGELOG.md, STATUS.md)');
        break;
    }
    case 'ci': {
        // 4.5: CI/CD consistency check
        const staleHours = getArg('--stale-hours') ? parseInt(getArg('--stale-hours'), 10) : 2;
        const jsonOutput = hasFlag('--json');
        const result = engine.ciCheck({ staleHours });
        if (jsonOutput) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            const statusIcon = result.ok ? '✅' : '❌';
            console.log(`\n${statusIcon} MACS CI Check — ${result.summary}\n`);
            if (result.errors.length > 0) {
                console.log('Errors (must fix):');
                for (const issue of result.errors) {
                    console.log(`  ❌ [${issue.type}] ${issue.message}`);
                }
                console.log('');
            }
            if (result.warnings.length > 0) {
                console.log('Warnings:');
                for (const issue of result.warnings) {
                    console.log(`  ⚠️  [${issue.type}] ${issue.message}`);
                }
                console.log('');
            }
            if (result.ok && result.warnings.length === 0) {
                console.log('  All checks passed. No issues found.');
            }
        }
        if (!result.ok)
            process.exit(1);
        break;
    }
    case 'template': {
        // 4.4: Template market
        const subCmd = args[1];
        const templates = MACSEngine.getTemplates();
        if (!subCmd || subCmd === 'list') {
            console.log('\nMACS Template Market\n');
            for (const [key, tmpl] of Object.entries(templates)) {
                const taskCount = tmpl.tasks.length;
                const tags = tmpl.tags.join(', ');
                console.log(`  ${key.padEnd(16)} ${tmpl.name.padEnd(20)} ${taskCount} tasks  [${tags}]`);
                console.log(`                   ${tmpl.description}`);
                console.log('');
            }
            console.log('Usage: macs template use <name> --agent <id>');
        }
        else if (subCmd === 'use') {
            const templateName = args[2];
            const agentId = getArg('--agent') || 'system';
            if (!templateName) {
                console.error('Usage: macs template use <name> --agent <id>');
                process.exit(1);
            }
            try {
                const { taskIds, count } = engine.applyTemplate(templateName, agentId);
                const tmpl = templates[templateName];
                autoGenerate();
                console.log(`\n✅ Template "${tmpl.name}" applied — ${count} tasks created:\n`);
                for (const id of taskIds) {
                    const state = engine.getState();
                    const task = state.tasks[id];
                    const deps = task.depends.length > 0 ? ` (depends: ${task.depends.join(', ')})` : '';
                    const caps = task.requires_capabilities?.length ? ` [needs: ${task.requires_capabilities.join(', ')}]` : '';
                    console.log(`  ${id}  ${task.title}${deps}${caps}`);
                }
                console.log(`\nNext: macs swarm --agents 4 --simulate`);
            }
            catch (err) {
                console.error(`❌ ${err.message}`);
                process.exit(1);
            }
        }
        else if (subCmd === 'info') {
            const templateName = args[2];
            if (!templateName || !templates[templateName]) {
                console.error(`Template "${templateName}" not found. Run: macs template list`);
                process.exit(1);
            }
            const tmpl = templates[templateName];
            console.log(`\n${tmpl.name} — ${tmpl.description}\n`);
            console.log(`Tasks (${tmpl.tasks.length}):`);
            for (const t of tmpl.tasks) {
                const deps = t.depends_on?.length ? ` → depends: ${t.depends_on.join(', ')}` : '';
                const caps = t.requires_capabilities?.length ? ` [${t.requires_capabilities.join('/')}]` : '';
                const hrs = t.estimate_ms ? ` ~${Math.round(t.estimate_ms / 3600000)}h` : '';
                console.log(`  ${(t.priority || 'medium').padEnd(8)} ${t.title}${caps}${hrs}${deps}`);
            }
        }
        else {
            console.error(`Unknown subcommand: macs template ${subCmd}`);
            console.error('Usage: macs template [list|use <name>|info <name>]');
            process.exit(1);
        }
        break;
    }
    default: {
        console.log(`
MACS Protocol v4.0 — Git for AI Agents

Usage:
  macs boot --agent <id> [flags]            ★ Session start: catch up + get next task
  macs swarm --agents N [--simulate]        ★ Launch N agents, auto-distribute tasks
  macs init [name]                          Initialize MACS in current project
  macs status                               Show project status
  macs create <title> [flags]               Create a task (--requires cap1,cap2 for 3.1)
  macs claim [task-id] --agent <id>         Claim a task (capability-filtered)
  macs start <task-id>                      Start working on a task
  macs done <task-id>                       Complete a task
  macs block <task-id> --reason "." --next "."   Block a task (handoff required)
  macs cancel <task-id> --reason "." --next "."  Cancel a task (handoff required)
  macs unblock <task-id>                         Unblock a task
  macs checkpoint <task-id> --note "✓→⚠?"       Record progress checkpoint
  macs drift [--threshold 30]                    Show drifting tasks (default 30 min)
  macs smart-drift                               Smart drift analysis: spinning + direction drift (3.13)
  macs workload                                  Show agent workload distribution (3.2)
  macs decompose <task-id> --into "a,b,c"        Decompose task into subtasks
  macs review <task-id> --result approve|reject  Peer review a task (3.10)
  macs escalate <task-id> --reason "..."         Escalate to human (3.11)
  macs reap [--threshold 45]                     Reap dead agents (3.12)
  macs register <agent-id> [flags]          Register an agent
  macs log [--limit N]                      View event log
  macs impact <file>                        Analyze change impact
  macs inbox <agent-id>                     Check agent inbox
  macs send <from> <to> <msg>               Send a message
  macs generate                             Regenerate human/ Markdown
  macs ci [--stale-hours N] [--json]        CI/CD consistency check (4.5)
  macs template [list|use <name>|info <name>]  Project templates (4.4)

Swarm examples:
  macs swarm --agents 4 --simulate                         4 auto-named agents
  macs swarm --agents "opus:planner|sonnet:backend|haiku:qa" --simulate
  macs swarm --agents 3 --capabilities backend,testing     real agents (no simulate)

Template examples:
  macs template list                        List available templates
  macs template use saas-mvp --agent lead   Apply SaaS MVP template (8 tasks)
  macs template use api-service --agent pm  Apply API service template
  macs template info data-pipeline          Show template details
`);
        break;
    }
}
