# Subagent Router v2 Test Report

## Summary

Router v2 is implemented and verified.

- Registry agents: 167
- Typical agents present: backend-developer, frontend-developer, reviewer, debugger, test-automator
- Built-in regression suite: 7/7 passed
- Built-in routing runtime: 16 ms
- 100 CLI route calls: 5425 ms total, 54.25 ms average including Node process startup

## Scenario Results

| Task | Recommended | Role | Sandbox | Confidence | Parent Choice | Top Candidates |
|---|---|---|---|---|---|---|
| 开启子代理，帮我修前端 bug | frontend-developer | worker | workspace-write | medium | false | frontend-developer, browser-debugger, react-specialist |
| 开启子代理，审查当前 diff | reviewer | explorer | read-only | high | false | reviewer, code-reviewer, architect-reviewer |
| 开启子代理，修复 API 鉴权问题 | backend-developer | worker | workspace-write | high | false | backend-developer, api-designer, security-engineer |
| 开启子代理，补齐 pytest 覆盖率 | test-automator | worker | workspace-write | high | false | test-automator, qa-expert, ui-ux-tester |
| 开启子代理，修复 SwiftUI 页面布局 | swift-expert | worker | workspace-write | high | false | swift-expert, mobile-developer, expo-react-native-expert |
| 开启子代理，修复 Docker 部署失败 | deployment-engineer | worker | workspace-write | high | false | deployment-engineer, devops-engineer, docker-expert |
| 开启子代理，分析这个奇怪的产品问题 | product-manager | explorer | read-only | low | true | product-manager, risk-manager, research-analyst |

## Verified Commands

```bash
node --check $HOME/.codex/subagents/router.mjs
$HOME/.codex/subagents/router.mjs rebuild
$HOME/.codex/subagents/router.mjs test
$HOME/.codex/subagents/router.mjs route --brief "开启子代理，修复 API 鉴权问题"
$HOME/.codex/subagents/bin/codex-subagent route --brief "开启子代理，审查当前 diff"
```

## v2 Fields Verified

- `confidence`
- `needsParentChoice`
- `matchedIntents`
- `scoreBreakdown`
- `reasons`
- `skillMatches`
- `suggestedSkills`
- `delegationPrompt`

## Notes

- Low confidence routes are intentionally not autonomous decisions.
- Vague tasks return candidates and ask the parent agent to choose using local context.
- Strong platform signals now outrank generic UI wording, so SwiftUI routes to `swift-expert`.
