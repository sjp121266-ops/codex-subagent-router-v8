# Subagent Router v13 Plan

## Summary

v13 continues the quality-first router work after v12. The goal is to make one-sentence delegation more executable and auditable: the parent Codex should know which agent lineup is available, whether it can spawn now, which stage comes next, which skills to load before that stage, and how cache/eval health looks.

## Goal Queue

### Goal 1: Agent roster and capability matrix

- Add `agentRoster` to route, judge, compact judge, and managed outputs.
- Show primary, mapper, implementer, validator, reviewer, fallback candidates, and missing preferred-agent fallbacks.
- Keep no-write tasks from exposing a write-capable implementer.

### Goal 2: Managed delegation readiness

- Add `delegationReadiness`, `nextAction`, and `stageSkillLoadingOrder` to `managed --json`.
- Keep normal user-facing output compact while making the JSON directly executable by the parent Codex.
- Preserve clarify-first and parent-review-required safety behavior.

### Goal 3: Eval expansion and bucket reporting

- Expand deterministic eval from 97 to 112 cases.
- Add taskKind bucket pass-rate reporting to eval output and the persisted last-eval file.
- Cover roster, managed readiness, cache, release, research-only, incident, product, and orchestration edge cases.

### Goal 4: Cache maintenance governance

- Add `cache-status` and `cache-prune`.
- Add route-cache metadata versioning to avoid stale route decisions after router code changes.
- Add v13 roster/cache signals to `doctor` and `report`.

### Goal 5: Documentation, global sync, and release

- Update README and the global `subagent-router` skill documentation.
- Add this plan and the final report.
- Sync the repository version into `~/.codex/subagents` and `~/.codex/skills/subagent-router`.
- Run the full validation matrix, commit, and push.

## Quality Rules

- High-risk security, auth, production, incident, current diff, and review tasks continue to use GPT-5.5.
- Token saving remains limited to low-risk, high-confidence, stable routing paths.
- No-write/research-only tasks must remain read-only and must not generate implementation stages.
- Managed output should hide internal candidate budgets and cache keys unless the caller asks for judge/debug output.
