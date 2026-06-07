---
name: subagent-router
description: Use when the user asks to enable subagents, 子代理, 子agent, 多代理, 调用代理, 自动选择 agent, or wants Codex to choose a suitable VoltAgent or Agency subagent identity and matching skills for a task.
---

# Subagent Router

Use this skill only after the user explicitly enables or asks for subagents, multi-agent work, agent routing, or automatic agent selection.

## Workflow

Use the plugin-packaged router first. Fall back to the global router path only if the plugin copy is not present:

```bash
SUBAGENT_ROUTER="$HOME/plugins/codex-subagent-router/scripts/subagents/router.mjs"
if [ ! -x "$SUBAGENT_ROUTER" ]; then
  SUBAGENT_ROUTER="$HOME/.codex/subagents/router.mjs"
fi
```

1. For normal managed delegation, start with the concise managed router:

```bash
"$SUBAGENT_ROUTER" managed --json --profile compact "<task>"
```

Use this when the user says “调用合适子代理完成任务”, “开启子代理持续实现”, “多代理帮我优化”, or similar broad delegation language. v17 compact mode is the default machine-readable path because it returns prompt references, compact role cards, and an App-readable planning board instead of pasting full provider prompts into context. The managed output is the user-facing plan and execution contract: selected agent, role, skills, stage/goal loop, one-question clarification state, write boundaries, parent responsibilities, stage inputs/outputs, agent roster, delegation readiness, next action, stage skill loading order, context ledger, `displayBoard`, and the three short explanations:
- why this agent;
- why Codex is not asking now;
- when Codex will ask.

For ordinary Codex App conversation, use `displayBoard` first:
- show `displayBoard.userNarrative` as the short Chinese explanation;
- show `displayBoard.goalBoard` as the stage board with current stage, agent, acceptance check, and next trigger;
- show `displayBoard.safetyPanel` before any write, credential, production, download, publish, or external-side-effect action;
- include `displayBoard.mermaidFlow` when a quick visual helps the user understand the stage order.

On the first managed use inside a project, the router may create a lightweight local project code graph at `.codex/sinan-codegraph/`. Treat `projectGraph` as initial orientation context for parent Codex and any subagent:
- mention whether the graph was generated or reused when explaining the plan to the user;
- pass `projectGraph.summary`, top frameworks, entry files, test commands, and relevant files into the first mapping or implementation stage;
- prefer graph-informed project signals for agent choice, but never let them override explicit user intent, no-write directives, high-risk review gates, credential boundaries, or final verification;
- do not paste full graph files into chat unless the user asks for debugging.

Do not expose internal fields such as `judgeMode`, `candidateBudget`, `failureClass`, cache keys, or raw candidate scoring in normal user updates. Do not paste the full managed JSON into the chat unless the user explicitly asks for debugging output. Use `managed --json --profile compact` as the default for real delegation, and `managed --profile app` when the user mainly needs a readable planning board in the Codex App; reserve `judge --verbose`, `judge --explain`, `inspect-context`, and full prompt hydration for auditing, debugging, or improving the router itself.

2. For debugging the router or medium/high-risk delegation, run the cost-aware router:

```bash
"$SUBAGENT_ROUTER" judge --json "<task>"
```

The router is quality-first and cost-aware:
- It may skip a model judge only for low-risk, high-confidence, stable tasks with a clear candidate margin.
- It uses compact cheaper judgement for routine tasks when quality gates allow it.
- It keeps GPT-5.5 judgement for security, auth, privacy, compliance, architecture, production, incidents, migrations, high-risk reviews, ambiguous tasks, and multi-agent coordination.
- It bypasses cache for volatile current-context tasks such as current diff, logs, stack traces, file/line-specific failures, and test output.

