# Subagent Router v11 Plan

## Objective

Upgrade the router from "selects agents and skills" to a faster, more accurate, lower-friction managed delegation system for one-line subagent requests.

## Goals

1. Task semantic layer
   - Add `taskKind` for engineering execution, engineering analysis, product analysis, and orchestration design.
   - Use `taskKind` to drive agent choice, skills, stages, and quality gates.

2. Speed and token cost
   - Keep GPT-5.5 for high-risk/security/auth/production/current-diff/orchestration work.
   - Avoid GPT-5.5 for low-risk read-only product/docs/planning cases.
   - Compact judge prompt and default JSON output.

3. Candidate and cache performance
   - Keep strong-rule skill matches as Tier-1 candidates.
   - Add stable cache keys, route cache, and skill registry snapshot recovery.

4. Managed delegation UX
   - Add `managed --json` as the normal user-facing output.
   - Keep explanations concise and ask at most one clarification question.
   - Emit stage/goal loop fields for continuous goal execution.

5. Test matrix and release readiness
   - Add `test-performance`, `test-managed`, `test-skills-phase`, and `test-judge-matrix`.
   - Update README, skill docs, and final report.
   - Sync global install paths.

## Quality Policy

Speed improvements are allowed only when the task is low risk and the result remains safe. High-risk tasks continue to require GPT-5.5 routing and conservative fallback handling.
