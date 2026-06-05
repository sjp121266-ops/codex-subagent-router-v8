# Subagent Router v13 Final Report

## Summary

v13 upgrades the router from a strong routing recommender into a more executable delegation control plane. The parent Codex now gets an agent roster, delegation readiness, immediate next action, stage-level skill loading order, eval bucket quality reporting, and cache maintenance commands.

## Implemented

- Added `agentRoster` to route, judge, compact judge, and managed output.
- Added preferred-agent fallback explanations when configured preferred agents are unavailable.
- Added `delegationReadiness`, `nextAction`, and `stageSkillLoadingOrder` to `managed --json`.
- Expanded eval from 97 to 112 deterministic cases.
- Added taskKind bucket stats to eval reports.
- Added `cache-status` and `cache-prune`.
- Bumped route-cache metadata version to avoid stale results after router code changes.
- Strengthened release-publishing GitHub skill retention.
- Strengthened orchestration-design routing for managed-contract and stage-skill-loading work.
- Kept public hygiene/security review tasks read-only when they do not ask for edits.
- Updated README and global skill documentation for v13.

## Verification Results

- `node --check subagents/router.mjs`: pass
- `node --check subagents/import-community-skills.mjs`: pass
- `node subagents/router.mjs test`: pass, 16/16
- `node subagents/router.mjs eval`: pass, 112/112 across 8 taskKind buckets
- `node subagents/router.mjs test-performance`: pass
- `node subagents/router.mjs test-managed`: pass
- `node subagents/router.mjs test-managed-contract`: pass
- `node subagents/router.mjs test-agent-roster`: pass
- `node subagents/router.mjs test-managed-readiness`: pass
- `node subagents/router.mjs test-cache-maintenance`: pass
- `node subagents/router.mjs test-recovery`: pass
- `node subagents/router.mjs test-handoff`: pass
- `node subagents/router.mjs test-skills-phase`: pass
- `node subagents/router.mjs test-skill-repair`: pass
- `node subagents/router.mjs test-judge-matrix`: pass
- `node subagents/router.mjs test-config`: pass
- `node subagents/router.mjs test-config-explain`: pass
- `node subagents/router.mjs test-route-cache`: pass
- `node subagents/router.mjs doctor`: pass
- `node subagents/router.mjs report`: pass
- `~/.codex/subagents/router.mjs test-judge`: pass after global sync

## Current Behavior

- "调用合适子代理完成任务" can use `managed --json` as the default control surface.
- Ready routes return `nextAction.type = "spawn"` with stage, agent, role, sandbox, and skills to load.
- Vague routes return one clarification action instead of spawning prematurely.
- High-risk fallback routes return parent review and do not expose write-capable stages.
- Agent roster makes delegation decisions easier to audit without requiring verbose judge output.
- Cache maintenance is explicit and test-covered.

## Known Risks

- Native custom-name subagent spawning still depends on the host Codex surface. When unavailable, inject `delegationPrompt` into generic explorer/worker roles.
- Live model judgement can vary. Deterministic eval, fallback tests, repair tests, and smoke tests remain the main safety net.
- Cache files and skill snapshots are local runtime state under `~/.codex/subagents`; they are not committed and can differ by machine.

## Recommendation

Use `managed --json` for normal explicit subagent requests. Use `judge --explain` or `judge --verbose` only when auditing the router. Continue adding eval cases for every real routing miss, especially around new taskKinds, no-write boundaries, and high-risk fallback behavior.
