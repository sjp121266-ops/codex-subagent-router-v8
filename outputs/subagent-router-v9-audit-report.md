# Subagent Router v9 Audit Report

## Summary

v9 audit used separate read-only review lanes for architecture, LLM routing behavior, and public-release security hygiene. The audit found one critical routing stability defect and several publishability risks. The critical routing defect is fixed in v9: configured, locally available skills that were omitted by the initial candidate budget can now be repaired without discarding an otherwise valid GPT-5.5 judgement.

## Audit Matrix

| Lane | Agent role | Scope | Result |
| --- | --- | --- | --- |
| Architecture | architect-reviewer | `router.mjs`, strategy config, schema, handoff planning | Found fallback handoff blocking and role/sandbox consistency gaps. |
| LLM routing | llm-architect | judge prompt, schema contract, skill validation | Found hard failure on recoverable skill subset drift. |
| Security/release | security-engineer | README, skill docs, manifests, outputs | Found local path exposure, license/notice gaps, and shell-copy risks. |
| Parent integration | Codex leader | Implementation and verification | Fixed P0/P1 routing issues and queued release hygiene work. |

## P0/P1 Findings

1. **P0: High-risk fallback returned executable handoff stages.**
   - Evidence: fallback metadata used `requiresParentReview`, but `attachRoutingMetadata` still built normal stages.
   - Impact: an upstream caller could inspect only `handoffPlan.stages` and auto-delegate a conservative fallback.
   - Fix: v9 adds `delegationBlocked`, `approvalState`, and `parent-review-required` handoff mode for parent-review fallbacks.
   - Verification: `router.mjs test-skill-repair` asserts high-risk offline fallback has no `primary` or `implement` stage.

2. **P0: Recoverable selected-skill drift caused full premium-judge fallback.**
   - Evidence: GPT-5.5 selected `superpowers:writing-plans`, a configured skill omitted from the initial candidate set.
   - Impact: valid agent/model/risk judgement was discarded because one skill was outside the candidate budget.
   - Fix: v9 keeps agent validation strict, but repairs configured and locally available skills, recording a routing warning.
   - Verification: `router.mjs test-skill-repair` covers repaired configured skill, unknown skill hard failure, and invalid agent hard failure.

3. **P1: `selectedSkillsByPhase` could include skills outside final selection.**
   - Evidence: validation merged model phase groups with candidate-derived groups.
   - Impact: handoff stages could load skills not actually selected by the judge.
   - Fix: v9 rebuilds `selectedSkillsByPhase` from final `selectedSkills` only.
   - Verification: `router.mjs test-skill-repair` asserts unselected phase entries are removed.

4. **P1: Staged handoff could combine `worker` role with `read-only` sandbox.**
   - Evidence: staged implement stage forced `role=worker` while using the selected agent sandbox.
   - Impact: execution contract could be internally inconsistent.
   - Fix: v9 only creates `implement` for worker agents; read-only agents get an `analyze` stage.
   - Verification: handoff tests continue to validate stage shape, with blocked fallback coverage added.

5. **P1: Public repo contains local absolute paths and incomplete licensing guidance.**
   - Evidence: README, skill docs, manifests, registry, and historical reports include `$HOME` paths.
   - Impact: privacy fingerprinting, poor portability, and public distribution ambiguity.
   - Fix status: queued for Goal 5 release hygiene. Root code should stop hardcoding local fallback paths; docs should prefer `$HOME`/`~`.

## P2 Findings

- `executionProfiles` in config reads as policy, but is mostly descriptive. It should either become executable policy or be documented as descriptive.
- The judge schema and final route contract are separate. A future v10 can add a final-output schema for `fallbackSafety`, `handoffPlan`, and `delegationBlocked`.
- Cache lifecycle is documented only lightly. README should explain cache location, contents, and cleanup.

## Acceptance

- P0/P1 routing correctness issues are implemented in v9 code.
- Public-release P1 hygiene is tracked for Goal 5.
- Remaining P2 items are documented as future hardening, not blockers for v9.
