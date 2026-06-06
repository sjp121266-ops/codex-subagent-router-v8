# Codex Subagent Router Plugin

This personal Codex plugin packages the v16 Subagent Router for local use. It provides the `subagent-router` skill plus the router CLI and metadata needed to choose VoltAgent and Agency agent identities, Codex skills, model tiers, sandbox modes, execution adapters, staged handoff plans, and budgeted prompt hydration.

## What Is Included

- `skills/subagent-router/SKILL.md`: plugin skill instructions.
- `scripts/subagents/router.mjs`: v16 router CLI.
- `scripts/subagents/strategy-config.json`: taskKind, risk, skill, model, cache, and managed UX policy.
- `scripts/subagents/judgement.schema.json`: structured judgement schema.
- `scripts/subagents/community-skills-manifest.json`: community skill manifest.
- `scripts/subagents/registry.json`: VoltAgent agent registry snapshot.
- `scripts/subagents/agency-agents/`: bundled `msitarzewski/agency-agents` catalog, compact agent-card index, and prompt bodies.
- `assets/codex-subagent-router-hero.png`: plugin visual asset.

## Execution Adapter

Native custom-name agent spawning depends on the current Codex host. When direct spawning by a provider identity is unavailable, the router uses `executionAdapter.mode = "generic-role-bridge"` and tells Codex to run the selected identity through the generic `explorer` or `worker` role with `delegationPrompt` injected. This keeps the chosen agent identity, skills, model, sandbox, stages, and quality gates intact while changing only the transport layer.

Agency agents are prompt-pack specialists. Their prompts are role/methodology guidance only; Codex system instructions, AGENTS.md, sandbox rules, approval rules, and parent verification remain authoritative. v16 does not paste full Agency prompts into normal managed output. It returns `dispatchPromptRef`, `compactRoleCard`, `promptHydrationPlan`, and `contextLedger`; full hydration is explicit.

## Usage

After installing the plugin, start a new Codex thread and ask:

```text
开启子代理，调用合适 agent 完成任务
```

For direct local checks:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，调用合适子代理，用 goal 模式持续实现"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs inspect-context "开启子代理，帮我做 Reddit 社区增长策略"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs prompt agency:reddit-community-builder "帮我做 Reddit 社区增长策略" --hydrate summary --budget 2000
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs eval
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-agency-provider
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-provider-routing
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-provider-dispatch
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-agent-index
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-prompt-hydration
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-context-budget
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-execution-adapter
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs doctor
```

Provider examples:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，帮我做 Reddit 社区增长策略"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，只读分析产品 adoption 下降原因，不要改代码"
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，审查 API 鉴权漏洞"
```

`report` should show 351 agents in the tested bundle: 167 VoltAgent and 184 Agency.

## Global Sync

The plugin is self-contained. If you also want the router available through the global non-plugin path, sync these files:

```bash
mkdir -p ~/.codex/subagents ~/.codex/skills/subagent-router
cp scripts/subagents/router.mjs ~/.codex/subagents/router.mjs
cp scripts/subagents/strategy-config.json ~/.codex/subagents/strategy-config.json
cp scripts/subagents/judgement.schema.json ~/.codex/subagents/judgement.schema.json
cp scripts/subagents/community-skills-manifest.json ~/.codex/subagents/community-skills-manifest.json
cp scripts/subagents/registry.json ~/.codex/subagents/registry.json
rm -rf ~/.codex/subagents/agency-agents
cp -R scripts/subagents/agency-agents ~/.codex/subagents/agency-agents
cp skills/subagent-router/SKILL.md ~/.codex/skills/subagent-router/SKILL.md
chmod +x ~/.codex/subagents/router.mjs
```
