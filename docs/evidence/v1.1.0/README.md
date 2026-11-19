# Jig v1.1.0 implementation evidence

**Status:** REOPENED FOR MOBILE UX/UI REMEDIATION on 2026-11-19. The hosted candidate below remains valid evidence for unaffected core/runtime/Git/reminder/distribution behavior, but it is **not current closure evidence** for mobile interaction geometry, Settings information architecture, Repeat form/save UX or Task drag/drop. Physical Android use failed the prior Pangea drag hard gate and exposed broader mobile UX defects now governed by the amended FR/SD/implementation plan.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Previously certified pre-remediation candidate

- Governed integration branch: `v1.1` via PR #32.
- Certified product/test candidate commit: `d29df9ebeb05eaf44666d12f6ee20ccd81673d32`.
- Permanent Verify workflow: run `44450324316` / run number `1368`.
- Verification-only trigger PR: #33, closed without merge after certification.
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build/F-Droid certification and Android API-24 runtime all completed successfully.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

This candidate is retained as historical pre-remediation evidence. A new product/test candidate and permanent Verify run are required after the reopened UX work. Do not cite run 44450324316 as proof that the amended FR-03/FR-28/FR-29/FR-31 UX contracts pass.

## Hosted non-device evidence ledger

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | **PASS** — run `44450324316`; 40 test files / 217 core-integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 66/66 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is no longer evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS** — Gradle dependency-lock verification, Android unit/static checks, FLOSS dependency boundary, Android version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention all passed in run `44450324316`. |
| Android API-24 instrumentation | **PASS** — run `44450324316`; Android 7.0 / API 24 x86_64 emulator; 5/5 instrumentation tests completed successfully; Gradle `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
| Android bundled SQLite transaction/restart proof | **PASS at the native-driver/API-24 boundary** — covered by the committed API-24 instrumentation. Cross-platform physical-device continuity remains part of J110-IMP-15. |
| Android Git native HTTP transport | **PASS at the native-transport/API-24 boundary** — committed instrumentation passed; host smart-HTTP/portable interoperability coverage is included in the 217-test core/integration/architecture result. Live private-repository acquisition remains external/physical evidence. |
| Android GitHub Device Flow native HTTP composition | **PASS** — the shared Device Flow request/poll/user-lookup contract is exercised through the Android native HTTP adapter, including canonical client ID, `offline_access`, pending→authorized transition and absence of `client_secret`/`redirect_uri`. Live authorization remains external/physical evidence. |
| Android reminder scheduling/reconciliation | **PASS for implemented host/reconciliation semantics** — permanent unit/reconciliation coverage passed. API 31/33/36 policy/permission behavior and physical notification delivery remain J110-IMP-15 evidence. |
| F-Droid candidate metadata lint | **PASS** — permanent Android certification lint passed against the pinned F-Droid category authority. External submission/publication has not occurred. |
| FLOSS/proprietary dependency gate | **PASS** — permanent Android runtime dependency boundary passed; no Play Services/Firebase/proprietary runtime SDK is accepted by the gate. |
| Linux x64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Linux arm64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Local `act` rehearsal | **NOT A CLOSURE GATE** — optional developer preflight only. Permanent hosted Verify/Release are authoritative; no local Actions scaffolding is committed in the candidate. |
| Live Linux/Desktop GitHub Device Flow/private-repo acquisition | **IMPLEMENTATION COMPLETE / EXTERNAL LIVE ACCEPTANCE PENDING** — deterministic protocol, Secret Service, managed transport, complete installation/repository pagination, provider-access recheck, clone/adoption, refresh/reconnect and failure semantics are implemented and permanently tested. A real user authorization/private-repository run remains external acceptance evidence tracked by issue #31. |
| Live/physical Android GitHub Device Flow/private-repo acquisition | **PENDING physical-device verification**. |

## Pre-remediation non-device audit

The prior audit remains useful for unaffected architecture, but the following repository-executable defects are now open: app-wide mobile touch geometry/menu density, Settings information design, integrated Repeat form/save semantics and replacement of failed Pangea Task movement.

The closure audit confirms:

- canonical Task/planning/recurrence semantics remain in the shared TypeScript core;
- shared persistence semantics remain in `src/persistence/sqlite.ts`; Linux and Android expose low-level drivers rather than parallel Task models;
- generic `src/shell/sync.ts`, `src/protocol.ts`, configured `src/shell/http.ts` and `src/shell/main.ts` remain free of the GitHub policy/credential leakage prohibited by SD-38;
- one shared GitHub protocol contract, Device Flow timing owner, onboarding orchestration owner and reconnect owner serve Linux and Android; React emits only connect/select/retry/reconnect intents and observes the coarse presentation state rather than operating protocol progression;
- Linux Secret Service remains a credential persistence adapter and the managed GitHub transport owns remote binding, credential refresh, actionable reauthorization state and authenticated Git network effects;
- GitHub installation/repository discovery consumes every provider page, handles restricted organization installations through GitHub-owned access surfaces, automatically rechecks on resume/return, auto-acquires an unambiguous single repository and stops only for a genuine repository choice;
- fresh onboarding/loading/error states render inside the same canonical Jig AppShell/header/body as configured mode; normal onboarding/reconnect exposes no manual Refresh/Grant/Manage/acquire controls;
- primary header/Settings synchronization presentation uses Local only / Syncing / Up to date / Needs attention and planning-data-home language; exact Local Git/Remote Git/service/database/path/manual-sync facts remain secondary Diagnostics;
- the browser entrypoint lazily crosses into native runtime code only after `Capacitor.isNativePlatform()`, preventing Android/isomorphic-git evaluation in the browser;
- Android SQLite, Git transport, GitHub Device Flow composition, reminder reconciliation, dependency/FLOSS boundary and F-Droid candidate path have permanent host/emulator certification;
- permanent architecture tests enforce these ownership boundaries so the closure is regression-protected.

The real Linux/Desktop Device Flow/private-repository exercise is deliberately classified as **external live acceptance**, not unfinished repository implementation: it requires an interactive GitHub user authorization and live Secret Service environment that the connected repository execution surface cannot manufacture. Its absence does not authorize additional code or a substitute authentication architecture.

## Development APK identity

The development APK retained by permanent Verify run `44450324316` is certification input only; it is not a GitHub Release asset or public Android distribution channel.

- GitHub Actions artifact id: `14495392167`
- Artifact name: `jig-android-debug-f3335dc7e0ab6ffd379cac1999a0210b91255772` (GitHub PR merge-ref SHA naming; certified source head remains `d29df9ebeb05eaf44666d12f6ee20ccd81673d32`)
- Artifact ZIP digest: `sha256:7a00fcdf3ff7e312984d9c3222fd3063280f854b2999f6c7816125f4fe2da818`
- APK file: `app-debug.apk`
- APK size: `9,767,104` bytes
- APK SHA-256: `3f931e8fea5da63285b8fbd02bbb4dfeb48439cf6a12175381b54b8cf98ddb7f`

Any physical-device certification must identify the exact APK/source candidate it uses. A later executable change invalidates this APK identity for that later candidate.

## Known corrective evidence

The candidate includes a browser-bootstrap correction for the Android Git runtime boundary. Static reachability from the browser entrypoint had pulled `isomorphic-git`'s Node `Buffer` path into the production browser bundle, causing module-evaluation failure before React mounted. The corrected boundary dynamically loads `runtime-native` only after `Capacitor.isNativePlatform()` is true, and dynamically loads Android GitHub onboarding only on the native path. Permanent architecture tests forbid the static native imports, and the hosted bootstrap smoke plus 66/66 browser suite pass prove the browser surface mounts correctly.

The 2026-11-19 authority remediation also replaced the superseded process-shaped setup/reconnect presentation. The certified candidate keeps onboarding inside the canonical Jig shell, presents one Connect GitHub repository intent plus GitHub's required user code/Copy/Open-GitHub handoff, automatically polls and rechecks provider access, consumes complete pagination, routes restricted installations to GitHub-owned access surfaces, auto-continues an unambiguous repository, limits React to coarse-state observation, and exposes reconnect only when managed GitHub authorization actually requires user action. Browser and architecture acceptance explicitly forbid the old Refresh/Grant/Manage/manual-acquire workflow.

## Still required before release-candidate closure

1. Implement the reopened non-device UX remediation in the order governed by `docs/implementation/v1.1-complete-implementation-plan.md`.
2. Establish a **new** combined product/test candidate and permanent hosted Verify evidence after mobile geometry/menu, Settings IA, Repeat integration/atomic save and replacement drag code are complete.
3. Run J110-IMP-09 on the exact new candidate APK. The old Pangea APK/result cannot close this gate.
4. Run the remaining J110-IMP-15 physical/native matrix, including the complete mobile touch/menu/Task form/Settings usability audit plus native Git/reminder/lifecycle/interoperability checks.
5. Complete the external live Linux/Desktop GitHub acceptance tracked by issue #31.
6. Only after all of the above may the `release/v1.1.0` metadata/tag/Release/F-Droid publication ceremony proceed.

Local `act` remains optional developer preflight; hosted permanent workflows are authoritative.

## Physical-device evidence

**PARTIAL PHYSICAL FEEDBACK RECORDED / CERTIFICATION NOT CLOSED.** Physical Android use has produced a blocking FAIL for the Pangea drag interaction (unreliable destination/drop with stranded floating-card behavior) and material UX findings for touch density, Settings and Repeat composition. Those findings reopened the design. J110-IMP-09 must be rerun on the replacement implementation; the full J110-IMP-15 matrix remains open.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
