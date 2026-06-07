# 司南调度准确率与可观测性迭代报告

## 目标

本轮把司南从“能选 agent”推进到“能解释为什么选、为什么排除、如何持续评测”。重点增强调度准确率闭环、负向匹配、项目图谱速度证据和维护命令。

## 新增能力

- `routingEvidence`：在 `judge --json` 和 `managed --json` 中输出结构化路由证据。
  - `taskSignals`：任务语义和 taskKind 信号。
  - `projectSignals`：项目图谱识别出的前端、后端、Chrome 扩展、Android、iOS、测试等信号。
  - `userConstraints`：只读、禁写、项目范围、是否需要父级选择。
  - `safetySignals`：安全、生产、当前 diff、缓存绕过和复核要求。
  - `agentScores`：裁剪后的候选 agent 分数。
  - `rejectedByPolicy`：被负向规则排除的 agent 和原因。
- `route-trace`：快速查看一次路由的选择链，不调用模型。
- 负向匹配规则：
  - 内容营销任务排除工程 agent，避免被 React/FastAPI 仓库图谱带偏。
  - 平台型内容任务排除不匹配平台的内容 agent。
  - 只读/禁写任务排除普通写入型 agent。
  - Chrome 扩展和 Android 项目互相排除明显错域 agent。
  - 凭证/鉴权任务排除营销/增长类 agent。
- 模糊项目任务：有项目图谱但任务仍模糊时，优先回到 `code-mapper` 并保持 `clarify-first`。

## 新增验证

- `test-routing-golden`：黄金样本准确率测试。
  - React 仓库里的“小红书脚本”仍选择 `agency:xiaohongshu-specialist`。
  - `get_token` 只读审查保持只读安全路径。
  - Chrome MV3 manifest/popup 检查走 Chrome 插件 QA。
  - FastAPI 鉴权任务不被 Agency 营销 agent 抢走。
  - 模糊项目优化先选择 `code-mapper` 并澄清。
- `test-project-graph-performance`：项目图谱速度基准。
  - 83 文件样本首次生成约 9ms。
  - 二次复用约 0-1ms。
  - 查询约 5ms。
- compact 输出预算验证：
  - 高风险规划板 compact 样本约 6833 tokens，低于 7000 token 预算门。
  - `app` profile 继续保留中文看板和 Mermaid；`compact` profile 保留机器可读证据摘要。

## 用户使用方式

普通使用仍推荐：

```bash
node subagents/router.mjs managed --profile app "开启子代理，调用合适 agent 完成任务"
```

调试为什么选某个 agent：

```bash
node subagents/router.mjs route-trace "写小红书种草脚本"
node subagents/router.mjs route-trace --json "只读审查 get_token，不执行 OAuth、不输出 token"
```

维护准确率和速度：

```bash
node subagents/router.mjs test-routing-golden
node subagents/router.mjs test-project-graph-performance
```

## 边界

`routingEvidence` 是调试和报告层，不替代安全门、父级 Codex 复核、真实代码阅读、测试和最终验收。普通 Codex App 文本仍不展示完整候选评分，避免用户界面变成调试 JSON。
