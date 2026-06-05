# Subagent Router v3 GPT-5.5 Judgement Plan

## Goal

Upgrade the router from deterministic-only selection to a hybrid system where local rules shortlist agents and skills, then `gpt-5.5` makes the final structured judgement.

## Architecture

- Deterministic layer:
  - Classifies task intent.
  - Scores all 167 VoltAgent agents.
  - Produces a compact shortlist of agent candidates and skill candidates.
  - Stays fast and works offline as fallback.

- GPT-5.5 judgement layer:
  - Receives only the task, matched intents, top agent candidates, top skill candidates, and deterministic recommendation.
  - Chooses the final agent, runtime role, sandbox mode, and skills.
  - Returns strict JSON through `codex exec --output-schema`.
  - Does not inspect files, mutate state, spawn subagents, or execute the user task.

- Parent Codex layer:
  - Uses the judgement result to spawn `explorer` or `worker`.
  - Loads selected skills when relevant.
  - Keeps ownership of final integration and user-facing summary.

## Commands

- `route <task>`:
  - Existing deterministic v2 route.

- `judge <task>`:
  - Runs deterministic shortlist, then asks `gpt-5.5` for final selection.
  - Returns model judgement plus deterministic fallback.

- `judge --json <task>`:
  - Strict machine-readable output.

- `judge --offline <task>`:
  - Uses deterministic route only but returns the v3 judgement shape.

- `test`:
  - Keeps fast offline regression tests.

- `test-judge`:
  - Runs one real `gpt-5.5` smoke test with schema validation.

## Judgement Rules

GPT-5.5 must:

- Choose only from provided agent candidates.
- Choose skills only from provided skill candidates.
- Prefer narrow specialists over generic agents when the task is specific.
- Prefer `explorer` and read-only agents for review/research/audit tasks.
- Prefer `worker` and workspace-write agents for implementation/fix/test-writing tasks.
- Mark vague tasks as `low` confidence and `needsParentChoice = true`.
- Explain the decision in short, operational reasons.

## Safety

- Model judgement runs with `codex exec --sandbox read-only --ephemeral --skip-git-repo-check`.
- Output is schema-constrained JSON.
- If model judgement fails, router falls back to deterministic v2 and marks `modelUsed = false`.
- The model judgement prompt explicitly forbids executing or solving the user task.

## Acceptance Criteria

- Existing v2 route/test commands still pass.
- `judge --offline` returns the same top-level v3 fields without calling a model.
- `judge --json` returns valid JSON with:
  - `finalAgent`
  - `runtimeRole`
  - `sandboxMode`
  - `selectedSkills`
  - `confidence`
  - `needsParentChoice`
  - `rationale`
  - `delegationPrompt`
  - `modelUsed`
- `test-judge` successfully calls `gpt-5.5` once and validates the JSON result.
