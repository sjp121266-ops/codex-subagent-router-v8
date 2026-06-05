# Subagent Router v3 GPT-5.5 Test Report

## Summary

Router v3 is implemented and verified. The default subagent-router skill now uses `gpt-5.5` as a structured routing judge.

## Implemented

- Added `judge` command for GPT-5.5 model-assisted routing.
- Added `judge --offline` deterministic fallback with the same output shape.
- Added `test-judge` real GPT-5.5 smoke test.
- Added JSON schema at `$HOME/.codex/subagents/judgement.schema.json`.
- Updated `$HOME/.codex/skills/subagent-router/SKILL.md` to use `judge --json` by default.
- Moved preserved duplicate agent backups out of `$HOME/.codex/agents` to avoid duplicate role warnings.

## Verification

```bash
node --check $HOME/.codex/subagents/router.mjs
$HOME/.codex/subagents/router.mjs test
$HOME/.codex/subagents/router.mjs judge --offline --json "开启子代理，审查当前 diff"
$HOME/.codex/subagents/router.mjs test-judge
```

## Results

- Deterministic regression tests: 7/7 passed in 16 ms
- Offline judgement shape: valid
- Duplicate agent filenames under active agents dir: none
- Real GPT-5.5 smoke test: passed

GPT-5.5 smoke test result:

```json
{
  "pass": true,
  "modelUsed": true,
  "modelError": null,
  "finalAgent": "reviewer",
  "runtimeRole": "explorer",
  "sandboxMode": "read-only",
  "confidence": "high"
}
```

## Operational Notes

- GPT-5.5 judgement only selects routing. It does not inspect files, spawn agents, or execute the task.
- The model can only choose from local deterministic candidate agents and skill candidates.
- If model judgement fails, the router falls back to deterministic output and marks `modelUsed = false`.
- Vague tasks should keep `confidence = low` and `needsParentChoice = true`.
