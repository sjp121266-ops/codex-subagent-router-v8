# codex-subagent-router architecture audit and optimization report

Generated: 2026-06-07

## 1. Current State

The plugin's real purpose is to be a quality-first local routing and planning layer for Codex subagent work. It chooses an agent identity, selected skills, model strength, sandbox boundary, staged handoff plan, App-readable Chinese planning board, and conservative fallback state. It does not execute the work by itself; parent Codex remains responsible for spawning or bridging agents, integrating results, and final verification.

The current architecture is capable, but it is concentrated in `subagents/router.mjs`. That one file currently owns config loading, registry loading, provider prompt hydration, task classification, scoring, judge policy, cache policy, managed output generation, App board rendering, doctor/report, CLI parsing, and embedded tests. This has kept the project portable, but it is the main long-term risk.

## 2. Findings

### Architecture Design

- Problem: Router monolith owns every layer.
- Severity: High
- Location: `subagents/router.mjs`
- Description: Classification, scoring, provider registry, prompt hydration, managed contracts, display rendering, cache, CLI, and tests are all coupled.
- Why this matters: A change to one surface can regress unrelated behavior.
- Consequence: Slower review, brittle fixes, higher merge conflict risk, and harder onboarding.
- Recommendation: Extract in this order: managed contract/display schema, task-kind classifiers, provider registry, observability, CLI adapters, test modules.

### Module Boundaries

- Problem: Business logic and CLI output are coupled.
- Severity: Medium
- Location: `printManagedDelegation`, `printJudgement`, `runDoctor`, `runReport`
- Description: Rendering and route preparation share data shapes directly.
- Why this matters: Output improvements can accidentally change machine-readable contracts.
- Consequence: JSON consumers and Codex App display paths can drift.
- Recommendation: Keep pure contract builders and renderers separate; validate both with contract tests.

### Routing Strategy

- Problem: Regex-heavy task-kind detection can be dominated by platform keywords.
- Severity: High
- Location: `classifyTaskKind`, signal helpers
- Description: Platform words such as Douyin can pull local RPA validation tasks toward content or growth agents unless local validation boundaries win.
- Why this matters: The selected agent and sandbox can be wrong.
- Consequence: Bad delegation, unsafe external-action assumptions, and user confusion.
- Recommendation: Continue adding boundary-first classifiers for local paths, no-write directives, safe validation verbs, and explicit external-side-effect blockers.

### Agent Selection Logic

- Problem: Preferred-agent overrides are spread across classification and fallback paths.
- Severity: Medium
- Location: `fallbackJudgement`, task-kind policy, candidate scoring
- Description: Some task kinds override the preferred agent after generic scoring.
- Why this matters: It is hard to reason about final agent causality.
- Consequence: Future provider additions may produce surprising winners.
- Recommendation: Move preferred-agent and provider weighting into a strategy object with traceable reasons.

### Context Transfer

- Problem: Prompt hydration, compact role cards, and managed context budgets are enforced by convention.
- Severity: Medium
- Location: prompt hydration helpers and `managedDelegationPlan`
- Description: Compact output exists, but no dedicated external schema exists yet.
- Why this matters: Future fields can grow context without a visible budget failure.
- Consequence: Codex App context use can creep upward.
- Recommendation: Keep `contextLedger` and contract tests; later publish JSON Schema for managed output.

### Error Handling

- Problem: Most failures are plain `Error` values.
- Severity: Medium
- Location: CLI command handlers, config/cache readers, model validation
- Description: Error class, recoverability, user impact, and remediation are not typed.
- Why this matters: Parent Codex cannot distinguish a transient model issue from a broken config unless it reads strings.
- Consequence: Poor recovery behavior and fragile tests.
- Recommendation: Add typed router errors: `ConfigError`, `ProviderError`, `JudgementError`, `ContractError`, `TransportError`.

### Type Safety

- Problem: Runtime JS has partial schemas but no generated route/managed types.
- Severity: Medium
- Location: `judgement.schema.json`, managed output builders
- Description: Judge output has schema validation; managed output is ad hoc.
- Why this matters: The most important App-facing contract lacked a single validator before this pass.
- Consequence: Silent shape drift.
- Recommendation: This pass added `validateManagedPlanContract`; next step is a JSON Schema and TypeScript declarations.

### Testability

- Problem: Tests are embedded in the production CLI file.
- Severity: Medium
- Location: `run*Tests` functions in `subagents/router.mjs`
- Description: The test surface is useful but increases file size and coupling.
- Why this matters: It discourages smaller modules.
- Consequence: More difficult targeted testing and slower code navigation.
- Recommendation: Keep current embedded tests for portability, then move them to `subagents/tests/*.mjs` after module extraction.

### Maintainability

