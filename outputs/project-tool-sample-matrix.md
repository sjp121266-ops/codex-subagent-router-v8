# Project + Tool Sample Matrix

Generated: 2026-06-06

Scope:
- Included `/Users/sjp1212/Documents/项目` and `/Users/sjp1212/Documents/工具`.
- Excluded directories whose names contain `八爪鱼`.
- Excluded zip archives.
- Samples are fixtures only; no business code was changed.

Safety boundary:
- Local validation only.
- No login, QR scan, credential submission, token output, webhook registration, message send, publish, deploy, real download, upload, transcription, generation, or paid/API-cost action.
- Empty or sparse samples stop at blocker reporting.

| Category | Representative Samples | Safe Checks | Blocked Checks |
|---|---|---|---|
| Android QA | `期末作业：人脸识别` | Gradle unit tests, debug APK build, androidTest APK build, adb readiness | connected tests, install/launch, screenshots, logcat unless device/emulator is ready |
| Chrome Extension QA | `谷歌浏览器插件`, `GitHub谷歌插件`, `抓取视频插件`, `抖音视频在线下载插件` | manifest JSON, JS syntax, popup/side panel references, package validation scripts | real Zendesk/GitHub/Douyin account actions, store publishing, real downloads, credentials |
| Web App QA | `无限画布`, `libtv画布`, `自动插件剪辑`, `open cut` | existing package scripts, lint/typecheck/test/build, static asset checks | install, deploy, publish, account login, real platform actions |
| Monorepo/WASM QA | `opencut-classic` | package graph, Turbo/local scripts, Rust/WASM build checks when available | deploy, Docker push, release publishing, public services |
| Desktop Automation QA | `操控剪映` | Python syntax, doctor/offscreen smoke when local-only, local tests | real Jianying/CapCut control, rendering, QR/login, download, publish |
| Desktop RPA QA | `抖音rpa` | project venv, doctor, offscreen flow smoke, pytest | QR/login, real Douyin business actions, publish, download |
| Integration Bot QA | `飞书机器人`, `coze工作流`, `音乐寻找` | syntax, config-name inventory, local callback/handler checks | OAuth flow, token output, webhook registration, real platform messages, paid/API calls |
| Credential Tooling | `get_token` | syntax compilation, static no-secret-output review | OAuth browser flow, token/auth-cache dump, credential submission |
| ComfyUI Workflow QA | `调用comfyui` | status/models/validate-only commands | queue, image/video generation, paid API/model calls |
| Static Artifact Inspection | quote HTML, docs, Douyin docs, customer videos, posters, PPT, Obsidian, transcript outputs | file inventory, HTML/reference structure, script syntax, artifact structure | new generation, transcription jobs, uploads, publishing, rewriting assets |
| Empty Sample Blocker | `RPA` | path existence and visible file count | compile, tests, automation, login, download, publish, build planning |

Source evidence:
- `/tmp/project-tool-sample-matrix.json`
- `/tmp/router-batch-web-monorepo.json`
- `/tmp/router-batch-android-chrome.json`
- `/tmp/router-batch-python-automation.json`
- `/tmp/router-batch-integration-credential.json`
- `/tmp/router-batch-artifacts-docs.json`
