# Android Face Project Router QA Report

Date: 2026-06-06

## Scope

Used `/Users/sjp1212/Documents/项目/期末作业：人脸识别` as a real Android project to test and improve the `codex-subagent-router` plugin. The Android app was used as a validation sample only; no app code was changed.

## Baseline Finding

Before the routing fix, Android face-recognition testing prompts could route as generic engineering analysis and over-select security review skills because local paths and review/check wording outweighed Android QA signals. Explicit adb/emulator QA prompts also did not reliably select `android-emulator-qa`.

## Router Changes

- Added an `android-qa` task kind for Android, Gradle, APK, adb, emulator, device, CameraX, `androidTest`, `connectedDebugAndroidTest`, screenshot, and logcat requests.
- Added Android QA skill routing for `android-emulator-qa`, `android-performance`, `agyb-essentials:lint-and-validate`, and debugging support.
- Kept security skills out of ordinary Android QA unless the task explicitly mentions security, privacy, permissions, auth, credentials, vulnerabilities, or compliance.
- Added Android managed-output diagnostics that resolve adb from PATH, `local.properties`, Android SDK environment variables, or the default macOS SDK path.
- Added regression coverage for Chinese face-recognition Android project testing, explicit adb/emulator QA, and explicit Android security review.

## Router Retest

- `node --check subagents/router.mjs`: passed.
- `node --check subagents/import-community-skills.mjs`: passed.
- `node subagents/router.mjs test`: 16 routing tests passed.
- `node subagents/router.mjs eval`: 139/139 passed; `android-qa` bucket 2/2.
- `node subagents/router.mjs test-managed`: passed, including Android environment diagnostics.
- `node subagents/router.mjs test-managed-contract`: passed.
- `node subagents/router.mjs test-skills-phase`: passed.
- `node subagents/router.mjs test-managed-readiness`: passed.
- `node subagents/router.mjs test-agent-roster`: passed.
- `node subagents/router.mjs test-execution-adapter`: passed.
- `node subagents/router.mjs test-config`: passed.
- `node subagents/router.mjs doctor`: PASS.

## Managed Route Result

For the face-recognition Android project test prompt, the router now returns:

- `taskKind`: `android-qa`
- `risk`: `medium`
- `writeIntent`: `possible`
- `mustValidate`: `true`
- selected skills include `android-emulator-qa` and `agyb-essentials:lint-and-validate`
- `androidEnvironment.adbPath`: `/Users/sjp1212/Library/Android/sdk/platform-tools/adb`
- `androidEnvironment.deviceState`: `blocked-no-device`
- blocked device-side checks: `connectedDebugAndroidTest`, install/launch, screenshots, logcat

## Android Project Baseline

Ran in `/Users/sjp1212/Documents/项目/期末作业：人脸识别`:

- `./gradlew testDebugUnitTest --no-daemon`: passed.
- `./gradlew assembleDebug --no-daemon`: passed.
- `./gradlew assembleDebugAndroidTest --no-daemon`: passed.
- `/Users/sjp1212/Library/Android/sdk/platform-tools/adb devices`: adb ran successfully; no devices were attached.

## Remaining Limitation

Connected-device validation was not run because adb reported no connected Android device or emulator. The router now reports this as `blocked-no-device` instead of treating it as a generic untested gap.
