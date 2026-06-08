# 司南 Agent 画像与路由准确率报告

## 目标

本轮把司南的路由维护能力继续前推：不只看“选中了谁”，还要能稳定回答“这个 agent 擅长什么、为什么它适合、哪些选择必须避免、当前准确率是否退化”。

## 新增能力

- `agent-profile`：输出结构化 Agent 能力画像。
  - 能力标签：前端、后端、测试、安全、移动端、浏览器插件、内容营销、研究文档、规划编排等。
  - 任务适配：适合的 taskKind、应避免的 taskKind。
  - 安全边界：只读、可写、高风险复核。
  - 交接角色：mapper、implementer、validator、reviewer。
- `routingEvidence.selectedAgentProfile`：在路由证据里附带选中 agent 的紧凑画像。
- `test-routing-negatives`：验证“不要选错”的负样本。
- `routing-metrics`：汇总黄金样本、负样本、按 taskKind 的通过情况、Agent 画像覆盖率和路由缓存健康。

## 代表命令

```bash
node subagents/router.mjs agent-profile qa-expert
node subagents/router.mjs agent-profile --json agency:xiaohongshu-specialist
node subagents/router.mjs test-routing-golden
node subagents/router.mjs test-routing-negatives
node subagents/router.mjs routing-metrics --json
```

## 当前验证结果

- 黄金样本：5/5。
- 负样本：5/5。
- 路由 metrics 样本总计：10/10，accuracy 1.0。
- Agent 画像覆盖：351 agents；高完整度 286，中完整度 65，低完整度 0。
- 画像噪声修复：收紧 `auth`、`ios`、`ui`、`web` 等短词匹配，避免 `author`、`quality` 等普通片段误触发安全或前端标签。

## 负样本覆盖

- 小红书内容任务不能选择前端、后端、全栈等工程 agent。
- OAuth/token 只读审查不能选择 Agency 营销/内容 agent。
- Chrome MV3 检查不能选择移动端/iOS agent。
- Android Gradle 验证不能选择浏览器插件 agent。
- 模糊项目优化必须保持 `clarify-first`，不能直接进入实现或 staged 执行。

## 边界

Agent 画像是路由证据和维护工具，不是安全授权。它不能覆盖用户明确指令、只读/禁写边界、高风险父级复核、项目图谱证据、真实代码阅读、测试和最终验收。普通 Codex App 用户仍优先看到中文规划板；完整画像和 metrics 主要用于调试、评估和插件迭代。
