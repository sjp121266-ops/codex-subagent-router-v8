# Subagent Router v2 Optimization Plan

## Goal

Make the VoltAgent subagent router fast, accurate, explainable, and safe to use when the user explicitly enables subagents.

## Current Problems

- Unknown or vague tasks can fall back to the first alphabetical agent when every score is weak.
- Scoring is mostly keyword and direct hint based, with limited task-intent separation.
- Router output does not explain why an agent won, making trust and debugging harder.
- Skills are matched, but not grouped by confidence or reason.
- There is no repeatable regression test suite for routing quality.

## Design Principles

- Explicit activation only: never auto-delegate unless the user asks for subagents, multi-agent work, or automatic agent selection.
- Fast first pass: keep routing local and deterministic; no model call should be required for selecting an agent.
- Prefer precision over broad recall: for high-risk tasks, pick a narrow specialist; for vague tasks, return candidates with low confidence instead of pretending certainty.
- Explain every recommendation: include matched intents, matched keywords, score components, confidence, runtime role, sandbox, model fallback, and suggested skills.
- Keep Codex context light: the skill loads router output and only injects the selected agent instructions into the spawned worker or explorer.

## Implementation Changes

- Add task-intent classification:
  - `review`, `frontend`, `backend`, `debug`, `testing`, `security`, `devops`, `ios`, `data-ai`, `docs`, `planning`, `github`, and `unknown`.
  - Each intent has weighted patterns and preferred agents.

- Replace single score with score breakdown:
  - `intent`: agent is explicitly preferred for matched intent.
  - `keyword`: task words match agent name, description, category, or instructions.
  - `sandbox`: read-only tasks prefer read-only agents; implementation tasks prefer write-capable agents.
  - `category`: category aligns with detected task domain.
  - `penalty`: weak or conflicting matches reduce rank.

- Add confidence:
  - `high`: strong intent match and clear leading score.
  - `medium`: plausible match with enough evidence.
  - `low`: vague task or weak margin; return top 3 candidates and ask the parent agent to choose.

- Improve unknown-task behavior:
  - If no strong signal exists, recommend `code-mapper` for repo exploration when a codebase is implied.
  - Otherwise return candidates with `confidence = low` and `needsParentChoice = true`.

- Improve skills routing:
  - Output skill entries with `name`, `reason`, and `confidence`.
  - Keep `suggestedSkills` for backward compatibility.

- Improve commands:
  - Add `route --brief`, `route --json`, and default human-readable output.
  - Add `test` command to run routing regression tests.

- Update `subagent-router` skill:
  - Instruct the parent agent to use confidence and `needsParentChoice`.
  - Tell the parent agent to avoid spawning when confidence is low unless it can choose from candidates based on local context.

## Test Scenarios

- Frontend bug:
  - Task: `开启子代理，帮我修前端 bug`
  - Expected: `frontend-developer`, `worker`, frontend/debug skills, high confidence.

- Diff review:
  - Task: `开启子代理，审查当前 diff`
  - Expected: `reviewer`, `explorer`, `read-only`, review-style confidence.

- API auth bug:
  - Task: `开启子代理，修复 API 鉴权问题`
  - Expected: `backend-developer` or `security-engineer` candidate set, `worker`, backend/security/debug skills.

- Tests:
  - Task: `开启子代理，补齐 pytest 覆盖率`
  - Expected: `test-automator`, `worker`, testing/debug skills.

- iOS UI:
  - Task: `开启子代理，修复 SwiftUI 页面布局`
  - Expected: iOS or Swift specialist candidate, iOS/frontend skills.

- DevOps:
  - Task: `开启子代理，修复 Docker 部署失败`
  - Expected: `deployment-engineer`, `devops-engineer`, or `docker-expert`.

- Unknown:
  - Task: `开启子代理，分析这个奇怪的产品问题`
  - Expected: low confidence, top 3 candidates, `needsParentChoice = true`, no false high-confidence claim.

## Acceptance Criteria

- Registry still loads all 167 VoltAgent agents.
- Routing each test task completes locally in under 250 ms on this machine.
- JSON output includes confidence, score breakdown, matched intents, skill reasons, and delegation prompt.
- Existing `route --json`, `list`, `prompt`, and `install-all` commands remain compatible.
- Skill guidance prevents automatic spawning on weak or ambiguous recommendations.
