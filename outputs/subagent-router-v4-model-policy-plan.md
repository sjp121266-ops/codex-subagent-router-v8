# Subagent Router v4 Model Policy Plan

## Goal

Make each subagent launch with an appropriate model and reasoning effort:

- Important, high-risk, ambiguous, cross-system, architecture, security, production, and review tasks use `gpt-5.5`.
- Routine implementation and focused debugging use `gpt-5.4`.
- Simple, low-risk, narrow tasks may use `gpt-5.4-mini`.
- Reasoning effort is selected independently from model based on risk and complexity.

## Policy Layers

1. Deterministic policy:
   - Computes `importanceLevel`: `critical`, `high`, `normal`, or `low`.
   - Computes `selectedModel`, `reasoningEffort`, and `modelRationale`.
   - Always available offline and used as fallback.

2. GPT-5.5 judgement:
   - Receives deterministic policy as part of the routing packet.
   - Can confirm or upgrade model/effort.
   - Must not downgrade critical work below `gpt-5.5`.

3. Parent agent execution:
   - Uses selected model and reasoning effort when spawning generic `explorer` or `worker`.
   - If the spawn tool cannot accept the values, include them in the delegation prompt and use current defaults.

## Model Rules

- `gpt-5.5` + `high`:
  - architecture, security, auth, privacy, compliance, production incident, data loss, migrations, distributed systems, cross-module refactors, PR review with risk, ambiguous tasks, multi-agent coordination.

- `gpt-5.4` + `medium` or `high`:
  - normal backend/frontend implementation, ordinary bug fixes, test automation, framework-specific work.

- `gpt-5.4-mini` + `low` or `medium`:
  - simple docs, formatting, small localized edits, low-risk search/summarization, deterministic chores.

## Output Fields

Add to both deterministic fallback and GPT-5.5 judgement:

- `importanceLevel`
- `selectedModel`
- `reasoningEffort`
- `modelRationale`

## Acceptance Criteria

- Existing route/test commands still pass.
- `judge --offline` includes model policy fields.
- Critical/security/auth/review tasks select `gpt-5.5`.
- Simple docs task selects `gpt-5.4-mini` or `gpt-5.4`.
- Real `test-judge` returns valid GPT-5.5 judgement with model policy fields.
