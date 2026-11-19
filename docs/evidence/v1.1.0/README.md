# Jig v1.1.0 implementation evidence

**Status:** PHYSICAL-ACCEPTANCE REMEDIATION OPEN / J110-IMP-09 COMPLETE / J110-IMP-18..21 OPEN / J110-IMP-15 PARTIAL + LIVE DESKTOP ACCEPTANCE OPEN — prior post-UX candidate `611c8ced6a854a80f24bf727c53d792f5c5d556c` remains certified historical non-device evidence. Executable head `222f2fe0e672b122424042b3fa39747efb991610` adds the Desktop Secret Service and Android Git synchronization corrections and has 41/41 local test files / 252/252 tests plus physical Samsung SM-S901E synchronization/restart evidence. Hosted Verify #1541 passed Linux/browser and Android build certification but the API-24 emulator failed to boot before instrumentation. Physical use exposed bounded UX/domain defects now governed by IMP-18..21; J110-IMP-15 cannot close until those corrections are implemented and re-certified. Live Linux/Desktop GitHub acceptance remains issue #31.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Prior certified post-UX non-device baseline

- Authoritative integration branch: `v1.1`. The completed non-device tree and both branch histories were integrated into `v1.1` by merge commit `fceaed0ae9a6adfeb8dc16f628fa9578a726a5cd`; temporary work/CI branches are not implementation-state authority.
- **Certified executable/product source candidate:** `611c8ced6a854a80f24bf727c53d792f5c5d556c`.
- **Permanent Verify workflow:** run `44547579822` / run number `1521`.
- **Workflow result: PASS** — Linux/browser Verify, deterministic Android build/F-Droid certification and Android API-24 runtime all completed successfully on the same exact source candidate.
- Linux/browser evidence: **41/41 test files and 250/250 core/integration/architecture tests passed**; production build passed; browser bootstrap smoke passed; **80/80 real-browser tests passed**; shell syntax and installer/lifecycle smoke passed.
- **Reviewed governed browser evidence:** artifact `14539814508`, `jig-v1.1-browser-evidence-b9a9f8f5abdc428247551e5f6ce20c98230d1427`, artifact digest `sha256:000c80a107353d1e38d796fe82dce5b292dfd444fd944ba9aad424351b147b4f`. Artifact metadata records source head `611c8ced6a854a80f24bf727c53d792f5c5d556c`; the artifact name uses the PR merge-ref SHA.
- The reviewed matrix includes configured desktop/mobile Planner populated + empty, History populated + empty, Settings default + Diagnostics, synchronization attention/recovery, Task form off/Weekly/Monthly/stop, desktop/mobile active drag, representative Jig Light/Dark, onboarding initial/authorization/repository/finishing/attention and desktop local-repository setup, with compact configured states exercised at 320/360/390/414 where governed.
- **UX-F7 expert review result: PASS.** Review checked hierarchy, action prominence, scan density, typography/spacing rhythm, cross-surface design language, semantic-state distinction, active-surface focus and compact reachability against the corrected UX-F0 authority. Two defects found during review—duplicate sync recovery inside Settings and duplicate compact empty-Planner primary Add—were corrected before this candidate and are absent from the retained artifact.
- Android development APK artifact: `14541004265`, `jig-android-debug-b9a9f8f5abdc428247551e5f6ce20c98230d1427`, artifact digest `sha256:e6f12bf275b921ea2cc2e9ff5094dea71b9c5c6cc441dd910a8f85515cb662ca`. Artifact metadata records source head `611c8ced6a854a80f24bf727c53d792f5c5d556c`.
- Android API-24 instrumentation: `cd android && ./gradlew :app:connectedDebugAndroidTest` ended **`BUILD SUCCESSFUL`**.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

This candidate remains valid provenance for the gates it actually passed, but it is **not** the current release-candidate lineage after later executable changes. J110-IMP-09 remains complete, but the 2026-11-20 executable/session evidence and the amended IMP-18..21 authority supersede this baseline for final certification.

## Current executable / physical-session evidence — 2026-11-20