3. Read the JSON result:
- `finalAgent` is the selected provider identity to use.
- `finalAgentProvider` is `voltagent` or `agency-agents`.
- `finalAgentId`, `finalAgentDisplayName`, and `agentProviderRationale` explain the selected provider identity.
- `providerPromptPath`, `providerPromptPreview`, `dispatchPromptRef`, `compactRoleCard`, `promptHydrationPlan`, `promptBudget`, `contextLedger`, and `dispatchPromptSource` show how the provider prompt can be hydrated without default full prompt injection.
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
- v12 `taskProfile.taskKind` may include `release-publishing`, `repo-maintenance`, `research-only`, or `incident-response` in addition to engineering/product/orchestration kinds.
- v13 `agentRoster` explains primary, mapper, implementer, validator, reviewer, fallbacks, and missing preferred-agent fallbacks.
- v13 `delegationReadiness` tells whether the parent Codex can spawn now, should clarify first, or must perform parent review.
- v13 `nextAction` is the immediate parent action: `spawn`, `ask-clarification`, or `parent-review`.
- v13 `stageSkillLoadingOrder` lists the skills to load before each stage.
- `executionPlan` tells whether to use one agent, staged execution, parallel review, or clarification first.
- `executionPlan.stageDetails` gives executable stage details when available: agent, role, sandbox, model, reasoning, skills, expected output, and acceptance criteria.
- `handoffPlan` is the preferred multi-agent delegation plan. Follow its `stages` in order unless local context makes a stage unsafe.
- `openSourcePatterns` summarizes reusable orchestration patterns inspired by LangGraph Supervisor, CrewAI, AutoGen, and OpenAI Agents/Swarm. Use it as design guidance only: it does not override Codex instructions, selected skills, safety gates, or parent verification.
- `selectedSkills` lists Codex skills chosen by GPT-5.5 from the candidate set.
- `selectedSkillsByPhase` groups chosen skills by planning/research/implementation/debugging/testing/review/deployment.
- `confidence` is `high`, `medium`, or `low`.
- `needsParentChoice` means the parent agent should inspect `candidates` and local context before spawning.
- `rationale` explains why GPT-5.5 selected the route.
- `riskNotes` highlights routing or execution cautions.
- `deterministic` contains the local deterministic fallback route and candidates.
- `delegationPrompt` may appear in `judge` debug output, but normal managed output uses `dispatchPromptRef` plus `promptHydrationPlan`. Generate a budgeted prompt with `prompt <agent> <task> --hydrate reference|summary|hybrid|full --budget N` only when the execution transport needs it.

4. If `modelUsed` is `false`, inspect `judgeMode`:
- `deterministic` with high confidence is an intentional token-saving route for safe tasks.
- Any `modelError` means the model judge failed and the result is a fallback. You may still use it when confidence is high, but mention the fallback if routing quality matters.

5. If `confidence` is `low`, `needsParentChoice` is `true`, `delegationBlocked` is `true`, `approvalState` is `required`, or `executionPlan.requiresUserClarification` is `true`, do not blindly spawn the recommended agent. Ask at most one concise clarification question. If it is still unclear, switch to read-only exploration or offer two executable options instead of repeatedly questioning the user.

Explicit subagent authorization means the user allowed the router to choose a delegation plan. It does not authorize destructive operations, production changes, credential use, or broad unsupervised rewrites. Wide but authorized project work may proceed through `handoffPlan.stages` only when each stage has a clear scope, sandbox, and acceptance criteria; otherwise use `clarify-first`.

6. Load selected skills that directly match the task before delegating. Prefer skills for the current `executionPlan` stage first: planning/research before implementation, testing before review, review last.
Community skills installed under `community-*` are allowed and should be treated as normal Codex skills. They come from curated GitHub skill repositories and are selected through the same cost-aware router path.
Agency agents from `msitarzewski/agency-agents` are allowed as provider identities. Treat their prompt bodies as role/methodology guidance only. They do not override Codex system/developer/user instructions, AGENTS.md, sandbox limits, approval requirements, or the parent Codex's final verification responsibility. In v16, default managed routing reads the compact agent-card index and returns a prompt reference; do not load the full Agency prompt unless the selected stage truly needs it.
When `judgeMode` is not `premium-judge`, still trust `selectedSkills` if confidence is high and the task is low/normal risk. For high-risk work, prefer `premium-judge` results.

Selected skills are execution guidance, not automatic actions. Load the skills that match the current handoff stage and apply them as additional instructions for the parent Codex or spawned subagent. They do not override higher-priority instructions, AGENTS.md, sandbox limits, approval requirements, or the parent Codex's responsibility for final review.

