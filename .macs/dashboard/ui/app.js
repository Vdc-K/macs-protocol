// MACS Dashboard v2 — app.js
'use strict'

let data = null
let taskFilter = 'all'
let replayIdx = 0
let replayEvents = []
let simTimer = null

// ── SSE real-time connection ────────────────────────────────────────────────
function connectSSE() {
  const dot = document.getElementById('live-dot')
  const es = new EventSource('/api/stream')

  es.addEventListener('update', e => {
    data = JSON.parse(e.data)
    render()
    dot.classList.add('connected')
    document.getElementById('updated-at').textContent =
      'Updated ' + new Date().toLocaleTimeString()
  })

  es.onerror = () => {
    dot.classList.remove('connected')
    dot.title = 'Reconnecting…'
  }
}

// ── Main render ─────────────────────────────────────────────────────────────
function render() {
  if (!data) return
  renderHeader()
  renderStats()
  renderDriftAlerts()
  renderAgents()
  renderTaskTable()
  renderDepGraph()
  renderReplay()
  renderFileHeatmap()
  renderCompletionsChart()
}

function renderHeader() {
  document.getElementById('project-name').textContent = data.project
  document.title = `MACS · ${data.project}`
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
  const s = data.stats
  document.getElementById('s-total').textContent  = s.totalTasks
  document.getElementById('s-done').textContent   = s.completed
  document.getElementById('s-active').textContent = s.inProgress
  document.getElementById('s-pending').textContent= s.pending
  document.getElementById('s-blocked').textContent= s.blocked
  document.getElementById('s-review').textContent = s.reviewRequired
  document.getElementById('s-human').textContent  = s.pendingHuman
  document.getElementById('s-agents').textContent =
    `${s.idleAgents}/${s.totalAgents}`
}

// ── Drift alerts ───────────────────────────────────────────────────────────
function renderDriftAlerts() {
  const panel = document.getElementById('drift-panel')
  const list  = document.getElementById('drift-list')
  if (!data.driftAlerts.length) { panel.style.display = 'none'; return }
  panel.style.display = 'block'
  list.innerHTML = data.driftAlerts.map(a => `
    <div class="drift-alert">
      <h4>🌀 ${a.taskId} "${a.title}" — ${a.type}</h4>
      <p>💡 ${a.recommended_action}</p>
      ${(a.spinningFiles || []).map(f =>
        `<p style="font-size:11px;color:var(--muted);margin-top:4px">→ ${f.file} (×${f.count})</p>`
      ).join('')}
    </div>
  `).join('')
}

// ── Agents ─────────────────────────────────────────────────────────────────
function renderAgents() {
  const maxLoad = Math.max(1, ...data.agents.map(a => a.activeTasks))
  document.getElementById('agent-list').innerHTML = data.agents.length
    ? data.agents.map(a => `
      <div class="agent-row">
        <div class="agent-status ${a.status}"></div>
        <div class="agent-name">${a.id}</div>
        <div class="agent-caps">${a.capabilities.join(', ') || '—'}</div>
        <div class="agent-bar-wrap">
          <div class="agent-bar-fill" style="width:${(a.activeTasks/maxLoad)*100}%"></div>
        </div>
        <div class="agent-load">${a.activeTasks} active · ${a.completedTasks} done</div>
      </div>`).join('')
    : '<p style="color:var(--muted);font-size:13px">No agents registered.</p>'
}

// ── Task table ─────────────────────────────────────────────────────────────
function renderTaskTable() {
  const filtered = taskFilter === 'all'
    ? data.tasks
    : data.tasks.filter(t => t.status === taskFilter)

  document.getElementById('task-table').innerHTML = `
    <div class="task-table-inner">
      <table>
        <thead><tr>
          <th>ID</th><th>Title</th><th>Status</th>
          <th>Priority</th><th>Assignee</th><th>Deps</th>
        </tr></thead>
        <tbody>
          ${filtered.map(t => `
            <tr>
              <td><span class="task-id">${t.id}</span></td>
              <td>${t.title}${t.driftSuspected ? ' <span class="drift-flag">🌀</span>':''}</td>
              <td><span class="status-badge s-${t.status}">${t.status.replace(/_/g,' ')}</span></td>
              <td><span class="p-${t.priority}">${t.priority}</span></td>
              <td style="color:var(--muted);font-size:12px">${t.assignee || '—'}</td>
              <td style="color:var(--muted);font-size:12px">${t.depends.join(', ') || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    taskFilter = btn.dataset.filter
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    if (data) renderTaskTable()
  })
})

// ── Dependency graph (D3 force) ─────────────────────────────────────────────
let depSim = null