- Executable source head exercised: `222f2fe0e672b122424042b3fa39747efb991610`.
- Desktop Secret Service prerequisite correction: **PASS** — the runtime uses a non-mutating lookup instead of `secret-tool --version`; configured bootstrap/service state was preserved and healthy.
- Local verification: **PASS — 41/41 test files, 252/252 tests**, plus typecheck and targeted Secret Service/Android Git tests.
- Physical Android device: **Samsung SM-S901E**, Android **16 / API 36**.
- Installed package: `com.pontivus.jig`.
- Physical APK SHA-256: `b3d134786827dea601f4f3cbd89ad4269578393151efd5dab056812a682c8d4b`.
- Physical-device preflight: **PASS**.
- Android Git synchronization: **PASS for the exercised path** — local Android changes committed, remote push completed, Settings reported **Up to date**, and restart/relaunch preserved Planner data and synchronization state.
- Physical UI evidence was captured for Planner, Task form/IME, Repeat states, History, Settings and healthy synchronization, but review exposed the IMP-18/19/20 defects recorded below; this evidence therefore cannot close IMP-15.
- Hosted Verify run `44635494793` / #1541 on exact head `222f2fe…`: Linux/browser **PASS**, Android build certification **PASS**, API-24 runtime **INFRASTRUCTURE FAILURE before instrumentation** because `emulator-5554` never appeared and the boot wait timed out. A green permanent Verify is still required for the final executable candidate.

**Physical acceptance findings that reopen implementation:**
1. compact header identity/title/chrome and interactive-label legibility;
2. Task grip/checkbox vertical alignment;
3. explicit current/future scheduling rule plus past-date rejection feedback;
4. recurring rollover non-accumulation.

These are governed by J110-IMP-18..21. They do not reopen the already-proved Android Git synchronization fix, Secret Service fix, GitHub orchestration architecture or dnd-kit framework ownership.

## Historical pre-remediation candidate

- Governed integration branch: `v1.1` via PR #32.
- Certified product/test candidate commit: `d29df9ebeb05eaf44666d12f6ee20ccd81673d32`.
- Permanent Verify workflow: run `44450324316` / run number `1368`.
- Verification-only trigger PR: #33, closed without merge after certification.
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build/F-Droid certification and Android API-24 runtime all completed successfully.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

This candidate is retained as historical pre-remediation evidence. The required replacement product/test candidate and permanent Verify run are now the current combined candidate recorded above. Do not cite run 44450324316 as proof that the amended FR-03/FR-24/FR-28/FR-29/FR-31 contracts pass. The Android Git transport proof remains valid for transport capability, but the prior interoperability coverage did not exercise Desktop/Linux adopting a valid Android remote advance through the real Desktop synchronization controller.

The post-UX candidate is reviewed against `../../design/reference/jig-v1.1-application-ux-ui-governed-reference.html`, `../../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html`, `../../design/reference/jig-v1.1-desktop-onboarding-task-form-governed-reference.html`, `../../design/ui-solution.md`, `../../design/brand-and-theme.md` and the UX-F0 fidelity audit. Historical reference assets and pre-remediation implementation remain evidence/provenance only where superseded.

