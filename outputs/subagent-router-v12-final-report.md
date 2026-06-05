# Subagent Router v12 Final Report

## Summary

v12 improves the real "调用合适子代理完成任务" experience. The router now understands more task shapes, returns a managed execution contract, validates strategy configuration, caches stable route preparation, and gives the parent Codex clearer stage-by-stage responsibilities.

## Implemented

- Added taskKinds: `release-publishing`, `repo-maintenance`, `research-only`, and `incident-response`.
- Expanded eval from 77 to 97 cases.
- Added no-write/read-only invariants: research-only and explicit no-write tasks do not generate implementation stages.
- Added incident/security/auth/production/current-diff invariants: these continue to require GPT-5.5 routing policy.
- Added managed plan fields: `executionContract`, `writeBoundaries`, `parentResponsibilities`, `stageInputs`, and `stageOutputs`.
- Added config governance in `strategy-config.json` for taskKind policy, high-risk rules, cache policy, and managed UX.
- Added CLI commands: `config-check`, `config-explain`, and `refresh-skills`.
- Added test commands: `test-config`, `test-config-explain`, `test-route-cache`, and `test-managed-contract`.
- Added persistent route cache with hit rate, bypass reasons, oldest/newest timestamps, and corrupt quarantine count.
- Updated README and the repository/global `subagent-router` skill docs.

## Verification Results

- `node --check subagents/router.mjs`: pass
- `node --check subagents/import-community-skills.mjs`: pass
- `node subagents/router.mjs test`: pass, 16/16
- `node subagents/router.mjs eval`: pass, 97/97
- `node subagents/router.mjs test-performance`: pass
  - Compact prompt reduction: about 49%
  - Compact JSON reduction: about 88%
  - Stable warm route cache hit verified
- `node subagents/router.mjs test-managed`: pass
- `node subagents/router.mjs test-managed-contract`: pass
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

- README/release/changelog/public repository documentation routes to release-publishing instead of generic DevOps.
- "只调研 / 不要改代码 / 不写代码" routes read-only and avoids implementation stages.
- Production logs, online incidents, rollback, outage, security, auth, and current diff stay conservative with GPT-5.5 and no stale cache.
- `managed --json` is the default user-facing delegation surface.
- `judge --verbose`, `judge --explain`, and `config-explain` are reserved for audits, debugging, and router improvement work.
- Stable non-volatile routes can reuse route cache; volatile routes explain the bypass reason.

## Known Risks

- Native custom-name spawning still depends on the host Codex surface. When unavailable, the parent Codex should inject `delegationPrompt` into generic explorer/worker roles.
- Live model judgement can vary, so deterministic evals and fallback/repair tests remain the main guardrail.
- Route and judgement caches are local runtime state under `~/.codex/subagents`; they are intentionally not committed.
- Skill registry snapshot health depends on the target machine's installed skills and plugin cache.

## Recommendation

Use `managed --json` for ordinary "call suitable subagents" requests. Use `config-explain` when tuning taskKind or high-risk policy. Keep high-risk work on GPT-5.5 and continue expanding eval cases whenever a real routing miss appears.
