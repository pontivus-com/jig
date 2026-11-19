# Jig v1.1.0 implementation evidence

**Status:** NON-DEVICE IMPLEMENTATION COMPLETE, including the 2026-11-19 intent-first onboarding/reconnect/Settings remediation. Permanent hosted certification passes for every repository/host/browser/Linux/CI/emulator-testable implementation surface on the product/test candidate below. Remaining closure work is external live-acceptance evidence and the explicitly physical-device portions of J110-IMP-09/J110-IMP-15. This file does not constitute physical-device evidence.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Certified product/test candidate

- Governed integration branch: `v1.1` via PR #32.
- Certified product/test candidate commit: `d29df9ebeb05eaf44666d12f6ee20ccd81673d32`.
- Permanent Verify workflow: run `44450324316` / run number `1368`.
- Verification-only trigger PR: #33, closed without merge after certification.
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build/F-Droid certification and Android API-24 runtime all completed successfully.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

The product/test candidate is the source state certified by the hosted run. Later evidence-only/documentation commits do not replace this candidate unless they alter executable/product/test behavior.

## Hosted non-device evidence ledger

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | **PASS** — run `44450324316`; 40 test files / 217 core-integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 66/66 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is no longer evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS** — Gradle dependency-lock verification, Android unit/static checks, FLOSS dependency boundary, Android version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention all passed in run `44450324316`. |
| Android API-24 instrumentation | **PASS** — run `44450324316`; Android 7.0 / API 24 x86_64 emulator; 5/5 instrumentation tests completed successfully; Gradle `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
| Android bundled SQLite transaction/restart proof | **PASS at the native-driver/API-24 boundary** — covered by the committed API-24 instrumentation. Cross-platform physical-device continuity remains part of J110-IMP-15. |
| Android Git native HTTP transport | **PASS at the native-transport/API-24 boundary** — committed instrumentation passed; host smart-HTTP/portable interoperability coverage is included in the 210-test core/integration result. Live private-repository acquisition remains external/physical evidence. |
| Android GitHub Device Flow native HTTP composition | **PASS** — the shared Device Flow request/poll/user-lookup contract is exercised through the Android native HTTP adapter, including canonical client ID, `offline_access`, pending→authorized transition and absence of `client_secret`/`redirect_uri`. Live authorization remains external/physical evidence. |
| Android reminder scheduling/reconciliation | **PASS for implemented host/reconciliation semantics** — permanent unit/reconciliation coverage passed. API 31/33/36 policy/permission behavior and physical notification delivery remain J110-IMP-15 evidence. |
| F-Droid candidate metadata lint | **PASS** — permanent Android certification lint passed against the pinned F-Droid category authority. External submission/publication has not occurred. |
| FLOSS/proprietary dependency gate | **PASS** — permanent Android runtime dependency boundary passed; no Play Services/Firebase/proprietary runtime SDK is accepted by the gate. |
| Linux x64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Linux arm64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Local `act` rehearsal | **NOT A CLOSURE GATE** — optional developer preflight only. Permanent hosted Verify/Release are authoritative; no local Actions scaffolding is committed in the candidate. |
| Live Linux/Desktop GitHub Device Flow/private-repo acquisition | **IMPLEMENTATION COMPLETE / EXTERNAL LIVE ACCEPTANCE PENDING** — deterministic protocol, Secret Service, managed transport, complete installation/repository pagination, provider-access recheck, clone/adoption, refresh/reconnect and failure semantics are implemented and permanently tested. A real user authorization/private-repository run remains external acceptance evidence tracked by issue #31. |
| Live/physical Android GitHub Device Flow/private-repo acquisition | **PENDING physical-device verification**. |

## Non-device implementation closure audit

The v1.1 repository has no known remaining non-device implementation defect.

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

No non-device repository implementation gap remains.

The remaining governed evidence is:

1. **External live acceptance:** verify the live **Jig Desktop & Mobile** GitHub App configuration and execute real Linux/Desktop Device Flow plus selected private-repository acquisition/synchronization through Secret Service. This is issue #31 acceptance evidence, not an unfinished code task.
2. **Physical device:** execute J110-IMP-09 on a physical Android phone, including the exact drag/drop inter-card-gap gate.
3. **Physical/native matrix:** execute the J110-IMP-15 Android API 24/31/33/36 matrix with at least one physical phone, including GitHub authorization/private clone, same portable dataset as Linux, offline CRUD/order, safe-area/sticky header, rollover, native reminder policy/permission/failure semantics, notification reconciliation, token expiry/reconnect, restart persistence, reconnect-after-network, Git interoperability and uninstall/reinstall continuity.
4. Record the physical device make/model, Android/API/WebView versions, exact source/APK identity and results here.
5. Only after external-live and physical evidence closure may the separate `release/v1.1.0` metadata transition, immutable tag/Release workflow and external F-Droid submission/publication proceed.

Local `act` rehearsal is optional developer preflight and is no longer a release-candidate closure requirement; the permanent hosted workflows are authoritative.

## Physical-device evidence

**NOT RUN in this ledger.** J110-IMP-09 and the physical portions of J110-IMP-15 require a recorded physical Android device, exact candidate APK/source SHA, device/API/WebView versions and the complete governed interaction/synchronization/reminder matrix.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
