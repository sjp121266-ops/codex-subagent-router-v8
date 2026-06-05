# Subagent Router v8 Goal 1 Eval Report

## Summary

Goal 1 已完成：新增质量优先的结构化 eval 体系，用 52 个 deterministic cases 覆盖前端、后端、安全、review、debug、测试、iOS、DevOps、OpenAI/AI、数据库、文档、模糊任务、缓存与预算策略。

## Implemented

- 新增 `router.mjs eval [--json]`。
- 内置 52 个 eval cases。
- 每个 case 校验 agent/intent/skill/sandbox/runtimeRole/model policy/cache/clarify/test/review 等关键预期。
- eval 结果写入 `$HOME/.codex/subagents/last-eval-results.json`。
- 修复 eval 暴露的规则缺口：OpenAI/LangGraph data-ai、App Intent iOS、GitHub Actions、中文认证/计费、threat model。

## Verification

- Syntax check: pass
- Regression: `PASS 16 routing tests in 34ms`
- Eval: `EVAL 52/52 passed in 1021ms`
- Doctor: pass

## Acceptance

- 至少 50 个 eval cases：完成，52 个。
- deterministic eval 通过率 100%：完成。
- 高风险样例触发 GPT-5.5 policy：完成。
- 低风险样例覆盖 deterministic/cache/mini-judge：完成。
