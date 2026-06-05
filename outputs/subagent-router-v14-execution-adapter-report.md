# Subagent Router v14 Execution Adapter Report

Generated: 2026-06-06

## Summary

This update makes the custom-agent spawn boundary explicit and machine-readable.
When the current Codex host cannot directly spawn a VoltAgent identity by name,
`managed --json` now returns an `executionAdapter` contract.

## Behavior

- If native custom-agent spawning is available, the adapter reports `native-custom-agent`.
- If native custom-agent spawning is not available, the adapter reports `generic-role-bridge`.
- In bridge mode, the selected VoltAgent identity is preserved by injecting `delegationPrompt` into the generic `explorer` or `worker` role.
- `codex exec` remains available as the stronger isolation fallback when needed.

## User Impact

The boundary has low practical impact for normal use:

- Agent choice is unchanged.
- Skill choice is unchanged.
- Model and reasoning policy are unchanged.
- Sandbox and staged handoff rules are unchanged.
- The only difference is the execution transport: native custom name vs generic role carrying the selected identity.

## Verification

- `node --check subagents/router.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval` -> `112/112`
- `node subagents/router.mjs test-execution-adapter`
- `node subagents/router.mjs test-managed-readiness`
- `node subagents/router.mjs doctor`
- `plugins/codex-subagent-router/scripts/subagents/router.mjs test-execution-adapter`
- installed plugin cache `router.mjs test-execution-adapter`
- global `~/.codex/subagents/router.mjs test-execution-adapter`

## Current Local Adapter

Current local Codex host reports:

- mode: `generic-role-bridge`
- native custom agents: unavailable
- bridge role: `explorer` or `worker`, depending on the next stage
- prompt injection required: `true`
- `codex exec`: available