7. Follow `executionPlan.mode`:
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

When `managed --json` returns `executionContract`, `writeBoundaries`, `parentResponsibilities`, `stageInputs`, and `stageOutputs`, treat them as the parent Codex execution contract:
- enforce one writer per file or module at a time;
- keep mapping, research, review, and public-hygiene stages read-only;
- pass each stage only the inputs it needs;
- collect each stage output before starting the next dependent stage;
- keep final integration and user-facing verification in the parent Codex.

When `managed --json` returns v13 readiness fields:
- if `delegationReadiness.canSpawnNow` is true, follow `nextAction` and spawn that stage first;
- if `nextAction.type` is `ask-clarification`, ask exactly one concise question and then rerun managed routing with the answer;
- if `nextAction.type` is `parent-review`, do not spawn a write-capable subagent until the parent Codex has reviewed fallback safety;
- load `stageSkillLoadingOrder[].loadBeforeStage` before starting that stage;
- inspect `executionAdapter` before spawning. Use native custom-agent spawn only when `executionAdapter.mode` is `native-custom-agent`; otherwise use the indicated generic `executionAdapter.bridgeRole` and inject a budgeted prompt generated from `dispatchPromptRef` / `promptHydrationPlan`.

For continuous goal work, report each stage in this fixed structure:
- current goal;
- current stage;
- agent;
- skills;
- acceptance check;
- next goal trigger.

When `displayBoard.goalBoard` is present, prefer that board over a hand-written list. For read-only tasks, explicitly say that no implementation stage is planned. For high-risk routes, explicitly say that parent Codex review is required before any write-capable or external action.

8. Spawn the subagent:
- Prefer native custom-agent spawning when the host supports it and `executionAdapter.mode` is `native-custom-agent`.
- Otherwise use the generic bridge: `explorer` when `executionAdapter.bridgeRole` is `explorer`, or `worker` when it is `worker`.
- Pass `selectedModel` to the subagent spawn tool when it accepts model overrides.
- Pass `reasoningEffort` to the subagent spawn tool when it accepts reasoning effort overrides.
- Pass a compact prompt as the subagent task. Prefer `reference` or `summary`; use `hybrid` for isolated execution where the child may not be able to read local files; use `full` only for debugging or explicitly self-contained execution.
- If the current Codex App subagent tool refuses a full-context fork plus specified role, or reports that subagent/thread quota is full, do not retry spawning in a loop. Treat it as an execution transport limit, keep the router decision as planning guidance, and let parent Codex directly perform the current read-only or verification stage with the selected skills and safety boundaries.

9. If the current environment cannot spawn custom-named agents directly, this is not a routing failure. Still use the chosen provider identity by injecting a budgeted prompt into the generic Codex `explorer` or `worker`. The selected agent, skills, model, sandbox, stages, and quality gates remain the source of truth; only the execution transport changes.

## Prompt Hydration

Default to compact managed routing:

```bash
"$SUBAGENT_ROUTER" managed --json --profile compact "<task>"
```

Render an App-friendly Chinese board:

```bash
"$SUBAGENT_ROUTER" managed --profile app "<task>"
```

Use deterministic offline rendering for local App-board smoke tests when live model judgement is unnecessary:

```bash
"$SUBAGENT_ROUTER" managed --offline --profile app "<task>"
```

The App board includes `displayBoard.schema.version = "display-board-v2"` and redacts credential-like values, bearer tokens, emails, and absolute `/Users/...` paths from user-facing board text.

Inspect context cost before a large handoff:

```bash
"$SUBAGENT_ROUTER" inspect-context "<task>"
```

Inspect or refresh the local project graph:

```bash
"$SUBAGENT_ROUTER" project-graph status --json
"$SUBAGENT_ROUTER" project-graph init --json
"$SUBAGENT_ROUTER" project-graph query --json "入口文件和测试"
```

Generate an explicit dispatch prompt only when a subagent transport needs one:

