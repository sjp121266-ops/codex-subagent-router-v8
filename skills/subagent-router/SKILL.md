---
name: subagent-router
description: Use when the user asks to enable subagents, 子代理, 子agent, 多代理, 调用代理, 自动选择 agent, or wants Codex to choose a suitable VoltAgent subagent identity and matching skills for a task.
---

# Subagent Router

Use this skill only after the user explicitly enables or asks for subagents, multi-agent work, agent routing, or automatic agent selection.

## Workflow

1. Run the cost-aware router:

```bash
$HOME/.codex/subagents/router.mjs judge --json "<task>"
```

The router is quality-first and cost-aware:
- It may skip a model judge only for low-risk, high-confidence, stable tasks with a clear candidate margin.
- It uses compact cheaper judgement for routine tasks when quality gates allow it.
- It keeps GPT-5.5 judgement for security, auth, privacy, compliance, architecture, production, incidents, migrations, high-risk reviews, ambiguous tasks, and multi-agent coordination.
- It bypasses cache for volatile current-context tasks such as current diff, logs, stack traces, file/line-specific failures, and test output.

2. Read the JSON result:
- `finalAgent` is the VoltAgent identity to use.
- `judgeMode` tells how the route was judged: `deterministic`, `mini-judge`, `standard-judge`, or `premium-judge`.
- `judgeModel` is the model used for routing judgement; `none` means the deterministic gate was sufficient.
- `costRationale` explains why the router spent or saved tokens.
- `candidateBudget` shows how many agent and skill candidates were sent to the judge.
- `cache` shows whether the routing decision came from cache, missed cache, or bypassed cache.
- `decisionTrace`, `qualityGates`, `rejectedCandidates`, and `skillRationale` explain the route. Inspect them for medium/high-risk tasks.
- `fallbackSafety`, `failureClass`, `requiresParentReview`, `delegationBlocked`, `approvalState`, and `routingWarnings` describe recovery behavior. If `requiresParentReview` or `delegationBlocked` is true, do not blindly spawn.
- `runtimeRole` maps to the Codex subagent role: `explorer` for read-only work, `worker` for write-capable work.
- `sandboxMode` is the requested sandbox boundary.
- `selectedModel` is the model to use for the spawned subagent.
- `reasoningEffort` is the reasoning effort to use for the spawned subagent.
- `importanceLevel` explains whether the task is `critical`, `high`, `normal`, or `low`.
- `modelRationale` explains why that model and effort were selected.
- `taskProfile` summarizes complexity, risk, scope, write intent, and matched signals.
- `executionPlan` tells whether to use one agent, staged execution, parallel review, or clarification first.
- `executionPlan.stageDetails` gives executable stage details when available: agent, role, sandbox, model, reasoning, skills, expected output, and acceptance criteria.
- `handoffPlan` is the preferred multi-agent delegation plan. Follow its `stages` in order unless local context makes a stage unsafe.
- `selectedSkills` lists Codex skills chosen by GPT-5.5 from the candidate set.
- `selectedSkillsByPhase` groups chosen skills by planning/research/implementation/debugging/testing/review/deployment.
- `confidence` is `high`, `medium`, or `low`.
- `needsParentChoice` means the parent agent should inspect `candidates` and local context before spawning.
- `rationale` explains why GPT-5.5 selected the route.
- `riskNotes` highlights routing or execution cautions.
- `deterministic` contains the local deterministic fallback route and candidates.
- `delegationPrompt` is the prompt to pass to the spawned subagent.

3. If `modelUsed` is `false`, inspect `judgeMode`:
- `deterministic` with high confidence is an intentional token-saving route for safe tasks.
- Any `modelError` means the model judge failed and the result is a fallback. You may still use it when confidence is high, but mention the fallback if routing quality matters.

4. If `confidence` is `low`, `needsParentChoice` is `true`, `delegationBlocked` is `true`, `approvalState` is `required`, or `executionPlan.requiresUserClarification` is `true`, do not blindly spawn the recommended agent. Use `deterministic.candidates`, `rationale`, fallback metadata, and local context to choose one. If the task is still ambiguous or fallback safety is conservative, ask one concise clarification question or retry the route.

