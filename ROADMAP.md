# MACS Roadmap

> **定位**：Git for AI Agents — 工作协调层
> **架构**：JSONL Event Sourcing + 自动生成 Markdown
> **更新**：2026-02-28

---

## 总览

```
Phase 1        Phase 2              Phase 3           Phase 4
基础发布        MACS Protocol v3.0    智能协调           生态扩展
(v2.3)         (v3.0)               (v3.5)            (v4.0+)
1-2 周          3-5 周               4-6 周             持续
   │              │                    │                 │
   ▼              ▼                    ▼                 ▼
 能用 ────► Agent 能协作 ────────► 能自动化 ────────► 有生态
(Markdown)    (JSONL Protocol)     (智能分配)        (付费版)
```

**关键决策**：Phase 2 直接上 JSONL Protocol，跳过 Markdown v2。
理由：0 用户 = 0 迁移成本，Markdown 有结构性并发限制，做过渡方案 80% 工作会被扔掉。

---

## Phase 1：基础发布（v2.3）— 1~2 周 ← 当前阶段

已完成：AST indexer ✅ | Dashboard ✅ | 跨平台安装 ✅
待完成：README | 本地大模型适配 | npm 发布 | GitHub 发版

## Phase 2：MACS Protocol v3.0 — 3~5 周

核心：Markdown 文档 → JSONL Event Sourcing

```
.macs/
├── protocol/          ← Agent 读写（JSONL，快，无冲突）
│   ├── tasks.jsonl    # 任务生命周期事件
│   ├── events.jsonl   # 全局事件流
│   ├── state.json     # 当前状态快照
│   └── agents.json    # Agent 注册表
├── sync/inbox/        ← Agent 间通信
└── human/             ← 自动生成 Markdown（给人看）
```

包含：Protocol 规范 + Event Sourcing + 任务认领 + 文件锁 + 消息系统 + CRDT + CLI + SDK

## Phase 3：智能协调（v3.5）— 4~6 周

能力路由 + 验证链 + 升级协议 + 依赖图 + impact analysis + Dashboard v2

> **设计基准**：全 Agent 公司场景——几乎无人类，agent 间需要能力匹配路由、互相验证输出、超权限决策能升级给人类。
> 详见任务文件「全 Agent 公司设计洞察」章节。

## Phase 4：生态 + 商业化（v4.0+）

插件系统 + A2A/MCP 桥接 + Team/Enterprise 付费版

---

详细任务清单见：`/Users/jarvis/mycc/tasks/macs-tech-upgrade.md`
