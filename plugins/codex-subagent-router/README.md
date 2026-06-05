# Codex Subagent Router Plugin

This personal Codex plugin packages the v13 Subagent Router for local use. It provides the `subagent-router` skill plus the router CLI and metadata needed to choose VoltAgent agent identities, Codex skills, model tiers, sandbox modes, and staged handoff plans.

## What Is Included

- `skills/subagent-router/SKILL.md`: plugin skill instructions.
- `scripts/subagents/router.mjs`: v13 router CLI.
- `scripts/subagents/strategy-config.json`: taskKind, risk, skill, model, cache, and managed UX policy.
- `scripts/subagents/judgement.schema.json`: structured judgement schema.
- `scripts/subagents/community-skills-manifest.json`: community skill manifest.
- `scripts/subagents/registry.json`: VoltAgent agent registry snapshot.
- `assets/codex-subagent-router-hero.png`: plugin visual asset.

## Usage

After installing the plugin, start a new Codex thread and ask:

```text
开启子代理，调用合适 agent 完成任务
```

For direct local checks:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json "开启子代理，调用合适子代理，用 goal 模式持续实现"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs eval
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs doctor
```

## Global Sync

The plugin is self-contained. If you also want the router available through the global non-plugin path, sync these files:

```bash
mkdir -p ~/.codex/subagents ~/.codex/skills/subagent-router
cp scripts/subagents/* ~/.codex/subagents/
cp skills/subagent-router/SKILL.md ~/.codex/skills/subagent-router/SKILL.md
chmod +x ~/.codex/subagents/router.mjs
```
