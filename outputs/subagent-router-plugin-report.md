# Codex Subagent Router Plugin Report

## Summary

The v13 Subagent Router has been packaged as a personal Codex plugin named `codex-subagent-router`.

## Local Plugin

- Source path: `~/plugins/codex-subagent-router`
- Marketplace: `~/.agents/plugins/marketplace.json`
- Installed version: `0.1.0+codex.20260605175916`
- Installed cache path: `~/.codex/plugins/cache/personal/codex-subagent-router/0.1.0+codex.20260605175916`

## Repository Sync

- Repository package path: `plugins/codex-subagent-router/`
- Included plugin files:
  - `.codex-plugin/plugin.json`
  - `skills/subagent-router/SKILL.md`
  - `scripts/subagents/router.mjs`
  - `scripts/subagents/strategy-config.json`
  - `scripts/subagents/judgement.schema.json`
  - `scripts/subagents/community-skills-manifest.json`
  - `scripts/subagents/registry.json`
  - `assets/codex-subagent-router-hero.png`

## Verification

- Plugin validation passed.
- Plugin router `test` passed, 16/16.
- Plugin router `eval` passed, 112/112.
- Plugin router `test-agent-roster` passed.
- Plugin router `test-managed-readiness` passed.
- Plugin router `doctor` passed.
- `codex plugin list` shows `codex-subagent-router@personal` installed and enabled.

## Usage

Start a new Codex thread after install and say:

```text
开启子代理，调用合适 agent 完成任务
```
