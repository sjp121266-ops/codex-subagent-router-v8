# Subagent Router v16 Context Efficiency Final Report

## Summary

v16 changes the plugin from full prompt injection toward budgeted prompt hydration. Agency agents remain available as provider identities, but normal managed routing now returns references and compact role cards instead of pasting full prompt bodies into context.

## Implemented

- Added `agency-agent-index.json` with 184 Agency agent cards.
- Added `contextLedger`, `dispatchPromptRef`, `compactRoleCard`, `promptHydrationPlan`, `promptBudget`, and `contextRisk`.
- Added hydration modes: `reference`, `summary`, `hybrid`, and `full`.
- Added CLI commands: `inspect-context`, `refresh-agent-index`, `test-context-budget`, `test-prompt-hydration`, and `test-agent-index`.
- Updated `prompt` to support Agency agents and `--hydrate` / `--budget`.
- Updated doctor/report to include agent-card index and context-efficiency health.
- Updated README and skill docs to default to `managed --json --profile compact`.

## Measured Results

- Reddit Agency managed JSON: about 8.0 KB in compact mode.
- Reddit default delegation prompt: about 1.6 KB in `reference` mode.
- Reddit full prompt hydration: about 8.4 KB.
- Product manager Agency prompt body: about 22 KB, but compact routing keeps dispatch prompt about 1.5 KB.
- High-risk auth/current-diff sample remains GPT-5.5 gated and no-cache.

## Verification

The v16-specific checks pass:

```bash
node --check subagents/router.mjs
node subagents/router.mjs test-agent-index
node subagents/router.mjs test-prompt-hydration
node subagents/router.mjs test-context-budget
node subagents/router.mjs test-provider-routing
node subagents/router.mjs test-provider-dispatch
node subagents/router.mjs test-managed-readiness
node subagents/router.mjs test-execution-adapter
```

Full regression status is recorded in the final user-facing handoff after the complete suite is run.

## Known Risks

- `managed --json` still carries enough execution-contract data to be useful, so it is compact rather than minimal.
- Full prompt hydration remains intentionally available for debugging and isolated execution; callers should not use it as the normal path.
- Context token estimates use a byte-based approximation, not tokenizer-exact counts.

## Next Suggestions

- Add historical context-ledger samples to persistent report storage.
- Add per-provider prompt-summary cache hit/miss accounting once multiple providers exist.
- Consider an even smaller `managed --json --profile terse` if future host UIs can recover details lazily.
