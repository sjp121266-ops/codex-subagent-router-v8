# Multi-Agent Planning QA Report

Date: 2026-06-06

Goal: strengthen `codex-subagent-router` multi-agent planning so managed output reads like an executable task board, not only a raw staged `goalLoop`.

## Baseline Gap

Before this iteration, managed routing already returned `agentRoster`, `goalLoop`, `stageInputs`, `stageOutputs`, `writeBoundaries`, `nextAction`, and safety diagnostics. The weak spot was presentation and handoff clarity:

- Users could see stages, but not the collaboration mode or why multiple agents were useful.
- Agent roles were present, but not arranged as readable work cards.
- Multi-project work did not expose a batch board.
- Stage-to-stage handoff evidence was implicit.
- Safe checks and blocked checks were correct but not shown as a verification board.

## Design References

This iteration copied no external code. It absorbed product patterns from mature multi-agent systems:

- LangGraph / supervisor style: make supervisor, handoff, and team flow explicit.
- CrewAI style: separate agent, task, and process so users can read who does what.
- AutoGen style: treat multi-agent work as a coordinated runtime conversation with clear roles and stopping points.

## Implemented Fields

- `planningBrief`: concise objective, coordination mode, task kind, risk, why multi-agent, safe expectation, and automatic limits.
- `agentWorkPlan`: readable role cards for mapper, primary, implementer, validator, and reviewer.
- `batchPlan`: batch-oriented board for multi-project or multi-sample tasks.
- `handoffContracts`: point-to-point stage contracts with required evidence, stop condition, and resume trigger.
- `verificationBoard`: stage check board with `pending`, `safe-to-run`, `blocked`, and `requires-parent-review` statuses.

Existing fields remain compatible: `goalLoop`, `handoffPlan`, `agentRoster`, `executionContract`, `stageInputs`, and `stageOutputs` were not removed.

## Verification Samples

Representative managed prompts now verify:

- Project + tool directory batch work returns `planningBrief.coordinationMode = parallel-batches` and three batch cards.
- Android staged QA returns point-to-point handoff contracts and device-aware verification states.
- OAuth/token read-only review has no implementer role and blocks OAuth/token output in `verificationBoard`.
- Vague multi-agent prompts remain `clarify-first`.
- Production auth incident prompts keep supervisor/review gating.

## Passed Checks

- `node --check subagents/router.mjs`
- `node --check subagents/import-community-skills.mjs`
- `node --check plugins/codex-subagent-router/scripts/subagents/router.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval` -> 154/154
- `node subagents/router.mjs test-planning-board`
- `node subagents/router.mjs test-managed`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-managed-readiness`
- `node subagents/router.mjs test-config`
- `node subagents/router.mjs test-handoff`
- `node subagents/router.mjs test-agent-roster`
- `node subagents/router.mjs test-skills-phase`
- `node subagents/router.mjs test-execution-adapter`
- `node subagents/router.mjs test-judge-matrix`
- `node subagents/router.mjs doctor`
- `node plugins/codex-subagent-router/scripts/subagents/router.mjs eval` -> 154/154
- `node plugins/codex-subagent-router/scripts/subagents/router.mjs test-planning-board`

Representative managed samples:

- Project + tool directory batch work -> `parallel-batches`, batches: `inventory-batch`, `local-validation-batch`, `supervisor-summary`.
- Android staged QA -> `sequential-team`, 5 handoffs, device-side checks blocked when no device is ready.
- OAuth token read-only review -> `supervisor-review`, no implementer, token/OAuth checks blocked.
- Vague multi-agent request -> `clarify-first`, next action asks one clarification.
- Production auth incident -> `supervisor-review`, validate/review stages remain explicit.

## Remaining Limits

- The planning board is JSON/text output only; there is no graphical UI yet.
- The router still depends on the host for actual custom-agent spawning. When native custom agents are unavailable, the board still works through the generic explorer/worker bridge.
- Batch planning groups by prompt intent and known safety diagnostics; it does not yet inspect arbitrary filesystem trees inside the managed command itself.
