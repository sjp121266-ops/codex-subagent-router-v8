# Subagent Router v8 Goal 3 Recovery Report

## Summary

Goal 3 已完成：路由器现在能对失败进行分类，并在模型、离线、坏 cache、缺失 skill 等场景下保守降级，不把高风险 fallback 伪装成普通高置信结果。

## Implemented

- 新增 `failureClass`、`fallbackReason`、`fallbackSafety`、`requiresParentReview`。
- 高风险模型/离线 fallback 标记为 `conservative`，并要求 parent review。
- 低风险 deterministic 标记为 `safe-deterministic`，不误报为失败。
- 坏 cache 自动隔离并恢复为空 cache。
- 缺失 skill 从候选中剔除，并通过 `routingWarnings` 暴露。
- skill registry 增加进程内缓存，恢复测试性能。

## Verification

- Recovery test: pass
- Regression: `PASS 16 routing tests in 57ms`
- Eval: `EVAL 52/52 passed in 145ms`
- Doctor: pass

## Acceptance

- offline judge 稳定返回安全 fallback：完成。
- 高风险 fallback 带 `requiresParentReview: true`：完成。
- 低风险 deterministic 不被标记为失败：完成。
- 坏 cache 可恢复：完成。
- 不破坏 v7 成本策略：完成。
