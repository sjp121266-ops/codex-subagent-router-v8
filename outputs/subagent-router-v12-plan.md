# Subagent Router v12 Plan

## Summary

v12 upgrades the router from a routing recommender into a more auditable delegation planner. The focus is better one-line delegation: more accurate task kinds, safer read/write boundaries, explainable config, persistent route cache, and managed contracts that the parent Codex can execute stage by stage.

## Goals

### Goal 1: Routing Accuracy v12

- Add task kinds: `release-publishing`, `repo-maintenance`, `research-only`, and `incident-response`.
- Keep README/release work out of DevOps unless deployment is actually requested.
- Keep "only research / do not edit" tasks read-only with no implementation stage.
- Route production logs, incidents, rollback, security, auth, and current diff through GPT-5.5 quality gates.
- Expand eval coverage from 77 to 97 cases.

### Goal 2: Executable Managed Plans

- Add `executionContract`, `writeBoundaries`, `parentResponsibilities`, `stageInputs`, and `stageOutputs` to `managed --json`.
- Ensure high-risk write tasks include validation and review.
- Enforce one writer per file/module by contract.
- Keep normal managed output concise and hide internal routing budget/cache details.

### Goal 3: Config Governance

- Move taskKind, preferred agent, allowed phase, high-risk, cache, and managed UX policy into `strategy-config.json`.
- Add `config-check` and `config-explain`.
- Validate taskKind policies, phase names, high-risk rule coverage, and configured skill existence.

### Goal 4: Speed and Cache

- Add persistent route cache for stable low/medium-risk routes.
- Track hit rate, bypass reasons, oldest/newest entries, and corrupt quarantine count.
- Add `refresh-skills` for local skill snapshot refresh.
- Extend performance tests with cold/warm route, skill candidate, and managed generation metrics.

### Goal 5: Docs, Sync, and Release

- Update README and `subagent-router` skill docs for v12.
- Add this plan and the final report.
- Sync repository files into the global Codex install paths.
- Run the full deterministic and live-smoke test matrix.
- Commit and push to GitHub.

## Quality Policy

- Quality remains first. Security, auth, production, incident, current diff, migration, and high-risk review use GPT-5.5.
- Token savings apply only to stable low-risk deterministic or lower-risk judge paths.
- Fallbacks for high-risk tasks require parent review and do not silently spawn write-capable stages.
