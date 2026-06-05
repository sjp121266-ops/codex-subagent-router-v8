# Subagent Router v4 Model Policy Test Report

## Summary

Router v4 adds automatic subagent runtime model and reasoning effort selection.

## Implemented

- Added deterministic model policy:
  - `importanceLevel`
  - `selectedModel`
  - `reasoningEffort`
  - `modelRationale`
- Updated GPT-5.5 judgement schema to require model policy fields.
- Updated GPT-5.5 routing prompt so the judge selects agent, skills, model, and reasoning effort.
- Added critical-task downgrade protection.
- Updated `subagent-router` skill so parent agents use `selectedModel` and `reasoningEffort` when spawning subagents.

## Policy Examples

| Task | Agent | Model | Reasoning | Importance |
|---|---|---|---|---|
| 开启子代理，帮我修前端 bug | frontend-developer | gpt-5.4 | high | normal |
| 开启子代理，补齐 pytest 覆盖率 | test-automator | gpt-5.4 | medium | normal |
| 开启子代理，修正 README 里的一个拼写错误 | documentation-engineer | gpt-5.4-mini | medium | low |
| 开启子代理，修复生产环境 API 鉴权漏洞 | backend-developer | gpt-5.5 | high | critical |
| 开启子代理，审查当前 diff | reviewer | gpt-5.5 | high | critical |

## Verification

```bash
node --check /Users/sjp1212/.codex/subagents/router.mjs
/Users/sjp1212/.codex/subagents/router.mjs test
/Users/sjp1212/.codex/subagents/router.mjs judge --offline --json "开启子代理，修正 README 里的一个拼写错误"
/Users/sjp1212/.codex/subagents/router.mjs judge --offline --json "开启子代理，修复生产环境 API 鉴权漏洞"
/Users/sjp1212/.codex/subagents/router.mjs test-judge
```

## Results

- Deterministic tests: 8/8 passed in 21 ms
- Low-risk docs policy: `gpt-5.4-mini`, `medium`, `low`
- Critical auth/production policy: `gpt-5.5`, `high`, `critical`
- Real GPT-5.5 judgement smoke test: passed

Real GPT-5.5 smoke test result:

```json
{
  "pass": true,
  "modelUsed": true,
  "modelError": null,
  "finalAgent": "reviewer",
  "runtimeRole": "explorer",
  "sandboxMode": "read-only",
  "selectedModel": "gpt-5.5",
  "reasoningEffort": "high",
  "importanceLevel": "critical",
  "confidence": "high"
}
```
