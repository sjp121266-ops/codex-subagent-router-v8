# Subagent Router v7 Cost-Aware Plan

## Goal

在质量结果优先的前提下降低路由阶段 token 消耗。v7 不减少必要的验证、执行质量或高风险任务的模型强度，只优化“选择子代理和 skills”这一步的上下文规模与模型档位。

## Strategy

1. 质量门控优先
   - 安全、鉴权、隐私、合规、架构、迁移、生产事故、高风险 review、模糊任务、多代理协调，继续使用 GPT-5.5 做路由 judgement。
   - 低置信或候选接近时不为了省 token 直接拍板。
   - `selectedModel` 和 `reasoningEffort` 仍按执行风险决定，路由省 token 不等于执行降级。

2. 成本感知 judge 档位
   - `deterministic`: 低风险、高置信、候选分差清晰、上下文稳定时跳过模型 judge。
   - `mini-judge`: economy 预算下，稳定且明确的普通任务使用 GPT-5.4-mini 做轻量确认。
   - `standard-judge`: balanced 默认档，使用 GPT-5.4 做压缩候选判断。
   - `premium-judge`: 高风险、高价值、模糊或 premium/critical 预算使用 GPT-5.5。

3. 候选压缩
   - 低风险任务只给 judge 3-5 个 agent 和 8-12 个 skill。
   - 高风险/复杂/模糊任务保留 6-8 个 agent 和 16-18 个 skill。
   - prompt 中只发送 name、短描述、phase、score、source 等必要字段，避免把完整 skill/agent 文档塞入 judge 上下文。

4. 路由缓存
   - 缓存 normalized task + budget + strategy version + agent count + community skill count + candidate skill names。
   - 只缓存路由选择，不缓存执行结果。
   - 当前 diff、日志、stack trace、文件/行号、测试输出等易变上下文自动绕过缓存。

5. CLI 控制
   - 默认：`judge --json --budget balanced "<task>"`
   - 省 token：`--budget economy`
   - 强质量：`--budget premium` 或 `--budget critical`
   - 禁用缓存：`--no-cache`
   - 强制模型 judge：`--force-model`

## Expected Behavior

- “开启子代理，修正 README 里的一个拼写错误”
  - deterministic route
  - no model judge
  - delegated execution can use GPT-5.4-mini

- “开启子代理，审查当前 diff”
  - premium-judge
  - GPT-5.5
  - cache bypassed because current diff is volatile

- “开启子代理，修复 API 鉴权问题”
  - premium-judge
  - GPT-5.5
  - backend/security skills preserved

- “开启子代理，构建 React Suspense 前端组件”
  - deterministic or standard/mini judge depending budget and confidence
  - React/frontend community skills preserved

## Quality Guardrails

- High/critical risk cannot be downgraded below GPT-5.5 judgement.
- Critical execution model cannot be downgraded by model output validation.
- Low confidence routes keep `needsParentChoice` or `clarify-first`.
- Cache is never used for volatile current repository state.
- Parent Codex remains responsible for final integration and user-facing summary.

## Test Plan

- Syntax check router.
- Run deterministic regression suite.
- Verify low-risk README typo uses deterministic/no model judge.
- Verify current diff/security review uses GPT-5.5 and bypasses cache.
- Verify economy budget can choose mini judge for safe routine routes.
- Verify `test-judge` still performs a real high-quality GPT-5.5 smoke test.
- Verify JSON output includes `judgeMode`, `judgeModel`, `costRationale`, `candidateBudget`, and `cache`.
