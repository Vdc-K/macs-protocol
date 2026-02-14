# OpenClaw Multi-Agent Collaboration System (MACS) 🚀

> **From 50k to 5k tokens.** Optimized documentation, hierarchical context, and model routing for the Sovereign Agent Economy.

## 🌟 Why this exists?

In the era of **Agent-First** web, conversation history is a liability. Large context windows lead to **Attention Dilution** (Lost in the Middle) and massive token costs.

**MACS** is a structured methodology and template set designed to:
- ✅ **Reduce Token Usage by 90%+** (Verified by Cloudflare & Vercel benchmarks)
- ✅ **Cut API Costs by 40-77%** via tiered model routing
- ✅ **Preserve "Emergence"** while maintaining extreme efficiency
- ✅ **Enable Seamless Multi-Agent Collaboration**

---

## 🛠️ The Architecture: Hybrid Context Hierarchy

Inspired by `agent-docs` and Cloudflare's `Markdown for Agents`, we split project knowledge into three layers:

### Layer 1: Constitution (Inline / <1k tokens)
*Always in the agent's immediate context.*
- `llms.txt`: Machine-readable navigation index.
- `PROJECT-README.md`: High-level goals and critical constraints.
- `TASK-current.md`: Only the tasks active right now.

### Layer 2: Reference Library (On-Demand / 1k-5k tokens)
*Fetched only when the agent needs specific context.*
- `CHANGELOG.md`: Recent changes (rolling 2-week window).
- `CONTEXT.md`: Design decisions, tech stack, and **Emergence Anchors** (key insights).
- `TASK-planned.md`: Future backlog.

### Layer 3: Cold Archive (Archived / 50k+ tokens)
*Stored in the `archive/` folder or session history.*
- `archive/CHANGELOG-old.md`: Historical logs.
- `archive/TASK-archive-YYYY-MM.md`: Completed tasks.

---

## 🤖 Tiered Model Routing

Don't use a scalpel for gardening. MACS defines a clear delegation strategy:

1. **Gemini Flash** ($0.15/1M): Archive maintenance, document cleanup, status checks.
2. **Claude Sonnet 4.5** ($3/1M): Daily development, planning, code review.
3. **Claude Opus 4.6** ($15/1M): Deep architecture design, complex debugging, creative emergence.

---

## ⚡ Quick Start

1. **Clone this repo** into your project root.
2. **Run the setup script**: `./scripts/setup.sh` (Initializes templates).
3. **Configure Cron**: Set up weekly Sunday cleanup using Gemini Flash.
4. **The Agent Rule**: 
   - Before working: Read `llms.txt` -> `TASK-current.md`.
   - After working: Update `TASK-current.md` + `CHANGELOG.md`.

---

## 💡 Best Practices

- **Agent-First Web**: Always request content with `Accept: text/markdown` headers.
- **Lost in the Middle**: Place critical governing rules at the TOP of documents.
- **Signal-to-Noise**: Strip all HTML/CSS/JS; keep structural Markdown only.
- **Archive Often**: Weekly automated cleanup is mandatory to keep "hot" context under 5k.

---

## 📜 License
MIT © 2026 HHL & AgentClaw (OpenClaw Community)

---

> "It's not about how much context you can fit, it's about how much signal you can find." 🦞