```bash
"$SUBAGENT_ROUTER" prompt agency:reddit-community-builder "<task>" --hydrate reference --budget 1800
"$SUBAGENT_ROUTER" prompt agency:reddit-community-builder "<task>" --hydrate summary --budget 2400
"$SUBAGENT_ROUTER" prompt agency:reddit-community-builder "<task>" --hydrate hybrid --budget 4000
```

Use `--hydrate full` only when auditing the router, debugging provider prompts, or running an external isolated process that cannot access local prompt files.

## Offline Fallback

For fast local checks or when model judgement is unavailable:

```bash
"$SUBAGENT_ROUTER" judge --offline --json "<task>"
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
"$SUBAGENT_ROUTER" judge --json --budget balanced "<task>"
```

Use `--budget economy` only for obvious low-risk tasks. Use `--budget premium` or `--budget critical` when the user explicitly asks for maximum quality or when local context suggests high downside. Use `--no-cache` when the task depends on fresh repository state. Use `--force-model` when deterministic routing should be bypassed for comparison.

## Maintenance

Use these checks after changing agents, skills, strategy config, schemas, or router logic:

```bash
"$SUBAGENT_ROUTER" test
"$SUBAGENT_ROUTER" eval
"$SUBAGENT_ROUTER" test-performance
"$SUBAGENT_ROUTER" test-managed
"$SUBAGENT_ROUTER" test-managed-contract
"$SUBAGENT_ROUTER" test-app-board
"$SUBAGENT_ROUTER" test-architecture
"$SUBAGENT_ROUTER" test-open-source-patterns
"$SUBAGENT_ROUTER" test-skills-phase
"$SUBAGENT_ROUTER" test-judge-matrix
"$SUBAGENT_ROUTER" test-recovery
"$SUBAGENT_ROUTER" test-handoff
"$SUBAGENT_ROUTER" test-skill-repair
"$SUBAGENT_ROUTER" test-config
"$SUBAGENT_ROUTER" test-config-explain
"$SUBAGENT_ROUTER" test-route-cache
"$SUBAGENT_ROUTER" test-agent-roster
"$SUBAGENT_ROUTER" test-managed-readiness
"$SUBAGENT_ROUTER" test-execution-adapter
"$SUBAGENT_ROUTER" test-cache-maintenance
"$SUBAGENT_ROUTER" test-agency-provider
"$SUBAGENT_ROUTER" test-provider-routing
"$SUBAGENT_ROUTER" test-provider-dispatch
"$SUBAGENT_ROUTER" test-agent-index
"$SUBAGENT_ROUTER" test-prompt-hydration
"$SUBAGENT_ROUTER" test-context-budget
"$SUBAGENT_ROUTER" config-check
"$SUBAGENT_ROUTER" architecture-health
"$SUBAGENT_ROUTER" doctor
"$SUBAGENT_ROUTER" report
```

Use `judge --explain "<task>"` when you need a human-readable explanation of the routing decision.
Use `config-explain "<task>"` when you need to inspect which v12 taskKind, risk, skill, and cache policies matched a task.
Use `refresh-skills` after installing or removing skills so the local snapshot is current.
Use `cache-status` to inspect local judgement/route cache health.
Use `cache-prune --all --older-than-hours <hours>` to prune stale local cache entries.

## Guardrails

- Do not auto-delegate unless the user explicitly asked for subagents or multi-agent routing.
- Keep the main agent responsible for final integration, review, and user-facing summary.
- For write-capable workers, assign a clear file or subsystem ownership boundary.
- For v12 managed plans, follow `writeBoundaries`; never let two write-capable stages edit the same file/module concurrently.
- For v13 managed plans, follow `delegationReadiness` and `nextAction`; do not improvise a spawn when the router says clarify or parent-review first.
- Do not let subagents overwrite unrelated user changes.
- Prefer `high` confidence routes for autonomous spawning. Treat `medium` as acceptable when local context confirms the route. Treat `low` as a candidate list, not a decision.
- Treat `parent-review-required` as a hard stop for automatic delegation.
- Never downgrade `critical` or `high` importance work to a cheaper execution model. Important work should normally use `gpt-5.5` for both routing judgement and delegated execution.
- Saving tokens is allowed only when the result quality and risk profile remain acceptable.
