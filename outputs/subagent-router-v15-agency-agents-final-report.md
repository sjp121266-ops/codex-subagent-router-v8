# Subagent Router v15 Agency Agents Final Report

## Status

v15 integrates `msitarzewski/agency-agents` as a bundled Agency provider alongside the existing VoltAgent provider.

Current provider inventory:

- VoltAgent agents: 167.
- Agency agents: 184.
- Total router identities: 351.
- Skills detected in the tested environment: 279.
- Community skills: 74.

## What Changed

- Added `subagents/agency-agents/catalog.json` and `subagents/agency-agents/prompts/*.md`.
- Added provider-aware agent normalization and combined VoltAgent + Agency candidate routing.
- Added provider metadata to route, judge, managed delegation, roster, nextAction, stage details, doctor, and report output.
- Embedded Agency prompt bodies in `delegationPrompt` when an Agency specialist is selected.
- Added v15 routing rules for Reddit/community growth, product adoption, sales pipeline, UX research, UI design, accessibility review, customer support, and API testing.
- Added `test-agency-provider`, `test-provider-routing`, and `test-provider-dispatch`.
- Expanded eval from 112 to 136 cases.
- Updated README, NOTICE, plugin manifest, plugin README, and `subagent-router` skill documentation.

## Verification

Passed locally:

- `node --check subagents/router.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval` -> 136/136
- `node subagents/router.mjs test-agency-provider`
- `node subagents/router.mjs test-provider-routing`
- `node subagents/router.mjs test-provider-dispatch`
- `node subagents/router.mjs test-performance`
- `node subagents/router.mjs test-managed`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-recovery`
- `node subagents/router.mjs test-handoff`
- `node subagents/router.mjs test-skills-phase`
- `node subagents/router.mjs test-skill-repair`
- `node subagents/router.mjs test-agent-roster`
- `node subagents/router.mjs test-managed-readiness`
- `node subagents/router.mjs test-execution-adapter`
- `node subagents/router.mjs test-cache-maintenance`
- `node subagents/router.mjs doctor`
- `node subagents/router.mjs report`
- `node subagents/router.mjs test-judge` -> live GPT-5.5 smoke passed
- plugin validation for `~/plugins/codex-subagent-router`
- plugin, personal plugin, installed cache, and global Codex paths provider tests

Representative smoke results:

- Reddit community growth selects `agency:reddit-community-builder`.
- Product adoption read-only analysis selects an Agency product specialist.
- React frontend implementation remains on VoltAgent engineering specialists.
- API auth/security review remains GPT-5.5-gated and VoltAgent review-first.
- GPT-5.5 accepted provider-prefixed model output such as `voltagent:reviewer` and normalized it back to the canonical local agent name.

## Risk Notes

- Agency agents are used as prompt-pack role guidance only. They do not override Codex system/developer/user instructions, AGENTS.md, sandbox, approvals, or parent verification.
- Native custom-agent spawning is host-dependent. The router continues to use the generic explorer/worker bridge when native provider-name spawn is unavailable.
- Provider scoring intentionally favors VoltAgent for engineering/security-critical work unless an Agency specialist is explicitly and safely better matched.

## Outcome

The router is now a dual-provider dispatch system: engineering-heavy and high-risk tasks remain quality-gated through VoltAgent-oriented routes, while product, marketing, design, sales, support, and selected testing/research tasks can use Agency prompt-pack specialists with clear provider attribution and offline plugin availability.
