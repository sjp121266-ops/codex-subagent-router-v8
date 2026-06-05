# Subagent Router v11 Final Report

## Summary

v11 upgrades the router into a managed delegation layer. It now understands the task shape before selecting agents and skills, reduces unnecessary token use, improves local preparation speed, and gives the parent Codex a concise goal/stage loop for one-line requests such as "调用合适子代理完成任务".

## Implemented

- Added `taskKind` routing for `engineering-execution`, `engineering-analysis`, `product-analysis`, and `orchestration-design`.
- Added `managed --json` for user-facing delegation plans.
- Added compact default `judge --json`; full internals remain available through `judge --verbose` and `judge --explain`.
- Compressed the judge prompt by sending only compact candidate and route summaries.
- Added stable cache keys, in-process route cache, and runtime skill registry snapshot.
- Added bad cache and bad snapshot recovery.
- Added test commands:
  - `test-performance`
  - `test-managed`
  - `test-skills-phase`
  - `test-judge-matrix`
- Updated README and both repository/global `subagent-router` skill docs.

## Verification Results

- `node --check subagents/router.mjs`: pass
- `node subagents/router.mjs test`: pass, 16/16
- `node subagents/router.mjs eval`: pass, 77/77
- `node subagents/router.mjs test-performance`: pass
  - Prompt reduction: about 49%
  - Default JSON reduction: about 88%
  - Tier-1 skill build: about 0.188ms in the measured run
  - Cached route pair: about 0.101ms in the measured run
- `node subagents/router.mjs test-managed`: pass
- `node subagents/router.mjs test-recovery`: pass
- `node subagents/router.mjs test-handoff`: pass
- `node subagents/router.mjs test-skills-phase`: pass
- `node subagents/router.mjs test-skill-repair`: pass
- `node subagents/router.mjs doctor`: pass
- `node subagents/router.mjs report`: pass
- `node subagents/router.mjs test-judge-matrix`: pass
- Live critical GPT-5.5 smoke for current diff auth review: pass

## Current Behavior

- Clear orchestration tasks route to staged architecture/coordinator workflows.
- Vague multi-agent tasks use `clarify-first` with one concise question.
- Product-analysis tasks stay read-only and do not create implementation stages.
- High-risk current diff/auth/production/security work keeps GPT-5.5 and bypasses cache when volatile.
- Low-risk read-only product/docs/planning work can avoid GPT-5.5.

## Known Risks

- Native spawning by VoltAgent custom name still depends on the host Codex surface. When unavailable, parent Codex should inject the selected identity prompt into the generic explorer/worker.
- Live model behavior may vary slightly; deterministic eval and repair tests protect the important invariants.
- The skill registry snapshot is local runtime state and should be regenerated on machines with different plugin/skill installs.

## Recommendation

Use `managed --json` for normal user-facing delegation and reserve `judge --verbose` / `judge --explain` for router debugging, audits, or high-risk review.
