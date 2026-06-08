# 司南路由样本库与准确率报告

生成日期：2026-06-08

## 目标

本轮把司南调度器的路由评测从“主路由器里硬编码少量样本”升级为“外置黄金样本 + 负样本库 + 可对比准确率报告”。这样后续优化调度策略时，可以先补样本，再看准确率和混淆矩阵变化，避免凭感觉调规则。

## 实现内容

- 新增 `subagents/tests/fixtures/routing-golden.json`：记录必须选对 taskKind、agent、执行模式或安全边界的黄金样本。
- 新增 `subagents/tests/fixtures/routing-negatives.json`：记录不能误选的负样本，例如内容任务不能走工程 agent、token/OAuth 审查不能走营销 agent。
- `subagents/router.mjs` 新增 fixture 加载与校验：
  - 必须存在 `schemaVersion = routing-fixtures-v1`。
  - 样本 `id` 必须唯一。
  - `task`、`project`、`expected` 或负样本断言必须完整。
  - 项目文件路径必须是相对路径，避免把绝对路径或上级目录写入样本。
- `routing-metrics --json` 新增：
  - `fixtureSources`：样本路径、数量、哈希。
  - `confusionMatrix`：黄金样本期望 taskKind 与实际 taskKind 的混淆矩阵。
  - `comparison`：与上一次 `~/.codex/subagents/last-routing-metrics.json` 的准确率、通过数和错配数差异。
- 新增 `test-routing-fixtures`：只验证样本库结构，不运行完整路由。
- 插件镜像同步新增 fixture 文件，并把 `test-mirror-parity` 扩展到样本库。

## 当前样本覆盖

黄金样本 5 个：

- 小红书内容任务在 React 项目里仍应选择 `agency:xiaohongshu-specialist`。
- 只读 `get_token` / OAuth 审查必须保持只读安全边界。
- Chrome MV3 / popup 静态检查不能误走 Android。
- FastAPI 鉴权修复应留在工程/安全路径，不能走 Agency 内容代理。
- 模糊“多代理帮我优化一下这个”必须先澄清。

负样本 5 个：

- 内容任务不得选工程 agent 或 VoltAgent 工程提供方。
- 凭证任务不得选 Agency 营销类 agent。
- Chrome 插件任务不得选移动端能力。
- Android 项目不得误走浏览器插件 agent。
- 模糊任务不得直接进入实现模式。

## 指标样例

本轮 `routing-metrics --json` 结果：

- 总体准确率：10/10，100%。
- 黄金样本：5/5。
- 负样本：5/5。
- 显式 taskKind 混淆矩阵：3 个断言样本，0 个错配。
- Agent 画像覆盖：351 agents；高完整度 286，中完整度 65。
- 插件镜像评测：156/156。

混淆矩阵当前为：

```json
{
  "content-marketing": {
    "content-marketing": 1
  },
  "credential-tooling": {
    "credential-tooling": 1
  },
  "chrome-extension-qa": {
    "chrome-extension-qa": 1
  },
  "unspecified": {
    "engineering-execution": 2
  }
}
```

`unspecified` 表示该黄金样本主要断言 agent、模式或安全边界，不强制 taskKind。

## 验证结果

已通过：

- `node --check subagents/router.mjs`
- `node --check plugins/codex-subagent-router/scripts/subagents/router.mjs`
- `node --check subagents/import-community-skills.mjs`
- `node subagents/router.mjs test-routing-fixtures`
- `node subagents/router.mjs test-routing-golden`
- `node subagents/router.mjs test-routing-negatives`
- `node subagents/router.mjs routing-metrics --json`
- `node subagents/router.mjs test-config`
- `node subagents/router.mjs test-mirror-parity`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-app-board`
- `node subagents/router.mjs test-context-budget`
- `node subagents/router.mjs test-project-graph`
- `node subagents/router.mjs test-project-graph-performance`
- `node subagents/router.mjs test-architecture`
- `node subagents/router.mjs doctor`
- `node plugins/codex-subagent-router/scripts/subagents/router.mjs eval`
- `git diff --check`

说明：`test` 曾在和多项验证并行运行时触发 1200ms 性能门，耗时 1533ms；单独重跑通过，结果为 16 个路由测试 1024ms。该问题是并发验证资源干扰，不是功能断言失败。

## 后续建议

- 每次新增 agent 或策略前，先在 fixture 中加入对应黄金/负样本。
- 把内容营销、电商、飞书集成、移动端、浏览器插件、安全事故等高价值任务扩成 30-50 个样本。
- 当混淆矩阵出现错配时，优先修 taskKind 识别；当负样本失败时，优先修安全门和排除规则。
- 后续可以把 `routing-metrics` 输出接入 CI，把准确率下降作为发布阻断项。