- Problem: Plugin mirror copies can drift.
- Severity: High
- Location: `plugins/codex-subagent-router/scripts/subagents/*`
- Description: Main source and plugin mirror are duplicated.
- Why this matters: Installed Codex App behavior may not match repository behavior.
- Consequence: Bugs that are fixed in source can remain live in the plugin.
- Recommendation: This pass added mirror-sync health checks; later replace duplication with a release/sync script.

### Extensibility

- Problem: Provider registry is effective but not yet a formal provider interface.
- Severity: Medium
- Location: `loadAllAgents`, Agency helpers, VoltAgent registry helpers
- Description: VoltAgent and Agency are merged through local object conventions.
- Why this matters: Adding another provider will require more local conventions.
- Consequence: Provider-specific logic leaks into scoring and hydration.
- Recommendation: Add `ProviderAdapter` with `loadAgents`, `agentCard`, `hydratePrompt`, `scoreHints`, and `safetyNotes`.

### Performance

- Problem: Large JSON and repeated route preparation can grow with provider count.
- Severity: Medium
- Location: registry loading, route cache, managed output generation
- Description: The router uses caches and compact profiles, but growth pressure remains.
- Why this matters: More agents and skills increase candidate selection costs.
- Consequence: Slower Codex App routing and larger context packets.
- Recommendation: Keep route cache and context ledger; later add compiled regex caches and provider-level candidate prefilters.

### Concurrency and State

- Problem: Runtime cache writes are local JSON files without locking.
- Severity: Low
- Location: judgement, route, prompt summary, hydration plan caches
- Description: Concurrent router invocations may race on cache writes.
- Why this matters: App and CLI can run at the same time.
- Consequence: Lost cache updates or occasional corrupt cache recovery.
- Recommendation: Add atomic write via temp-file rename and optional lock files for high-frequency use.

### Config Design

- Problem: Config validation is useful but incomplete.
- Severity: Medium
- Location: `validateStrategyConfig`
- Description: It checks many policy invariants but not every nested managed UX field.
- Why this matters: A malformed config can degrade user display.
- Consequence: Runtime defaults may hide config mistakes.
- Recommendation: Extend validation into a full config schema and generated defaults.

### Logging and Observability

- Problem: Health exists as CLI text but was not architecture-aware.
- Severity: Medium
- Location: `doctor`, `report`
- Description: Before this pass, doctor could pass while architecture risks such as mirror drift remained invisible.
- Why this matters: Operational confidence depends on checking the deployment shape, not only route quality.
- Consequence: Users can install a stale plugin copy.
- Recommendation: This pass added `architecture-health`, `test-architecture`, doctor integration, and report integration.

### Security

- Problem: Full prompt hydration and debug JSON can expose too much internal context if pasted casually.
- Severity: Medium
- Location: `prompt`, `judge --verbose`, skill instructions
- Description: The safe path is compact, but debug paths are powerful.
- Why this matters: User chats can accidentally expose local prompt content or sensitive task text.
- Consequence: Oversharing in normal user communication.
- Recommendation: Keep skill guidance to show `displayBoard` first and reserve full JSON/full hydration for debugging.

### Boundary Conditions

- Problem: Installed plugin copies are not source checkouts.
- Severity: Low
- Location: mirror sync checks
- Description: A source/mirror comparison must not fail when running from an installed plugin cache without repository context.
- Why this matters: Codex App users run from plugin cache.
- Consequence: False doctor failures.
- Recommendation: This pass makes installed-copy mirror sync a safe skipped check.

### User Experience

- Problem: Users should not need to read JSON to understand delegation.
- Severity: Medium
- Location: managed text output and skill instructions
- Description: `displayBoard` solved most of this, but architecture health commands were not documented.
- Why this matters: The plugin is meant to be understandable in Codex App.
- Consequence: Users may think the plugin is just a CLI artifact.
- Recommendation: This pass documents `architecture-health` and keeps App board as the primary user-facing surface.

### Documentation

- Problem: Architecture risk and maintenance checks were not described in the README.
- Severity: Medium
- Location: README files
- Description: Usage docs covered routing but not architecture validation.
- Why this matters: Operators need to know how to verify a plugin install.
- Consequence: Harder safe upgrades.
- Recommendation: This pass adds commands and this report.

### Naming and Abstraction

- Problem: Version labels are historical and mixed into check IDs.
- Severity: Low
- Location: doctor checks such as `config-v13`, `execution-adapter-v14`
- Description: Useful chronology, but not a stable conceptual taxonomy.
- Why this matters: Future readers may not know what v13/v14 mean.
- Consequence: Lower readability.
- Recommendation: Keep backward naming for now; add conceptual aliases in future health output.

### Future Subagent Scale

- Problem: More providers and agents will stress candidate routing.
- Severity: High
- Location: `loadAllAgents`, scoring, judge packet building
- Description: The current strategy works for hundreds of agents but will need provider-level indexing and capability facets.
- Why this matters: Agent count can grow quickly.
- Consequence: Slow routing, weak candidate packets, and harder quality gates.
- Recommendation: Add a capability index with task-kind facets, safety facets, provider trust level, prompt cost, and last-known eval performance.

