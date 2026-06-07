# 司南项目代码图谱集成报告

## 设计目标

本轮把 `codex-subagent-router` 的项目理解从“每次按任务临时搜索”推进到“首次使用自动生成项目级轻量代码图谱”。图谱借鉴 CodeGraph 的本地索引思想：项目本地初始化、查询优先、减少 agents 反复读取无关文件，但不复制外部项目代码，也不新增依赖。

## 字段示例

`managed --json` 现在包含 `projectGraph`：

```json
{
  "status": "ready",
  "generatedNow": true,
  "graphPath": ".codex/sinan-codegraph",
  "languages": [{"name": "TypeScript", "count": 2}],
  "frameworks": [{"name": "React", "reason": "package or JSX/TSX files"}],
  "entryFiles": ["package.json", "src/main.tsx"],
  "testCommands": ["npm test", "npm run lint", "npm run build"]
}
```

`contextLedger.projectGraphSummaryBytes` 记录图谱摘要成本。`displayBoard.userNarrative` 会用中文说明图谱是首次生成还是已复用。

## 代表验证

- React/Vite 项目：识别 TypeScript、React、Vite、入口和测试文件，并把首屏性能测试任务导向前端/测试/代码映射路径。
- FastAPI 项目：识别 Python/FastAPI，并把接口鉴权测试任务导向后端/安全路径。
- Chrome MV3 项目：识别 `manifest.json`，并把 manifest/popup 静态检查导向浏览器插件 QA 路径。
- Android/Gradle 项目：识别 Android/Gradle 项目信号。
- 内容营销任务：即使项目是 React，`写小红书脚本` 仍保持 `content-marketing` 并选择 `agency:xiaohongshu-specialist`。
- 高风险生产鉴权任务：仍保留 parent-review-required，不被图谱信号降级。

## 与外部 CodeGraph 的边界

本轮只实现内置轻量图谱，保证插件离线、零依赖、可随个人插件镜像分发。若本机安装了 `codegraph` CLI，manifest 会记录 `codegraphCliAvailable`，但不会自动调用外部 MCP 或要求用户安装。后续可以在不破坏当前合同的前提下增加外部 CodeGraph 查询适配层。

## 验证命令

本轮已验证：

```bash
node --check subagents/router.mjs
node --check plugins/codex-subagent-router/scripts/subagents/router.mjs
node --check subagents/import-community-skills.mjs
node subagents/router.mjs test
node subagents/router.mjs eval
node subagents/router.mjs test-managed-contract
node subagents/router.mjs test-app-board
node subagents/router.mjs test-context-budget
node subagents/router.mjs test-config
node subagents/router.mjs test-mirror-parity
node subagents/router.mjs test-project-graph
node subagents/router.mjs doctor
node plugins/codex-subagent-router/scripts/subagents/router.mjs eval
git diff --check
```

新增图谱 CLI smoke 命令：

```bash
node subagents/router.mjs project-graph status --json
node subagents/router.mjs project-graph query --json "入口文件和测试"
```

验证结果：主源码和插件镜像评测均为 156/156，通过图谱专项、App 看板、托管合同、上下文预算、配置、镜像一致性和 doctor 检查。
