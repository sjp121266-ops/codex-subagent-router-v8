# Subagent Router v17 Contract Boundary Report

## Scope

Task 3 reviewed the contract-first router surfaces across source and plugin mirror with focus on:

- managed JSON compatibility;
- compact/app redaction;
- Codex App `displayBoard` readability;
- provider selection and provider prompt references;
- eval and managed test behavior;
- source/plugin mirror parity.

## Change Summary

- Added a recursive `displayBoard` redaction gate to the managed-plan contract validator.
- Extended App board tests so compact/app user-facing board content fails if it leaks internal routing fields, cache details, prompt paths, full provider prompt wording, or credential-shaped secrets.
- Synced the router source change into the plugin mirror.

## Compatibility Notes

The managed JSON shape is additive only: no output field was renamed or removed. The new guard runs during local test/health validation and does not alter normal routing output unless an unsafe display-board string is introduced in the future.

## Verification Evidence

Run from the repository root after the source and mirror update:

- `node --check subagents/router.mjs`
- `node --check plugins/codex-subagent-router/scripts/subagents/router.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs test-managed`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-app-board`
- `node subagents/router.mjs test-architecture`
- `node subagents/router.mjs architecture-health --json`
- `node subagents/router.mjs test-mirror-parity` for router, strategy config, schema, registry, community manifest, importer, and skill.

## Review Notes

- Contract/schema gates now cover user-facing board content recursively, not only top-level managed JSON keys.
- Display-board readability is preserved because the guard is validation-only and the existing Chinese board renderer remains unchanged.
- Mirror parity remains mandatory: router changes must be copied to `plugins/codex-subagent-router/scripts/subagents/router.mjs` before release.