## 3. Target Architecture

Recommended directory structure:

```text
subagents/
  cli/router.mjs
  config/strategy-config.json
  contracts/managed-plan.schema.json
  contracts/managed-plan.mjs
  contracts/judgement.schema.json
  routing/classifiers.mjs
  routing/score.mjs
  routing/judge-policy.mjs
  providers/voltagent.mjs
  providers/agency-agents.mjs
  providers/provider-adapter.mjs
  context/context-ledger.mjs
  safety/fallbacks.mjs
  observability/doctor.mjs
  observability/architecture-health.mjs
  tests/*.mjs
```

Router boundary:

- Accept task + options.
- Build task profile.
- Select candidates.
- Apply judge policy.
- Validate judgement.
- Return route + managed contract.
- Never execute user work.

Agent registry:

- Keep provider-prefixed IDs.
- Store display name, role, sandbox, model compatibility, capability facets, provider prompt reference, prompt hash, and safety notes.
- Expose read-only provider adapters so selection does not depend on provider internals.

Agent selection strategy:

- First filter by hard safety and runtime boundaries.
- Then rank by task kind, capability facets, preferred-agent policy, provider trust, and context cost.
- Preserve explainable scoring reasons.
- Keep high-risk model gates separate from cheap judge policy.

Context manager:

- Own compact role cards, prompt hydration modes, byte/token budgets, and context risk.
- Enforce "reference/summary by default; full only on explicit request".

Error boundary:

- Use typed errors with `code`, `recoverable`, `userMessage`, `debugDetail`, and `safeFallback`.
- Convert model/schema/provider failures into conservative managed states.

Observability:

- Keep `doctor`, `report`, `config-explain`, `inspect-context`, `cache-status`.
- Add structured architecture health and managed contract samples.
- Later add per-route trace files with redacted prompt text.

Test strategy:

- Keep eval matrix for behavior.
- Keep managed contract tests for shape.
- Keep App board tests for user display.
- Keep architecture tests for mirror drift and line-count guardrails.
- Later split tests by module once extraction begins.

Evolution route:

1. Keep current single-file behavior stable.
2. Add contracts and health checks. Completed in this pass.
3. Extract managed contract/display board first.
4. Extract classifiers and provider adapters.
5. Add route trace artifacts.
6. Move tests out of production CLI.
7. Add provider performance metrics and learned eval buckets.

## 4. Implemented Changes

- Added `validateManagedPlanContract(plan)` for managed output invariants.
- Added `pluginMirrorSyncHealth()` to detect source/plugin mirror drift.
- Added `routerArchitectureHealth()` and `architecture-health` CLI command.
- Added `test-architecture` CLI command.
- Integrated architecture health into `doctor`.
- Integrated architecture summary into `report`.
- Updated root README and plugin README with architecture validation commands.
- Synchronized the plugin mirror and installed plugin cache.

## 5. Verification

Verified commands in this pass:

```bash
node --check subagents/router.mjs
node --check plugins/codex-subagent-router/scripts/subagents/router.mjs
node subagents/router.mjs test-architecture
node subagents/router.mjs architecture-health
node plugins/codex-subagent-router/scripts/subagents/router.mjs test-architecture
node /Users/sjp1212/.codex/plugins/cache/personal/codex-subagent-router/0.1.0+codex.20260606112258/scripts/subagents/router.mjs architecture-health
node subagents/router.mjs doctor
```

Observed results:

- Architecture health passed.
- Managed contract samples passed.
- Plugin mirror sync passed in the source checkout.
- Installed plugin cache architecture health passed without false source-checkout drift.
- Doctor passed with architecture-health included.

## 6. Remaining Recommendations

- Extract managed contract and display board into a dedicated module first.
- Add `managed-plan.schema.json` and generated TypeScript declarations.
- Add typed error classes for config, provider, judgement, contract, and transport failures.
- Replace manual mirror copying with a release/sync command.
- Add atomic JSON cache writes.
- Add redacted per-route trace artifacts for deeper observability.
- Move embedded tests to dedicated test modules after the contract module exists.

## 7. Usage

Install as a personal plugin from the repository root:

```bash
mkdir -p ~/plugins
rm -rf ~/plugins/codex-subagent-router
cp -R plugins/codex-subagent-router ~/plugins/codex-subagent-router
codex plugin add codex-subagent-router@personal
```

Run App-readable planning:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --profile app "开启子代理，调用合适 agent 完成任务"
```

Run compact machine-readable delegation:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs managed --json --profile compact "开启子代理，调用合适 agent 完成任务"
```

Run architecture health:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs architecture-health
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs test-architecture
```

Run full local health:

```bash
node ~/plugins/codex-subagent-router/scripts/subagents/router.mjs doctor
```