## Hosted non-device evidence ledger

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | **PASS** — run `44547579822` / #1521 on source head `611c8ced6a854a80f24bf727c53d792f5c5d556c`; 41/41 test files and 250/250 core/integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 80/80 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Governed browser screenshot evidence | **PASS / EXPLICITLY REVIEWED** — artifact `14539814508` on exact source head `611c8ced6a854a80f24bf727c53d792f5c5d556c` contains the governed desktop/mobile UX-F7 state matrix and was reviewed against the UX-F0 authority for hierarchy, density, prominence, legibility, design-language consistency, semantic states and active-surface focus. Artifact digest `sha256:000c80a107353d1e38d796fe82dce5b292dfd444fd944ba9aad424351b147b4f`. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is not evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS** — run `44547579822`; Gradle dependency locks, Android unit/static checks, FLOSS boundary, version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention passed. APK artifact id `14541004265`. |
| Android API-24 instrumentation | **PASS** — run `44547579822`; `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
| Android bundled SQLite transaction/restart proof | **PASS at the native-driver/API-24 boundary** — covered by the committed API-24 instrumentation. Cross-platform physical-device continuity remains J110-IMP-15 evidence. |
| Cross-installation synchronization convergence | **PASS for repository/host/emulator scope** — reciprocal Desktop→Android→Desktop and Android→Desktop→Android coverage, the four normal FR-24 outcomes, SYNC-E1..SYNC-E6, unrelated-repository preservation and architecture/strict-typing gates pass on the certified candidate. Physical same-repository confirmation remains J110-IMP-15 evidence. |
| Android Git native HTTP transport | **PASS at the native-transport/API-24 boundary** — selected native smart-HTTP/isomorphic-git transport remains certified; live private-repository acquisition remains external/physical evidence. |
| Android GitHub Device Flow native HTTP composition | **PASS** — shared Device Flow request/poll/user-lookup contract is exercised through the Android native HTTP adapter, including canonical client ID, `offline_access`, pending→authorized transition and absence of `client_secret`/`redirect_uri`. Live authorization remains external/physical evidence. |
| Android reminder scheduling/reconciliation | **PASS for repository/emulator-capable semantics** — permanent unit/reconciliation coverage passed. API 31/33/36 policy/permission behavior and physical notification delivery remain J110-IMP-15 evidence. |
| F-Droid candidate metadata lint | **PASS** — permanent Android certification lint passed against the pinned F-Droid category authority. External submission/publication has not occurred. |
| FLOSS/proprietary dependency gate | **PASS** — no Play Services/Firebase/proprietary runtime SDK is accepted by the permanent Android gate. |
| Linux x64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Linux arm64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Local `act` rehearsal | **NOT A CLOSURE GATE** — optional developer preflight only. Permanent hosted Verify/Release are authoritative. |
| Live Linux/Desktop GitHub Device Flow/private-repo acquisition | **IMPLEMENTATION COMPLETE / EXTERNAL LIVE ACCEPTANCE PENDING** — deterministic protocol, Secret Service, managed transport, pagination, access recheck, clone/adoption, refresh/reconnect and failure semantics are permanently tested. Real interactive acceptance remains issue #31. |
| Live/physical Android GitHub Device Flow/private-repo acquisition | **PENDING physical-device verification** under J110-IMP-15. |

## Non-device functional + UX/UI closure audit

The current candidate retains the already-certified synchronization convergence, recurrence/domain semantics, bootstrap/GitHub orchestration, Android build/runtime boundaries and replacement dnd-kit movement candidate, and now additionally closes the reopened presentation-fidelity scope through UX-F0..UX-F7. Geometry assertions and screenshots remain supporting evidence; closure is based on the governed state matrix plus explicit visual review.

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
- Android SQLite, Git **transport capability**, GitHub Device Flow composition, reminder reconciliation, dependency/FLOSS boundary and F-Droid candidate path have permanent host/emulator certification; bidirectional Desktop/Linux ↔ Android synchronization convergence is now separately closed by the reciprocal controller-level tests and SYNC-E1..SYNC-E6 matrix recorded above;
- permanent architecture tests enforce these ownership boundaries so the closure is regression-protected.

The real Linux/Desktop Device Flow/private-repository exercise is deliberately classified as **external live acceptance**, not unfinished repository implementation: it requires an interactive GitHub user authorization and live Secret Service environment that the connected repository execution surface cannot manufacture. Its absence does not authorize additional code or a substitute authentication architecture.

## Development APK identity

The development APK retained by permanent Verify run `44547579822` is the **post-UX physical-certification input**; it is not a GitHub Release asset or public Android distribution channel.

- Certified executable source head: `611c8ced6a854a80f24bf727c53d792f5c5d556c`.
- GitHub Actions artifact id: `14541004265`.
- Artifact name: `jig-android-debug-b9a9f8f5abdc428247551e5f6ce20c98230d1427` (artifact naming uses the PR merge-ref SHA; source head is recorded above).
- Artifact ZIP size: `7,172,937` bytes.
- Artifact digest: `sha256:e6f12bf275b921ea2cc2e9ff5094dea71b9c5c6cc441dd910a8f85515cb662ca`.
- APK file in the artifact: `app-debug.apk`.
- Unpacked `app-debug.apk` size: `9,779,844` bytes.
- Unpacked `app-debug.apk` SHA-256: `27449f443a5617bd1cd7bbfec2ac0971e4104d647ff77c6975df06139e15c52d`, computed directly from artifact `14541004265`.
- Repository package authority expects Android application ID `com.pontivus.jig` with package-derived version identity. The physical preflight must still verify those APK badging fields with governed Build Tools `aapt`; the recorded SHA does not substitute for that check.

Before physical certification, the device preflight must record/verify the unpacked APK identity/hash for this exact artifact. Any later **executable** change invalidates that APK identity and requires a new certified artifact; later documentation-only closure commits do not change the recorded executable/APK lineage.

## Known corrective evidence

The candidate includes a browser-bootstrap correction for the Android Git runtime boundary. Static reachability from the browser entrypoint had pulled `isomorphic-git`'s Node `Buffer` path into the production browser bundle, causing module-evaluation failure before React mounted. The corrected boundary dynamically loads `runtime-native` only after `Capacitor.isNativePlatform()` is true, and dynamically loads Android GitHub onboarding only on the native path. Permanent architecture tests forbid the static native imports, and the hosted bootstrap smoke plus the current 80/80 browser suite pass prove the browser surface mounts correctly.

The 2026-11-19 authority remediation also replaced the superseded process-shaped setup/reconnect presentation. The certified candidate keeps onboarding inside the canonical Jig shell, presents one Connect GitHub repository intent plus GitHub's required user code/Copy/Open-GitHub handoff, automatically polls and rechecks provider access, consumes complete pagination, routes restricted installations to GitHub-owned access surfaces, auto-continues an unambiguous repository, limits React to coarse-state observation, and exposes reconnect only when managed GitHub authorization actually requires user action. Browser and architecture acceptance explicitly forbid the old Refresh/Grant/Manage/manual-acquire workflow.

## Still required before release-candidate closure

The 2026-11-20 physical session has reopened bounded implementation work. Required order:

1. Implement and close **J110-IMP-18** compact shell/typography/Task-leading alignment.
2. Implement and close **J110-IMP-19** canonical current/future scheduling + past-date feedback.
3. Implement and close **J110-IMP-20** recurrence-aware rollover non-accumulation.
4. Close **J110-IMP-21** with complete automated/browser/hosted/physical recertification on one exact executable head; permanent hosted Verify must be green.
5. Complete the remaining **J110-IMP-15** physical/native matrix and formal evidence disposition. J110-IMP-09 remains complete and is not rerun merely to reconstruct its lost record.
6. Complete the external live Linux/Desktop GitHub Device Flow/private-repository acceptance tracked by **issue #31**.
7. Only then may `v1.1` be promoted to `master` and the governed release ceremony begin.

Do not create a competing branch, platform-specific recurrence/scheduling rule or substitute UI/error architecture to close these findings.

## Physical-device evidence

Use [physical-android-certification.md](physical-android-certification.md) as the canonical physical record. It preserves J110-IMP-09 as complete with its detailed record lost and now records the 2026-11-20 **partial IMP-15** session on source `222f2fe0e672b122424042b3fa39747efb991610`, Samsung SM-S901E / Android 16 API 36, package `com.pontivus.jig`, APK SHA-256 `b3d134786827dea601f4f3cbd89ad4269578393151efd5dab056812a682c8d4b`. This is partial evidence only; a new final candidate lineage is required after IMP-18..20.

**J110-IMP-09 COMPLETE / DETAILED EXECUTION RECORD LOST / J110-IMP-15 OPEN.** The earlier Pangea failure and associated UX findings reopened the design; the replacement Task-movement implementation was subsequently exercised successfully on physical Android. The detailed IMP-09 execution record was not retained, so unknown device, source/APK and per-check facts must not be reconstructed. The remaining physical work is the J110-IMP-15 matrix.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