5. Load selected skills that directly match the task before delegating. Prefer skills for the current `executionPlan` stage first: planning/research before implementation, testing before review, review last.
Community skills installed under `community-*` are allowed and should be treated as normal Codex skills. They come from curated GitHub skill repositories and are selected through the same cost-aware router path.
When `judgeMode` is not `premium-judge`, still trust `selectedSkills` if confidence is high and the task is low/normal risk. For high-risk work, prefer `premium-judge` results.

6. Follow `executionPlan.mode`:
- `single-agent`: spawn the selected agent once.
- `staged`: run the listed stages in order; usually explorer/planner, then worker, then tests/review.
- `parallel-review`: spawn the worker and an independent reviewer when write scopes do not overlap.
- `clarify-first`: ask before spawning.
- `parent-review-required`: stop automatic delegation; the parent Codex must inspect fallback safety and either retry or manually approve a safer route.

When `handoffPlan.stages` exists, use it as the concrete execution checklist:
- load each stage's listed `skills` before that stage;
- use each stage's `agent`, `role`, `sandboxMode`, `selectedModel`, and `reasoningEffort`;
- treat `acceptanceCriteria` as the stage completion check;
- for `clarify-first`, ask `handoffPlan.clarificationQuestion` before spawning.

7. Spawn the subagent:
- Use `explorer` when `runtimeRole` is `explorer`.
- Use `worker` when `runtimeRole` is `worker`.
- Pass `selectedModel` to the subagent spawn tool when it accepts model overrides.
- Pass `reasoningEffort` to the subagent spawn tool when it accepts reasoning effort overrides.
- Pass `delegationPrompt` as the subagent task.

8. If the current environment cannot spawn custom-named agents directly, still use the chosen VoltAgent identity by injecting `delegationPrompt` into the generic Codex `explorer` or `worker`.

## Offline Fallback

For fast local checks or when model judgement is unavailable:

```bash
$HOME/.codex/subagents/router.mjs judge --offline --json "<task>"
```

## CLI Fallback

When a task needs stronger process isolation than the current chat subagent tool provides, avoid pasting raw `delegationPrompt` text directly into a shell command. Prefer writing the prompt to a temporary file first:

```bash
prompt_file="$(mktemp)"
jq -r '.delegationPrompt' route.json > "$prompt_file"
codex exec --sandbox "<sandboxMode>" -m "<selectedModel>" -c model_reasoning_effort='"<reasoningEffort>"' "$(cat "$prompt_file")"
rm -f "$prompt_file"
```

Use `selectedModel` and `reasoningEffort` from the judgement result. Do not use unsupported model names from upstream `.toml`.

## Budget Controls

Default is balanced:

```bash
$HOME/.codex/subagents/router.mjs judge --json --budget balanced "<task>"
```

Use `--budget economy` only for obvious low-risk tasks. Use `--budget premium` or `--budget critical` when the user explicitly asks for maximum quality or when local context suggests high downside. Use `--no-cache` when the task depends on fresh repository state. Use `--force-model` when deterministic routing should be bypassed for comparison.

## Maintenance

Use these checks after changing agents, skills, strategy config, schemas, or router logic:

```bash
$HOME/.codex/subagents/router.mjs test
$HOME/.codex/subagents/router.mjs eval
$HOME/.codex/subagents/router.mjs test-recovery
$HOME/.codex/subagents/router.mjs test-handoff
$HOME/.codex/subagents/router.mjs test-skill-repair
$HOME/.codex/subagents/router.mjs doctor
$HOME/.codex/subagents/router.mjs report
```

Use `judge --explain "<task>"` when you need a human-readable explanation of the routing decision.

## Guardrails

- Do not auto-delegate unless the user explicitly asked for subagents or multi-agent routing.
- Keep the main agent responsible for final integration, review, and user-facing summary.
- For write-capable workers, assign a clear file or subsystem ownership boundary.
- Do not let subagents overwrite unrelated user changes.
- Prefer `high` confidence routes for autonomous spawning. Treat `medium` as acceptable when local context confirms the route. Treat `low` as a candidate list, not a decision.
- Treat `parent-review-required` as a hard stop for automatic delegation.
- Never downgrade `critical` or `high` importance work to a cheaper execution model. Important work should normally use `gpt-5.5` for both routing judgement and delegated execution.
- Saving tokens is allowed only when the result quality and risk profile remain acceptable.
