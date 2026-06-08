# 司南 Codex 多智能体调度器插件

这个个人 Codex 插件把“司南 Codex 多智能体调度器”打包为本地可用的 `subagent-router` 技能、路由 CLI 和插件元数据，用于选择 VoltAgent 与 Agency 代理身份、Codex 技能、模型层级、沙箱模式、执行适配器、分阶段交接计划、多智能体规划看板和预算化提示词填充。

## What Is Included

- `skills/subagent-router/SKILL.md`: plugin skill instructions.
- `scripts/subagents/router.mjs`: router CLI.
- `scripts/subagents/strategy-config.json`: taskKind, risk, skill, model, cache, and managed UX policy.
- `scripts/subagents/judgement.schema.json`: structured judgement schema.
- `scripts/subagents/community-skills-manifest.json`: community skill manifest.
- `scripts/subagents/registry.json`: VoltAgent agent registry snapshot.
- `scripts/subagents/agency-agents/`: bundled `msitarzewski/agency-agents` catalog, compact agent-card index, and prompt bodies.
- `assets/sinan-codex-agent-orchestrator-hero.png`: plugin visual asset.

## Codex App Planning Board

普通用户在 Codex App 里不需要阅读完整 JSON。路由器现在会生成 `displayBoard`，父级 Codex 可以直接展示中文规划板：

- `userNarrative`: 3-5 行中文摘要，说明为什么这样调度。
- `goalBoard`: 阶段看板，展示阶段、agent、状态、验收点和下一触发条件。
- `safetyPanel`: 可安全执行项、阻塞项和是否需要父级复核。
- `patternPanel`: 本次采用的开源协作模式摘要，例如 Agent/Task/Process 分离、带守卫的交接、上下文窗口控制、Supervisor 复核。
- `mermaidFlow`: 可贴进聊天窗口的 Mermaid 流程图。

`displayBoard.schema.version = "display-board-v2"` 记录显示契约和脱敏边界。面向 App 的看板文本会先清理凭证样式值、Bearer token、邮箱和绝对 `/Users/...` 路径，避免把本地敏感上下文塞进聊天界面。

直接预览 App 友好输出：

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --profile app "使用多智能体分批测试这个项目，输出规划看板"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --offline --profile app "使用多智能体分批测试这个项目，输出规划看板"
```

## First-Use Project Code Graph

插件首次在一个项目里运行 `managed` 或 `inspect-context` 时，会生成本地轻量代码图谱：

- 默认位置：`.codex/sinan-codegraph/`
- 主要文件：`manifest.json`、`files.json`、`edges.json`、`queries.json`、`summary.md`
- 用途：识别项目语言、框架、入口文件、测试命令候选、关键配置和模块 import 关系，帮助司南根据“任务语义 + 当前仓库结构”选择 agent。
- 边界：图谱只是初始导航，不替代 Codex 真实代码阅读、测试和最终验收；高风险、凭证、生产和发布动作仍然需要父级 Codex 复核。

常用命令：

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs project-graph status --json
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs project-graph init --json
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs project-graph query --json "入口文件和测试"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --no-project-graph --json "调试时跳过项目图谱"
```

## Routing Accuracy Tools

当你想知道“为什么选这个 agent”时，可以用路由追踪：

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs route-trace "写小红书种草脚本"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs route-trace --json "只读审查 get_token，不执行 OAuth、不输出 token"
```

`route-trace` 会展示任务信号、项目图谱信号、用户约束、安全信号、候选分数和被规则排除的 agent。普通 Codex App 聊天仍默认显示中文规划板，不会把内部候选评分塞给用户。

查看某个 agent 的结构化能力画像：

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs agent-profile qa-expert
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs agent-profile --json agency:xiaohongshu-specialist
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs agent-profile --json --all
```

画像会显示能力标签、适合任务、应避免任务、平台适配、安全边界、交接角色和画像完整度。它用于提高路由解释性和维护准确率，不会覆盖安全门或父级 Codex 的最终判断。

