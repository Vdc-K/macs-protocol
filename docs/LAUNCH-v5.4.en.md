[中文版](LAUNCH-v5.4.md)

# MACS v5.4: A 9B Local Model Unblocked Claude Opus

> 2026-03-17 | macs-protocol v5.4.0 | [GitHub](https://github.com/Vdc-K/macs-protocol) | [npm](https://www.npmjs.com/package/macs-protocol)

---

## In One Line

**4 AI Agents, 3 different providers, 1 shared workbench — a 9B model running on a laptop made the critical decision that let Claude Opus finish a blocked task.**

## Background

Every AI coding agent has its own turf. Claude Code has Agent Teams, Codex has its own context, Cursor has Composer. But none of them can see what the others are doing.

MACS gives them a shared workbench: the `.macs/` directory. Any agent that can read and write files can join — no server required, no shared framework required.

## What We Did

We ran 4 agents on a real feature task (adding version numbers to the Skill system):

| Agent | Model | Provider | Role |
|-------|-------|----------|------|
| cc-opus | Claude Opus 4.6 | Anthropic | Lead development |
| cc-sonnet | Claude Sonnet 4.6 | Anthropic | Frontend implementation |
| codex | GPT 5.4 | OpenAI | Testing + review |
| omnicoder | OmniCoder 9B | Local Ollama | Design decisions |

The critical moment: cc-opus hit 40% completion and got blocked on a format decision (semver vs semver+date vs changelog link). It marked the task as blocked.

OmniCoder — a 9B open-source model running on an M4 Max laptop — read the MACS state, analyzed all three options, chose semver, and cleared the blockage. **Then Claude Opus picked up right where it left off.**

## What We Found

3 bugs that only surface in real cross-agent collaboration:

1. **Unblock doesn't transfer ownership** — Agent B cleared the blockage, but the task stayed under Agent A's name; B couldn't take over
2. **Checkpoint doesn't validate owner** — any agent could modify another agent's task progress, breaking the ownership model
3. **Contribution stats only count completions** — OmniCoder made the critical decision, but the stats showed `tasks_done: 0`

**All three fixed and shipped as v5.4.0 the same day.**

## Why This Matters

> Models don't need to be the same size, come from the same provider, or even run in the cloud. They just need to read and write the same `.macs/` directory.

That's the value of MACS — not another agent framework, but a way for agents across different frameworks to see the same shared work state.

## Quick Start

```bash
npm install -g macs-protocol
macs init "My Project"
macs add "First task" --priority high
macs boot --agent my-agent --capabilities backend --model any
```

Within 5 minutes, your first agent is live inside `.macs/`. Run `macs boot` from an agent in a completely different framework, and it instantly sees everything that came before.

## The Numbers

- **4** agents registered
- **3** providers (Anthropic, OpenAI, local Ollama)
- **3** bugs found and fixed
- **1** critical decision made by a 9B local model
- **0** lines of custom coordination code between agents

## Links

- GitHub: [github.com/Vdc-K/macs-protocol](https://github.com/Vdc-K/macs-protocol)
- npm: `npm install -g macs-protocol`
- Full dogfood report: [DOGFOOD-REPORT.md](https://github.com/Vdc-K/macs-protocol/blob/main/DOGFOOD-REPORT.md)
- MIT license, free to use

---

*MACS — The Universal Workbench for AI Agents*
