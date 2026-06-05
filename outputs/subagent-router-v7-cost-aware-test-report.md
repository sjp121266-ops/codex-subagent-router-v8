# Subagent Router v7 Cost-Aware Test Report

## Summary

v7 已完成质量优先的成本感知路由优化。路由器现在会先用本地确定性策略判断是否可以安全省 token；只有在风险、歧义、候选接近或用户要求更高质量时才调用模型 judge。高风险任务继续使用 GPT-5.5。

## Implemented

- 新增 `judgeMode`
  - `deterministic`
  - `mini-judge`
  - `standard-judge`
  - `premium-judge`

- 新增 `judgeModel`
  - `none`
  - `gpt-5.4-mini`
  - `gpt-5.4`
  - `gpt-5.5`

- 新增成本说明和候选预算
  - `costRationale`
  - `candidateBudget`
  - `cache`

- 新增缓存
  - 路径：`/Users/sjp1212/.codex/subagents/judgement-cache.json`
  - 缓存路由决策，不缓存执行结果
  - 当前 diff、日志、stack trace、文件/行号、测试输出等易变上下文自动绕过

- 新增 CLI 参数
  - `--budget economy|balanced|premium|critical`
  - `--no-cache`
  - `--force-model`

- 更新文件
  - `/Users/sjp1212/.codex/subagents/router.mjs`
  - `/Users/sjp1212/.codex/subagents/judgement.schema.json`
  - `/Users/sjp1212/.codex/skills/subagent-router/SKILL.md`

## Verification

1. Syntax check
   - Command: `node --check /Users/sjp1212/.codex/subagents/router.mjs`
   - Result: pass

2. Deterministic regression suite
   - Command: `/Users/sjp1212/.codex/subagents/router.mjs test`
   - Result: `PASS 16 routing tests in 44ms`

3. Low-risk deterministic route
   - Task: `开启子代理，修正 README 里的一个拼写错误`
   - Result:
     - `judgeMode`: `deterministic`
     - `judgeModel`: `none`
     - `modelUsed`: `false`
     - `selectedModel`: `gpt-5.4-mini`
     - `finalAgent`: `documentation-engineer`

4. Cache hit
   - Same README typo task rerun
   - Result:
     - `cache.hit`: `true`
     - no model judge used

5. Economy mini judge
   - Task: `开启子代理，补齐 pytest 覆盖率`
   - Flags: `--budget economy --force-model --no-cache`
   - Result:
     - `judgeMode`: `mini-judge`
     - `judgeModel`: `gpt-5.4-mini`
     - `modelUsed`: `true`
     - `finalAgent`: `test-automator`
     - selected skills included `community-matt-tdd`, `agyb-essentials:lint-and-validate`, `superpowers:test-driven-development`

6. GPT-5.5 quality gate
   - Command: `/Users/sjp1212/.codex/subagents/router.mjs test-judge`
   - Result:
     - `pass`: `true`
     - `judgeMode`: `premium-judge`
     - `judgeModel`: `gpt-5.5`
     - `modelUsed`: `true`
     - `cache.eligible`: `false`
     - `cache.bypassReason`: `volatile current-context task; avoid stale routing cache`
     - `finalAgent`: `reviewer`
     - `selectedModel`: `gpt-5.5`
     - `reasoningEffort`: `high`
     - `importanceLevel`: `critical`

## Fix During Test

The first GPT-5.5 smoke test exposed a strict schema issue: the Codex CLI requires every schema property to be included in `required`. v7 now lists the new cost fields in `required`, and the judgement prompt tells the model to echo those fields from `judgePolicy`.

## Quality Result

The router now saves tokens in low-risk cases without weakening high-risk routing:

- Safe obvious tasks can skip judge model calls.
- Stable repeat tasks can reuse cached routing.
- Routine work can use compressed GPT-5.4 or GPT-5.4-mini judgement.
- High-risk or volatile tasks still go through GPT-5.5 and bypass cache.