维护调度准确率时使用：

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-routing-golden
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-routing-negatives
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-routing-fixtures
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs routing-metrics
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs routing-metrics --json
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-project-graph-performance
```

黄金样本和负样本放在 `scripts/subagents/tests/fixtures/`，后续扩展调度能力时先加样本，再调策略。`test-routing-fixtures` 只校验样本结构和唯一性；`test-routing-golden` / `test-routing-negatives` 会真实跑路由。

`routing-metrics` 会汇总黄金样本、负样本、按 taskKind 的通过情况、Agent 画像覆盖率、路由缓存状态、样本来源哈希、taskKind 混淆矩阵，以及和上一次运行的准确率差异。负样本重点验证“不要选错”：例如小红书内容任务不能走工程 agent，token/OAuth 审查不能走营销 agent，Chrome 扩展不能走 Android agent，模糊项目优化不能直接进入实现。

## Execution Adapter

Native custom-name agent spawning depends on the current Codex host. When direct spawning by a provider identity is unavailable, the router uses `executionAdapter.mode = "generic-role-bridge"` and tells Codex to run the selected identity through the generic `explorer` or `worker` role with `delegationPrompt` injected. This keeps the chosen agent identity, skills, model, sandbox, stages, and quality gates intact while changing only the transport layer.

Agency agents are prompt-pack specialists. Their prompts are role/methodology guidance only; Codex system instructions, AGENTS.md, sandbox rules, approval rules, and parent verification remain authoritative. Normal managed output uses compact provider references by default and returns `dispatchPromptRef`, `compactRoleCard`, `promptHydrationPlan`, and `contextLedger`; full hydration is explicit.

## Usage

After installing the plugin, start a new Codex thread and ask:

```text
开启子代理，调用合适 agent 完成任务
```

For direct local checks:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，调用合适子代理，用 goal 模式持续实现"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --profile app "开启子代理，调用合适子代理，用 goal 模式持续实现"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --offline --profile app "开启子代理，调用合适子代理，用 goal 模式持续实现"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs inspect-context "开启子代理，帮我做 Reddit 社区增长策略"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs prompt agency:reddit-community-builder "帮我做 Reddit 社区增长策略" --hydrate summary --budget 2000
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs eval
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-agency-provider
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-provider-routing
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-provider-dispatch
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-agent-index
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-prompt-hydration
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-context-budget
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-execution-adapter
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-app-board
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-architecture
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-open-source-patterns
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs architecture-health
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs doctor
```

Provider examples:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，帮我做 Reddit 社区增长策略"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，只读分析产品 adoption 下降原因，不要改代码"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，审查 API 鉴权漏洞"
```

`report` should show 351 agents in the tested bundle: 167 VoltAgent and 184 Agency.


## Contract and Redaction Gates

Release validation includes the managed contract and App board gates:

```bash
node scripts/subagents/router.mjs test-managed-contract
node scripts/subagents/router.mjs test-app-board
node scripts/subagents/router.mjs test-architecture
node scripts/subagents/router.mjs test-mirror-parity
node scripts/subagents/router.mjs architecture-health --json
```

`test-app-board` now verifies that the user-facing `displayBoard` does not leak internal routing fields, cache details, provider prompt paths/full prompt wording, or credential-shaped secrets. Keep source and plugin mirror files byte-for-byte aligned before publishing; `test-mirror-parity` checks the router, config, schema, registry, community manifest, importer, routing fixture, and skill mirror pairs.

## Global Sync

The plugin is self-contained. If you also want the router available through the global non-plugin path, sync these files:

```bash
mkdir -p ~/.codex/subagents ~/.codex/skills/subagent-router
cp scripts/subagents/router.mjs ~/.codex/subagents/router.mjs
cp scripts/subagents/strategy-config.json ~/.codex/subagents/strategy-config.json
cp scripts/subagents/judgement.schema.json ~/.codex/subagents/judgement.schema.json
cp scripts/subagents/community-skills-manifest.json ~/.codex/subagents/community-skills-manifest.json
cp scripts/subagents/registry.json ~/.codex/subagents/registry.json
rm -rf ~/.codex/subagents/agency-agents
cp -R scripts/subagents/agency-agents ~/.codex/subagents/agency-agents
cp skills/subagent-router/SKILL.md ~/.codex/skills/subagent-router/SKILL.md
chmod +x ~/.codex/subagents/router.mjs
```
