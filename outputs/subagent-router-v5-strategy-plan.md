# Subagent Router v5 Strategy Optimization Plan

## Goal

Upgrade the router into a configurable strategy system that selects:

- the right VoltAgent subagent identity
- the right Codex skills
- the right model and reasoning effort
- whether to run a single agent or a staged/multi-agent flow
- the safe execution posture for the parent Codex agent

## Problems in v4

- Skills rules are embedded in JavaScript, so tuning requires code edits.
- The router chooses an agent, but does not give a complete execution posture.
- Complex tasks often need a staged flow: explore/review first, worker second, reviewer last.
- Skill output is useful but not grouped by role: planning, implementation, verification, review, deployment.
- The model policy is effective but not exposed as part of a broader complexity/risk profile.

## v5 Design

### 1. Strategy Config

Create `$HOME/.codex/subagents/strategy-config.json`.

It stores:

- skill rules
- execution profiles
- multi-agent triggers
- model policy signals
- low-confidence guardrails

The router loads this file first. If the file is missing or malformed, it falls back to built-in safe defaults.

### 2. Skill Rule Improvements

Skill rules gain:

- `id`
- `phase`: planning, implementation, debugging, testing, review, deployment, research, design
- `priority`
- `confidence`
- `reason`
- `skills`
- regex patterns

Router output adds:

- `skillMatches` with phase and reasons
- `selectedSkillsByPhase`
- deduped `selectedSkills`

### 3. Execution Profile

Router adds `executionPlan`:

- `mode`: single-agent, staged, parallel-review, or clarify-first
- `primaryRole`: explorer or worker
- `stages`: ordered stage descriptions
- `parallelizable`: boolean
- `requiresReview`: boolean
- `requiresTests`: boolean
- `requiresUserClarification`: boolean

### 4. Complexity/Risk Profile

Router adds `taskProfile`:

- `complexity`: low, medium, high
- `risk`: low, medium, high, critical
- `scope`: local, subsystem, cross-system, unknown
- `writeIntent`: none, possible, expected
- `signals`: matched operational signals

This profile feeds model selection, multi-agent mode, and low-confidence handling.

### 5. GPT-5.5 Judgement

The GPT-5.5 judge receives:

- deterministic route
- skill candidates grouped by phase
- model policy
- task profile
- execution plan

The judge may refine:

- final agent
- selected skills
- model/effort
- execution plan

It may not choose agents or skills outside the candidate set.

## Acceptance Criteria

- Existing deterministic routing tests still pass.
- Strategy config exists and validates.
- Router output includes `taskProfile`, `executionPlan`, and `selectedSkillsByPhase`.
- Review/security/production tasks require review and use `gpt-5.5`.
- Simple docs tasks remain low complexity and use mini/low-cost model policy.
- Multi-step implementation plans route to staged mode.
- Real GPT-5.5 smoke test returns valid v5 judgement fields.