function renderDepGraph() {
  const container = document.getElementById('dep-graph')
  container.innerHTML = ''
  const W = container.clientWidth || 500
  const H = 360

  const nodes = data.tasks.map(t => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority
  }))
  const links = data.dependencyEdges.map(e => ({ source: e.from, target: e.to }))

  if (nodes.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);padding:20px;font-size:13px">No tasks yet.</p>'
    return
  }

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H)

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id','arrow').attr('markerWidth',8).attr('markerHeight',8)
    .attr('refX',16).attr('refY',3).attr('orient','auto')
    .append('path').attr('d','M0,0 L0,6 L8,3 z')
    .attr('fill','#2e3147')

  const statusColor = {
    completed: '#22c55e', in_progress: '#3b82f6', pending: '#8892a4',
    blocked: '#ef4444', review_required: '#f97316', pending_human: '#a855f7',
    cancelled: '#555', waiting_for_subtasks: '#eab308',
  }

  if (depSim) depSim.stop()
  depSim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(24))

  const link = svg.append('g').selectAll('line')
    .data(links).join('line')
    .attr('class','dep-link')

  const node = svg.append('g').selectAll('g')
    .data(nodes).join('g').attr('class','dep-node')
    .call(d3.drag()
      .on('start', (event, d) => { if (!event.active) depSim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y })
      .on('drag',  (event, d) => { d.fx=event.x; d.fy=event.y })
      .on('end',   (event, d) => { if (!event.active) depSim.alphaTarget(0); d.fx=null; d.fy=null })
    )

  node.append('circle').attr('r', 14)
    .attr('fill', d => statusColor[d.status] ?? '#555')
    .attr('opacity', 0.85)

  node.append('text').text(d => d.id)
    .attr('dy', '0.35em').attr('text-anchor', 'middle')
    .style('font-size', '10px').style('font-weight', '700')
    .style('fill', '#fff')

  node.append('title').text(d => `${d.id}: ${d.title}\n${d.status}`)

  depSim.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    node.attr('transform', d => `translate(${d.x},${d.y})`)
  })
}

// ── Event replay ────────────────────────────────────────────────────────────
function renderReplay() {
  // rebuild event list (newest first)
  replayEvents = [...(data.eventTimeline || [])].reverse()
  replayIdx = Math.max(0, replayEvents.length - 1)
  renderReplayFrame()
  renderEventList()
}

function renderReplayFrame() {
  const posEl = document.getElementById('replay-pos')
  const evtEl = document.getElementById('replay-event')
  if (!replayEvents.length) {
    posEl.textContent = '0 / 0'
    evtEl.textContent = 'No events yet.'
    return
  }
  const e = replayEvents[replayIdx]
  posEl.textContent = `${replayIdx + 1} / ${replayEvents.length}`
  evtEl.innerHTML = `
    <span style="color:var(--accent);font-family:monospace">#${e.seq}</span>
    <span style="color:var(--muted);margin:0 8px">${fmtTime(e.ts)}</span>
    <span style="color:var(--text)">${e.summary}</span>
    <span style="float:right;font-size:11px;color:var(--muted)">${e.type}</span>`
}

function renderEventList() {
  document.getElementById('event-timeline').innerHTML =
    replayEvents.slice(0, 30).map(e => `
      <div class="evt-item">
        <span class="evt-seq">#${e.seq}</span>
        <span class="evt-time">${fmtTime(e.ts)}</span>
        <span class="evt-type">${e.type}</span>
        <span class="evt-summary">${e.summary}</span>
      </div>`).join('')
}

document.getElementById('replay-start').onclick = () => { replayIdx=0; renderReplayFrame() }
document.getElementById('replay-prev') .onclick = () => { if(replayIdx>0){replayIdx--;renderReplayFrame()} }
document.getElementById('replay-next') .onclick = () => { if(replayIdx<replayEvents.length-1){replayIdx++;renderReplayFrame()} }
document.getElementById('replay-play') .onclick = () => {
  if (simTimer) { clearInterval(simTimer); simTimer=null; document.getElementById('replay-play').textContent='▶'; return }
  document.getElementById('replay-play').textContent='⏸'
  simTimer = setInterval(() => {
    if (replayIdx >= replayEvents.length - 1) {
      clearInterval(simTimer); simTimer=null
      document.getElementById('replay-play').textContent='▶'
    } else { replayIdx++; renderReplayFrame() }
  }, 600)
}

// ── File heatmap ────────────────────────────────────────────────────────────
function renderFileHeatmap() {
  const items = data.fileHeatmap || []
  const max = items[0]?.count || 1
  document.getElementById('file-heatmap').innerHTML = items.length
    ? items.map(f => `
      <div class="heatmap-row">
        <div class="heatmap-file" title="${f.file}">${f.file}</div>
        <div class="heatmap-track">
          <div class="heatmap-fill" style="width:${(f.count/max)*100}%"></div>
        </div>
        <div class="heatmap-count">${f.count}</div>
      </div>`).join('')
    : '<p style="color:var(--muted);font-size:13px">No file_modified events yet.</p>'
}

// ── Completions chart (D3 bar) ──────────────────────────────────────────────
function renderCompletionsChart() {
  const el = document.getElementById('completions-chart')
  el.innerHTML = ''
  const items = data.completionsByDay || []
  if (!items.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px">No completed tasks yet.</p>'
    return
  }

  const W = el.clientWidth || 400, H = 160
  const margin = { top: 16, right: 8, bottom: 32, left: 24 }
  const iw = W - margin.left - margin.right
  const ih = H - margin.top  - margin.bottom

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H)
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const x = d3.scaleBand().domain(items.map(d => d.date)).range([0, iw]).padding(0.3)
  const y = d3.scaleLinear().domain([0, d3.max(items, d => d.count)]).nice().range([ih, 0])

  g.selectAll('.bar-rect').data(items).join('rect')
    .attr('class','bar-rect')
    .attr('x', d => x(d.date)).attr('y', d => y(d.count))
    .attr('width', x.bandwidth()).attr('height', d => ih - y(d.count))

  g.selectAll('.bar-val').data(items).join('text').attr('class','bar-val')
    .attr('x', d => x(d.date) + x.bandwidth()/2).attr('y', d => y(d.count) - 4)
    .attr('text-anchor','middle').text(d => d.count)

  g.append('g').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
    .selectAll('text').attr('class','bar-label')
    .attr('transform','rotate(-30)').style('text-anchor','end')

  g.append('g').call(d3.axisLeft(y).ticks(4))
    .selectAll('text').attr('class','bar-label')
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Boot ────────────────────────────────────────────────────────────────────
connectSSE()
