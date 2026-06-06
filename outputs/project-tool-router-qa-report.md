# Project + Tool Router QA Report

Date: 2026-06-06

Goal: use real local samples from `/Users/sjp1212/Documents/项目` and `/Users/sjp1212/Documents/工具`, excluding `八爪鱼`, to improve `codex-subagent-router` routing quality, skill selection, staged managed output, and safety blockers.

## Batch Findings

| Batch | Evidence | Main Findings |
|---|---|---|
| Web + monorepo | `/tmp/router-batch-web-monorepo.json` | Vite/Next samples were falling back to generic analysis; `open cut` and `opencut-classic` were pulled into Chrome extension routing; WASM/Turbo/Rust needed its own local QA path. |
| Android + Chrome | `/tmp/router-batch-android-chrome.json` | Chrome extension prompts mentioning Android leaked `android-qa`, Android skills, and adb diagnostics. |
| Python automation | `/tmp/router-batch-python-automation.json` | Douyin/Jianying platform words overrode local QA intent; empty `RPA` needed a blocker instead of an automation plan. |
| Integration + credentials | `/tmp/router-batch-integration-credential.json` | Feishu/get_token/ComfyUI were close, but needed clearer side-effect blockers and less unrelated skill noise. |
| Static artifacts/docs | `/tmp/router-batch-artifacts-docs.json` | HTML/docs/media folders needed read-only static artifact routing; platform names in paths could misroute to content strategy agents. |

## Fixes Implemented

- Added task kinds: `web-app-qa`, `monorepo-wasm-qa`, `desktop-automation-qa`, `integration-bot-qa`, `static-artifact-inspection`, and `empty-sample-blocker`.
- Added path/evidence-aware routing so Chrome extension routing requires extension evidence, and Android routing requires Android project evidence or strong Android QA terms.
- Stopped Android skills and adb diagnostics from leaking into Chrome extension routes.
- Split desktop RPA from Jianying/CapCut-style desktop automation.
- Kept Feishu/bridge/connector projects on integration QA while treating OAuth/token/webhook actions as blockers.
- Kept static HTML/docs/media samples read-only and removed build/write stages from those managed plans.
- Added regression eval cases for the real sample failures.
- Synced source and plugin mirror copies.

## Verification

Passed:
- `node --check subagents/router.mjs`
- `node --check subagents/import-community-skills.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval` -> 154/154
- `node subagents/router.mjs test-managed`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-skills-phase`
- `node subagents/router.mjs test-config`
- `node subagents/router.mjs test-judge-matrix`
- `node subagents/router.mjs test-handoff`
- `node subagents/router.mjs doctor`
- `node plugins/codex-subagent-router/scripts/subagents/router.mjs eval` -> 154/154

Not run:
- Real account/platform actions.
- Real downloads/uploads/publishing/deployments.
- Android connected tests, install/launch, screenshots, and logcat without a ready device/emulator.
- ComfyUI queue/generation or paid/API-cost workflows.

## Remaining Limits

- Some sample projects lack dependencies, devices, services, or credentials; those remain environment blockers, not plugin failures.
- The router now treats platform words in local project paths as QA context when the prompt says local/read-only validation, but true product/content strategy prompts should still route to Agency strategy agents.
- Static artifact routing is intentionally conservative: it inventories and validates existing files, but does not rewrite or generate assets.
