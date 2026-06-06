# Subagent Router v16 Context Efficiency Plan

## Goal

Upgrade the router/plugin so adding large provider prompt packs does not slow ordinary delegation or consume excessive context. Preserve GPT-5.5 quality gates for security, auth, production, incident, current-diff, ambiguous, and high-risk work.

## Direction

1. Add a context ledger for managed, judge, prompt, and inspection paths.
2. Build a lightweight Agency agent-card index with hashes, summaries, keywords, critical instructions, and prompt references.
3. Default managed delegation to compact/reference hydration instead of full prompt injection.
4. Keep full prompt hydration available through explicit `prompt --hydrate full`.
5. Extend doctor/report/tests so context cost remains visible and regressions are caught.

## Architecture

- `agency-agent-index.json` is the default lookup surface for Agency agents.
- `dispatchPromptRef` points to a local prompt path and hash.
- `compactRoleCard` carries the role summary and critical safety reminders.
- `promptHydrationPlan` chooses `reference`, `summary`, `hybrid`, or `full`.
- `contextLedger` records managed JSON bytes, delegation prompt bytes, provider prompt bytes, estimated tokens, hydration mode, and context risk.

## Quality Gates

- High-risk tasks still route through GPT-5.5 policies.
- Agency prompts remain lower-priority role/methodology guidance only.
- Parent Codex still owns skill loading, sandbox boundaries, final integration, and verification.
- Full provider prompts are never loaded into normal managed output by default.

## Acceptance

- Existing eval remains green.
- Agency provider tests remain green.
- `managed --json --profile compact` reduces default JSON size versus v15.
- Default Agency dispatch prompt is at least 60% smaller than full hydration.
- `inspect-context` explains context cost and compression opportunities.
