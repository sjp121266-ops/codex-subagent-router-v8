# Subagent Router v15 Agency Agents Integration Plan

## Goal

Integrate `msitarzewski/agency-agents` as a second agent provider for Codex Subagent Router so the router can choose between VoltAgent identities and Agency prompt-pack specialists through one managed delegation surface.

## Scope

- Keep VoltAgent as the existing engineering-first provider.
- Add Agency agents as provider-prefixed identities such as `agency:reddit-community-builder`.
- Treat Agency prompts as role and methodology guidance only.
- Preserve high-risk quality gates: security, auth, production, incident, current diff, and ambiguous high-risk work continue to use GPT-5.5 judgement and parent-review safety.

## Implementation Checklist

- Bundle Agency catalog and prompt bodies under `subagents/agency-agents/`.
- Normalize Agency agents with `provider`, `id`, `slug`, `displayName`, `promptPath`, and `license`.
- Route VoltAgent and Agency agents through a single candidate pool.
- Add provider-aware scoring for marketing, product, design, sales, support, research, accessibility, and API-testing scenarios.
- Keep engineering, security, backend, frontend, testing, DevOps, and review quality gates stable.
- Add provider metadata to route, judge, managed, roster, nextAction, stage details, and report output.
- Embed Agency prompt bodies into `delegationPrompt` with clear Codex-priority guardrails.
- Add provider tests and expand eval to 136 cases.
- Update README, NOTICE, plugin README, plugin manifest, and skill docs.
- Sync repository, plugin package, global Codex paths, and installed plugin cache.

## Acceptance

- `test-agency-provider` proves the bundled Agency catalog and prompt files are readable.
- `test-provider-routing` proves representative tasks select the expected provider.
- `test-provider-dispatch` proves Agency prompt bodies reach managed delegation.
- `eval` remains 100% passing after adding 24 Agency cases.
- `doctor` and `report` show both providers and warn if Agency is unavailable.
