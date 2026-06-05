# Subagent Router v8 Goal 2 Observability Report

## Summary

Goal 2 已完成：`judge` 输出现在包含可解释调度元数据，并新增 `--explain` 人读模式，能说明为什么选 agent、skills、模型档位、缓存策略，以及为什么拒绝其他候选。

## Implemented

- 新增 `decisionTrace`、`qualityGates`、`rejectedCandidates`、`skillRationale`。
- 新增 `handoffPlan` 初版，供后续多 agent 编排复用。
- 新增 `judge --explain`。
- 缓存键加入 `routerMetadataVersion: 8`，避免旧缓存缺少解释字段。

## Verification

- JSON metadata check: pass，字段完整。
- Explain output check: pass，包含 decision trace、quality gates、selected skills、rejected candidates、handoff stages。
- Regression: `PASS 16 routing tests in 36ms`
- Eval: `EVAL 52/52 passed in 1040ms`

## Acceptance

- 典型任务可解释 agent/skills/model/cache：完成。
- 高风险任务显示质量门控原因：完成。
- 未选高分候选有拒绝原因：完成。
- JSON 与人读输出均通过测试：完成。
