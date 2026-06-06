# 司南 App 规划板展示增强报告

## Goal

让 `codex-subagent-router` 在 Codex App 聊天窗口里优先呈现中文多智能体阶段看板，而不是要求用户阅读 raw JSON。

## What Changed

- Added `displayBoard` to managed plans.
- Added `managed --profile app` for App-friendly Markdown board output.
- Kept `managed --json --profile compact` backward compatible for machine delegation.
- Added Chinese board sections: headline, user narrative, goal board, agent cards, safety panel, and Mermaid flow.
- Updated the subagent-router skill so parent Codex shows `displayBoard.userNarrative`, `goalBoard`, and `safetyPanel` during normal user communication.
- Synced the plugin mirror under `plugins/codex-subagent-router`.

## Representative Output Shape

```text
# 司南规划结果

司南已选择 <agent>，采用<协作模式>模式，当前状态：<状态>。

| 阶段 | Agent | 状态 | 验收点 | 下一触发 |
| --- | --- | --- | --- | --- |
| 阶段 1: map | code-mapper | 可安全执行 | 记录范围和证据 | 完成后进入下一阶段 |

## 安全边界

- 当前状态：可以按阶段推进
- 可安全执行：本地 lint/test/build
- 明确阻塞：token、生产发布、真实平台动作
```

## Test Coverage

New targeted command:

```bash
node subagents/router.mjs test-app-board
```

It verifies:

- `displayBoard` exists for representative prompts.
- Chinese headline, narrative, stage board, safety panel, and Mermaid flow are stable.
- `managed --profile app` renders Markdown table output.
- Internal fields such as `judgeMode`, `candidateBudget`, and cache internals are hidden from App text output.
- Credential and high-risk prompts keep blockers and review gates visible.

## Current Limitation

This iteration does not modify Codex App native UI components. The enhancement stays inside the plugin and router surfaces, so the App receives Markdown/Mermaid-ready content that the parent Codex can display directly in chat.
