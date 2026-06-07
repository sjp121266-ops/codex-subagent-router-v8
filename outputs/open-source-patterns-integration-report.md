# Open-source orchestration patterns integration report

Generated: 2026-06-07

## Goal

Continue improving `codex-subagent-router` by learning from mature open-source multi-agent projects and integrating reusable design ideas into the plugin without copying upstream code.

## Studied Projects

- LangGraph Supervisor: supervisor node, handoff tool, multi-agent control, and message history control.
- CrewAI: Agent / Task / Process separation, crew-level process selection, and user-readable work decomposition.
- Microsoft AutoGen: layered multi-agent architecture, AgentChat/Core/Extensions separation, and conversation-oriented collaboration.
- OpenAI Agents / Swarm patterns: handoffs, guardrails, tracing, and lightweight coordination concepts.

Sources consulted:

- https://github.com/langchain-ai/langgraph-supervisor
- https://github.com/crewAIInc/crewAI
- https://github.com/microsoft/autogen
- https://github.com/openai/openai-agents-python
- https://github.com/openai/swarm

Only general design ideas were absorbed. No external project code was copied.

## Implemented Plugin Capability

Added `openSourcePatterns` to managed delegation plans. It is a compact orchestration design-hint layer that helps parent Codex and users understand why the plan is structured the way it is.

New managed fields:

- `openSourcePatterns.version`
- `openSourcePatterns.designSources`
- `openSourcePatterns.selectedPatterns`
- `openSourcePatterns.contextPolicy`
- `openSourcePatterns.guardrailPlan`
- `openSourcePatterns.tracePlan`
- `displayBoard.patternPanel`

Selected pattern catalog:

- `agent-task-process`: separates agent roles, task stages, and process flow.
- `guarded-handoff`: makes every stage handoff evidence-based.
- `context-window-control`: keeps context bounded and avoids raw internal fields.
- `supervisor-review`: makes high-risk or fallback review visible.
- `parallel-batch-join`: allows independent batches, then parent-level merge.
- `read-only-sandbox`: prevents write-capable stages for audit/research/credential tasks.

## Why This Helps

Before this change, the router already produced strong planning-board data, but the coordination rationale was implicit. Users and parent Codex could see stages and contracts, but not the underlying orchestration pattern.

After this change:

- Users can see a concise App board pattern panel.
- Parent Codex gets explicit context, guardrail, and trace guidance.
- Compact JSON remains bounded and avoids raw candidate scoring, cache keys, and full provider prompts.
- High-risk and read-only routes get pattern-specific safeguards.

## Example Shape

```json
{
  "openSourcePatterns": {
    "version": "v18-open-source-patterns",
    "selectedPatterns": [
      { "id": "agent-task-process", "label": "Agent / Task / Process 分离" },
      { "id": "guarded-handoff", "label": "带守卫的交接" },
      { "id": "context-window-control", "label": "上下文窗口控制" }
    ],
    "contextPolicy": {
      "mode": "stage-output-only"
    },
    "tracePlan": {
      "workflowName": "sinan-orchestration-design-supervisor-review"
    }
  }
}
```

## Verification

New command:

```bash
node subagents/router.mjs test-open-source-patterns
```

Representative coverage:

- Sequential/supervisor route includes `agent-task-process`, `guarded-handoff`, and `context-window-control`.
- Parallel batch route includes `parallel-batch-join`.
- Read-only credential audit includes `read-only-sandbox` and no implementer.
- High-risk auth incident includes `supervisor-review`.

Validated in this implementation pass:

```bash
node --check subagents/router.mjs
node subagents/router.mjs test-open-source-patterns
node subagents/router.mjs test-managed-contract
node subagents/router.mjs test-architecture
node subagents/router.mjs test-app-board
node subagents/router.mjs test-config
node subagents/router.mjs eval
node subagents/router.mjs doctor
node plugins/codex-subagent-router/scripts/subagents/router.mjs test-open-source-patterns
node plugins/codex-subagent-router/scripts/subagents/router.mjs test-architecture
```

## Remaining Work

- Move the pattern catalog out of `router.mjs` into a dedicated `contracts/orchestration-patterns.mjs` module.
- Add a formal managed-plan JSON Schema including `openSourcePatterns`.
- Add route trace artifact export using `tracePlan.events` with redaction.
- Add a release sync command so plugin mirrors are updated without manual copy.
