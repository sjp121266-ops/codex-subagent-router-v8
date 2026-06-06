# Tool Folder Router QA Report

Date: 2026-06-06

Scope: `/Users/sjp1212/Documents/工具` non-zip project samples. The samples were used as local validation fixtures only. No login, OAuth flow, real token output, real website business action, video download, ComfyUI queue, generation, or paid/API-cost action was authorized or run.

## Baseline Findings

The first managed routing pass covered 24 prompts across full test, read-only review, and build/validation forms. Main failures:

- Chrome extension samples were often routed as generic `engineering-analysis` with `security-auditor` or `reviewer`, instead of Chrome extension QA.
- Douyin-named Chrome/RPA projects over-selected `agency:douyin-strategist`, treating platform keywords as content strategy instead of local code testing.
- ComfyUI validation prompts did not reliably surface validate-only/no-queue/cost boundaries.
- Transcript/artifact folders routed as generic review/security instead of read-only artifact inspection.
- OAuth/token tooling correctly leaned security-heavy, but needed explicit no-secret-output and OAuth-flow blockers in managed output.

## Local Safe Validation

Passed:

- `抓取视频插件`: `npm run validate`.
- `谷歌浏览器插件`: `npm run lint`, `npm run check`, `npm test`, `npm run release:check`.
- `GitHub谷歌插件`: manifest JSON parse, JavaScript syntax checks, HTML/CSS existence checks.
- `抖音视频在线下载插件`: manifest JSON parse, JavaScript syntax checks, popup/merge HTML checks.
- `抖音rpa`: project `.venv` passed `main.py --doctor`, offscreen `main.py --flow-smoke`, and pytest.
- `调用comfyui`: workflow template validation passed.
- `get_token`: Python compile and static no-secret-output boundary check passed.
- `语音转录工具`: document builder compile and existing artifact structure spot check passed.

Blocked or environment-specific:

- `抖音rpa` failed under system Python because PySide6/pytest were unavailable; retest with project `.venv` passed.
- `调用comfyui` `status` and `models` failed because ComfyUI was not running at `127.0.0.1:8188`; queue/generation remained blocked.

## Router Changes

- Added task kinds: `chrome-extension-qa`, `desktop-rpa-qa`, `comfyui-workflow-qa`, `credential-tooling`, and `artifact-inspection`.
- Added preferred agents and skill defaults for each tool class.
- Separated "local safe validation" from real security audit intent, so "本地安全验证" no longer pulls ordinary QA into security routing.
- Prevented Douyin/platform keywords from overriding strong local tool QA task kinds.
- Added managed `safetyDiagnostics` with safe checks and blocked checks for Chrome extensions, RPA, ComfyUI, credential tooling, and artifact inspection.
- Added regression coverage for the real tool-folder prompt shapes.

## Retest Summary

After the router changes, all 8 representative samples routed to the intended task kinds:

| Sample | Task kind | Agent | Key skills | Blocked boundary |
| --- | --- | --- | --- | --- |
| `谷歌浏览器插件` | `chrome-extension-qa` | `browser-debugger` | lint/validate, frontend testing, Playwright | real Zendesk/GitHub/Douyin actions, publishing, downloads |
| `GitHub谷歌插件` | `chrome-extension-qa` | `test-automator` | lint/validate, frontend testing, Playwright | real GitHub actions, publishing, downloads |
| `抓取视频插件` | `chrome-extension-qa` | `browser-debugger` | lint/validate, frontend testing, Playwright | real site actions, downloads |
| `抖音视频在线下载插件` | `chrome-extension-qa` | `test-automator` | lint/validate, frontend testing, Playwright | Douyin login and real downloads |
| `抖音rpa` | `desktop-rpa-qa` | `test-automator` | lint/validate, debugging, Playwright | QR/login flows and live-site actions |
| `调用comfyui` | `comfyui-workflow-qa` | `qa-expert` | lint/validate, debugging | queue and generation |
| `get_token` | `credential-tooling` | `security-auditor` | security review, threat model, lint/validate | OAuth flow and token/cache output |
| `语音转录工具` | `artifact-inspection` | `code-mapper` | lint/validate | new transcription jobs and uploads |

## Verification

Router verification passed:

- `node --check subagents/router.mjs`
- `node --check subagents/import-community-skills.mjs`
- `node subagents/router.mjs test`
- `node subagents/router.mjs eval --json`
- `node subagents/router.mjs test-managed`
- `node subagents/router.mjs test-managed-contract`
- `node subagents/router.mjs test-skills-phase`
- `node subagents/router.mjs test-config`

Remaining limits:

- ComfyUI live service checks remain blocked until the local ComfyUI server is running.
- Real website, OAuth, download, publish, generation, and paid/API-cost actions remain intentionally blocked.
