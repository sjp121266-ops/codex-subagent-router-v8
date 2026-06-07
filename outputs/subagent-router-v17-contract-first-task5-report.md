# Subagent Router v17 Contract-First Task 5 Report

## Scope

Task 5 continued the contract-first optimization plan for `codex-subagent-router` with a small compatibility-preserving slice across:

- managed compact/app redaction boundaries;
- App display-board readability and Markdown table safety;
- fallback/error-boundary summarization for model/judge failures;
- route-cache invalidation parity with `ROUTER_METADATA_VERSION`;
- source/plugin mirror parity.

## Changes

- Added centralized compact/app display redaction helpers for secret-shaped values and judge execution details.
- Sanitized fallback reasons, clarification questions, `nextAction` fields, display-board text, stage boards, safety panels, handoff/verification summaries, and rendered App table cells.
- Added `managed --offline` for deterministic App rendering checks that do not invoke model judgement.
- Updated route judgement cache keys to use `ROUTER_METADATA_VERSION` instead of a stale literal.
- Added app-board regression coverage for recursive managed-plan internal-key checks and secret-shaped value redaction.
- Mirrored `subagents/router.mjs` exactly to `plugins/codex-subagent-router/scripts/subagents/router.mjs`.

## Compatibility Notes

- Managed JSON shape is preserved: no field renames to `executionContract`, `displayBoard`, `nextAction`, `goalLoop`, `stageInputs`, or `stageOutputs`.
- Compact/app profiles remain bounded; full profile behavior is not changed.
- Provider selection and eval case definitions are not changed.
- Plugin mirror remains a byte-for-byte router copy after the source edit.

## Verification Matrix

| Check | Command | Result |
| --- | --- | --- |
| Source syntax | `node --check subagents/router.mjs` | PASS |
| Mirror syntax | `node --check plugins/codex-subagent-router/scripts/subagents/router.mjs` | PASS |
| App board/redaction | `node subagents/router.mjs test-app-board` | PASS |
| Managed contract | `node subagents/router.mjs test-managed-contract` | PASS |
| Architecture tests | `node subagents/router.mjs test-architecture` | PASS |
| Source smoke | `node subagents/router.mjs test` | PASS |
| Mirror smoke | `node plugins/codex-subagent-router/scripts/subagents/router.mjs test` | PASS |
| Eval | `node subagents/router.mjs eval --json` | PASS, all cases pass |
| Mirror parity | `cmp -s subagents/router.mjs plugins/codex-subagent-router/scripts/subagents/router.mjs` | PASS |

## Remaining Risks

- `router.mjs` is still a known monolith; future extraction should start with managed-plan contracts/display-board schema.
- `pluginMirrorSyncHealth()` still checks the primary mirrored code/config/skill files, not all README/assets/plugin metadata.
- Clean environments without optional external skills may still need separate config-check policy work.
