[English version](DOGFOOD-REPORT.md)

# MACS Dogfood 报告：4 个 Agent，3 家提供商，1 个共享工作台

> 日期：2026-03-17
> 版本：v5.3.0（dogfood 当天完成修复）

## 实验背景

我们用 4 个来自 3 家不同提供商的 agent，通过临时目录（`/tmp/macs-dogfood/`）中的单个 `.macs/` 工作空间协作完成了一个真实任务。各 agent 依次轮流执行（非并行），仅通过 MACS 协议状态进行通信。

| Agent | 模型 | 提供商 | 加入方式 |
|-------|------|--------|---------|
| cc-opus | Claude Opus 4.6 | Anthropic (Claude Code) | `macs boot --agent cc-opus` |
| cc-sonnet | Claude Sonnet 4.6 | Anthropic (subagent) | `macs boot --agent cc-sonnet` |
| codex | GPT 5.4 | OpenAI (Codex CLI) | `macs boot --agent codex` |
| omnicoder | OmniCoder 9B | 本地（M4 Max 上的 Ollama） | `macs boot --agent omnicoder` |

任务主题："capability-index 中的 skill 版本管理"，拆分为 3 个独立任务（非子任务）。

**说明**：这些任务用于验证 MACS 协调协议。实际代码变更已在 OnlyClaude 仓库中单独实现；本次实验验证的是多 agent 任务交接，而非代码产物本身。

## 实验过程

```bash
macs init "Skill Versioning"
macs add "Parse version from SKILL.md frontmatter in capability-index" --priority high
macs add "Add version column to dashboard HTML output" --priority medium
macs add "Write tests for version parsing and display" --priority medium
```

### 第一轮：cc-opus 启动，遭遇阻塞

cc-opus 认领了 T-001，完成 40% 进度后遇到一个设计决策：版本号在 JSON 输出中应该用什么格式？

```bash
macs checkpoint T-001 --agent cc-opus --progress 0.4 \
  --note "parseFrontmatter() already reads version. Need format decision."
macs block T-001 --agent cc-opus \
  --reason "Need to decide: semver vs semver+date vs changelog link" \
  --next "Another agent pick this up and decide format"
```

### 第二轮：OmniCoder 拍板决策

OmniCoder（运行在 Ollama 上的本地 9B 模型）通过 `macs status` 读取了当前状态，分析了三种格式方案，最终决定：**plain semver 字符串**。理由：行业标准、可机器比较、简洁。

```bash
macs unblock T-001 --agent omnicoder
# 注意：在下方修复之前，omnicoder unblock 后无法重新 claim 该任务。
# 修复后，unblock 会清除 assignee，任何 agent 均可认领。
```

### 第三轮：全部完成

- **cc-opus** 重新认领并完成 T-001（版本解析）
- **cc-sonnet** 完成 T-002（dashboard 列）
- **codex** 完成 T-003（测试）

最终状态：**3/3 任务完成，4 个 agent 已注册，0 个阻塞。**

## 发现的 Bug（已修复）

三个协议层面的问题，只有在真实跨 agent 协作中才会暴露：

### 1. Unblock 不转移所有权

**发现**：omnicoder unblock T-001 后，任务仍然 assigned 给 cc-opus，omnicoder 无法认领。

**根本原因**：`task_unblocked` 处理器将状态改回 `in_progress`，但保留了原有的 assignee。

**修复**：Unblock 现在将状态设为 `pending` 并清除 `assignee`，任意 agent 均可重新认领。同时在阻塞历史中记录 `unblocked_by`。

### 2. Checkpoint 不验证所有者

**发现**：任意 agent 可以向任意任务写入 checkpoint，无论是否是 assignee。这破坏了所有权模型——如果 agent B 能静默更新 agent A 的进度，任务状态将变得不可靠。

**修复**：`addCheckpoint()` 现在在调用方不是任务 assignee 时抛出异常：`"Only the task owner can add checkpoints (current owner: <name>)"`。

### 3. 贡献统计只计算 claim/done

**发现**：OmniCoder 做出了关键设计决策并 unblock 了任务，但其 `tasks_done: 0`。通过决策、unblock 和 review 做出贡献的 agent 在统计中完全不可见。

**修复**：Agent 统计现在除 `tasks_completed` 外，还追踪 `checkpoints_added`、`tasks_unblocked` 和 `reviews_done`。

## 核心洞察

> **一个运行在笔记本电脑上的本地 9B 模型，做出了一个让 Claude Opus 得以继续推进的设计决策。**

这一句话道出了 MACS 的核心价值。各 agent 不需要体量相同、来自同一提供商，甚至不需要相同的架构。它们只需要读写同一个 `.macs/` 目录。

## 数据

- **4** 个 agent 注册（顺序交接，非并行）
- **3** 家提供商（Anthropic、OpenAI、本地 Ollama）
- **3** 个任务完成
- **3** 个协议 bug 发现并修复
- **1** 个设计决策由本地 9B 模型做出
- **0** 条 agent 间的自定义点对点协调逻辑

## 局限性

- **单次会话**：整个实验在一次坐下来完成（约 30 分钟），并非多日项目。
- **临时工作空间**：使用 `/tmp/macs-dogfood/`，并非真实生产仓库。
- **顺序执行**：Agent 依次轮流；未测试真正的并行并发写入。
- **人工编排**：由人工决定每个 agent 何时行动。生产环境中，agent 需要自行调度。
- **无回归测试**：3 个修复均经过人工验证，协议现有测试套件尚未更新。

## 下一步

- [ ] 为 3 个修复补充回归测试用例，更新协议测试套件
- [ ] 接入 Antigravity（Google）以支持第 4 家提供商
- [ ] 携带这些修复发布 npm 包
- [ ] 用真实的多日项目进行真正的并行执行验证
