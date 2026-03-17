# MACS v5.4: 一个 9B 本地模型给 Claude Opus 解了围

> 2026-03-17 | macs-protocol v5.4.0 | [GitHub](https://github.com/Vdc-K/macs-protocol) | [npm](https://www.npmjs.com/package/macs-protocol)

---

## 一句话

**4 个 AI Agent，3 家不同供应商，1 个共享工作台 — 一个跑在笔记本上的 9B 模型做了关键决策，帮 Claude Opus 继续了被阻塞的任务。**

## 背景

每个 AI 编程 Agent 都有自己的地盘。Claude Code 有 Agent Teams，Codex 有自己的上下文，Cursor 有 Composer。但它们看不到彼此在做什么。

MACS 给它们一个共享工作台：`.macs/` 目录。能读写文件的 Agent 就能加入，不需要服务器，不需要同一个框架。

## 我们做了什么

在一个真实的功能任务（给 Skill 系统加版本号）上，我们让 4 个 Agent 协作：

| Agent | 模型 | 供应商 | 参与方式 |
|-------|------|--------|---------|
| cc-opus | Claude Opus 4.6 | Anthropic | 主力开发 |
| cc-sonnet | Claude Sonnet 4.6 | Anthropic | 前端实现 |
| codex | GPT 5.4 | OpenAI | 测试 + 审查 |
| omnicoder | OmniCoder 9B | 本地 Ollama | 设计决策 |

关键时刻：cc-opus 实现到 40% 被一个格式决策阻塞了（semver vs semver+date vs changelog link）。它把任务标记为 blocked。

OmniCoder — 一个跑在 M4 Max 笔记本上的 9B 开源模型 — 读取了 MACS 状态，分析了三个方案，选了 semver，解除了阻塞。**然后 Claude Opus 继续完成了任务。**

## 发现了什么

3 个只有在真实跨 Agent 协作中才会暴露的 bug：

1. **Unblock 不转移所有权** — Agent B 解除了阻塞，但任务还挂在 Agent A 名下，B 无法接手
2. **Checkpoint 不校验 Owner** — 任何 Agent 都能修改别人任务的进度，破坏了所有权模型
3. **贡献统计只看完成数** — OmniCoder 做了关键决策，但统计里显示 `tasks_done: 0`

**当天全部修复，发版 v5.4.0。**

## 为什么这很重要

> 模型不需要一样大，不需要来自同一家供应商，甚至不需要跑在云端。它们只需要读写同一个 `.macs/` 目录。

这就是 MACS 的价值 — 不是又一个 Agent 框架，而是让不同框架的 Agent 能看到同一份工作状态。

## 快速开始

```bash
npm install -g macs-protocol
macs init "My Project"
macs add "First task" --priority high
macs boot --agent my-agent --capabilities backend --model any
```

5 分钟内，你的第一个 Agent 就在 `.macs/` 里了。换一个框架的 Agent 跑 `macs boot`，它就能看到之前所有的状态。

## 数据

- **4** 个 Agent 注册
- **3** 家供应商（Anthropic、OpenAI、本地 Ollama）
- **3** 个 bug 发现并修复
- **1** 个关键决策由 9B 本地模型做出
- **0** 行 Agent 之间的定制协调代码

## 链接

- GitHub: [github.com/Vdc-K/macs-protocol](https://github.com/Vdc-K/macs-protocol)
- npm: `npm install -g macs-protocol`
- Dogfood 完整报告: [DOGFOOD-REPORT.md](https://github.com/Vdc-K/macs-protocol/blob/main/DOGFOOD-REPORT.md)
- MIT 协议，免费使用

---

*MACS — The Universal Workbench for AI Agents*
