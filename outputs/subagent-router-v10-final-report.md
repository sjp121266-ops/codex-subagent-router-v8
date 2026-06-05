# Subagent Router v10 Final Report

Generated: 2026-06-05

## Summary

v10 focuses on the router's own multi-agent orchestration path. The main quality issue was that broad Chinese requests such as "use multiple subagents and skills to fully optimize this project" could be treated as vague `clarify-first` work, while generic "agent/智能体" wording could pull OpenAI/LangGraph skills even when the task was about workflow orchestration rather than AI framework implementation.

v10 separates those meanings:

- Explicit broad project authorization now routes to `staged`.
- Vague broad project requests still route to `clarify-first`.
- Generic multi-agent wording no longer selects OpenAI/LangGraph skills unless OpenAI, Agents SDK, LangGraph, LLM, or related technical terms are explicitly present.
- Workflow skills are phase-aware, so planning, implementation, testing, and review stages load more appropriate guidance.
- `rejectedCandidates` now explains rejected agents relative to the final selected agent, not only the deterministic first choice.

## Multi-Agent Review Inputs

This iteration used three read-only subagents before implementation:

- `llm-architect`: reviewed prompt, routing, skill matching, and clarify-first behavior.
- `eval-engineer`: reviewed deterministic eval, handoff, recovery, and judge smoke coverage.
- `documentation-engineer`: reviewed README, global skill instructions, and public documentation boundaries.

Their P1 findings were implemented in a narrow patch: skill/intent boundary fixes, explicit broad authorization handling, stronger handoff contracts, expanded evals, and documentation updates.

## Key Changes

- Updated `subagents/strategy-config.json` to strategy version 4.
- Removed generic `agent/智能体` from OpenAI/LangGraph skill matching.
- Strengthened planning/orchestration matching for explicit multi-agent and skill-driven workflow tasks.
- Added task helpers for no-write requests, project-scope requests, and explicit broad authorization.
- Updated task profile and execution-plan logic so authorized broad project work becomes `staged`.
- Preserved `clarify-first` for underspecified requests such as "use multi-agent to optimize this project".
- Added read-only handling for audit/no-write tasks so they do not generate implementation stages.
- Added stage contract checks for `explore`, `implement`, `validate`, and `review`.
- Expanded deterministic eval from 65 v9 cases to 71 v10 cases.
- Updated README and `skills/subagent-router/SKILL.md` with parent Codex boundaries and clarify-first behavior.

## Verification

All local verification passed:

- `node --check subagents/router.mjs`
- `node --check subagents/import-community-skills.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval`
- `node subagents/router.mjs test-recovery`
- `node subagents/router.mjs test-handoff`
- `node subagents/router.mjs test-skill-repair`
- `node subagents/router.mjs doctor`
- `node subagents/router.mjs report`

Results:

- 16/16 routing regression tests.
- 71/71 deterministic eval cases.
- Recovery tests passed.
- Handoff tests passed.
- Skill-repair tests passed.
- Doctor passed.
- Report shows strategy v4, 167 agents, 279 skills, and 74 community skills.

## Live GPT-5.5 Smoke

Task:

```text
开启子代理，使用多智能体对当前项目做审查，确定几个优化方向，并持续迭代实现。
```

Result:

- `modelUsed: true`
- `judgeMode: premium-judge`
- `judgeModel: gpt-5.5`
- `finalAgent: architect-reviewer`
- `confidence: medium`
- `needsParentChoice: false`
- `executionPlan.mode: staged`
- `selectedModel: gpt-5.5`
- `handoffStages: explore, analyze, validate, review`
- `delegationBlocked: false`
- `fallbackSafety: not-fallback`

Selected skills included:

- `community-jmerta-plan-work`
- `community-matt-improve-codebase-architecture`
- `community-matt-to-issues`
- `compound-engineering:ce-code-review`
- `superpowers:subagent-driven-development`
- `superpowers:writing-plans`
- `superpowers:executing-plans`

## Remaining Risks

- Final route output still relies on the judgement schema plus runtime metadata assembly; a dedicated final-output schema remains a good future hardening item.
- Native Codex subagent role names may differ across environments, so the router still treats VoltAgent identities as delegation prompts when custom named spawn is unavailable.
- Live model judgements can vary slightly; deterministic eval protects the core policy, while high-risk live smoke should remain part of release validation.

## Recommendation

v10 is ready to publish. The next useful step is a final-output schema and a small `test-judge-matrix` command that runs three live smoke tasks: staged multi-agent, clarify-first, and high-risk current diff fallback behavior.
