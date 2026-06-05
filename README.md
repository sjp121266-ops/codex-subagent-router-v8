# Codex Subagent Router

Quality-first Codex subagent routing built around VoltAgent agent identities, Codex skills, community skills, model selection, recovery, and multi-agent handoff planning.

## What Is Included

- `subagents/router.mjs`: main router CLI.
- `subagents/strategy-config.json`: intent, skill, cost, cache, and candidate budget policy.
- `subagents/judgement.schema.json`: structured model judgement schema.
- `subagents/community-skills-manifest.json`: imported community skill manifest.
- `subagents/registry.json`: generated VoltAgent agent registry snapshot.
- `skills/subagent-router/SKILL.md`: global Codex skill instructions.
- `outputs/`: implementation plans and verification reports.

## Install Into Codex

From this repository root:

```bash
mkdir -p ~/.codex/subagents ~/.codex/skills/subagent-router
cp subagents/router.mjs ~/.codex/subagents/router.mjs
cp subagents/strategy-config.json ~/.codex/subagents/strategy-config.json
cp subagents/judgement.schema.json ~/.codex/subagents/judgement.schema.json
cp subagents/community-skills-manifest.json ~/.codex/subagents/community-skills-manifest.json
cp subagents/registry.json ~/.codex/subagents/registry.json
cp skills/subagent-router/SKILL.md ~/.codex/skills/subagent-router/SKILL.md
chmod +x ~/.codex/subagents/router.mjs
```

## Verify

```bash
node --check subagents/router.mjs
node subagents/router.mjs test
node subagents/router.mjs eval
node subagents/router.mjs test-recovery
node subagents/router.mjs test-handoff
node subagents/router.mjs doctor
node subagents/router.mjs report
```

For high-risk routing smoke tests, use the installed path so Codex CLI paths match the local environment:

```bash
~/.codex/subagents/router.mjs test-judge
```

## Current Result

The v8 final verification passed:

- 16/16 regression tests.
- 52/52 eval cases.
- recovery tests passed.
- handoff tests passed.
- doctor/report passed.
- GPT-5.5 quality gate smoke test passed.

See `outputs/subagent-router-v8-final-report.md` for the full status.
