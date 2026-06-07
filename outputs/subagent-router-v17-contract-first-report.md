# Subagent Router v17 Contract-First Optimization Report

## Outcome

v17 tightens the managed/app contract without changing the managed JSON shape, provider selection policy, eval cases, or source/plugin mirror layout.

## Changes

- Added deterministic `managed --offline` routing for local App-board tests so contract checks do not depend on live Codex CLI judgement.
- Added compact/app display redaction for bearer tokens, token/key assignments, OpenAI/GitHub-style tokens, URLs, and local `/Users/...` paths.
- Strengthened managed-plan contract checks to reject internal routing and secret-like leakage inside `displayBoard`.
- Strengthened App-board regression coverage for readable field lengths, non-empty table cells, visible review/clarify states, concrete stage acceptance, and redacted text rendering.
- Kept source and plugin mirror router files byte-for-byte synchronized.

## Compatibility Notes

- Managed JSON compatibility is preserved: existing keys such as `displayBoard`, `executionContract`, `nextAction`, `contextLedger`, provider refs, and hydration refs remain present.
- Compact/app profiles still omit raw judge/cache/candidate internals.
- Provider selection and dispatch tests remain green for Agency and VoltAgent routes.
- Eval behavior is unchanged.

## Verification Summary

- `node --check subagents/router.mjs` passed.
- `node subagents/router.mjs config-check --json` passed.
- `node subagents/router.mjs test-managed-contract` passed.
- `node subagents/router.mjs test-app-board` passed.
- `node subagents/router.mjs test-provider-routing` passed.
- `node subagents/router.mjs test-provider-dispatch` passed.
- `node subagents/router.mjs test-execution-adapter` passed.
- `node subagents/router.mjs test-context-budget` passed.
- `node subagents/router.mjs test-prompt-hydration` passed.
- `node subagents/router.mjs test-agent-index` passed.
- App redaction smoke for bearer/token/path content passed.

## Remaining Follow-ups

- A formal managed-plan JSON schema would further reduce compatibility drift risk.
- A dedicated `sync-plugin-mirror --check|--write` command would reduce release-sync manual steps.
