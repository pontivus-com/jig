# Jig v1.1.0 implementation evidence

**Status:** POST-REMEDIATION BASELINE EVIDENCE RETAINED / J110-IMP-09 + J110-IMP-18..20 COMPLETE / J110-IMP-21 PHYSICAL CONFIRMATION ATTEMPTED AND BLOCKED / J110-IMP-23 REOPENED FOR FR-33/SD-43 CROSS-PLATFORM WEEKPAGER / J110-IMP-15 PARTIAL + LIVE DESKTOP ACCEPTANCE OPEN — exact executable/certification head `3b60ad938f2173521c4eb2aa8b59603a15d930b1` passed permanent Verify `44652277552` / #1598 across Linux/browser, Android build certification and API-24 instrumentation and remains valid evidence for the bounded IMP-18..20 remediation. It does **not** certify the later WeekPager executable work or rewritten IMP-23. The hosted matrix passed 41/41 core/integration/architecture files (261/261 tests), production build, browser bootstrap, 79/79 real-browser tests, Android static/build/FLOSS/F-Droid checks and 5/5 API-24 instrumentation tests. Governed browser evidence artifact `14591328349` has been explicitly reviewed. Android artifact `14591926175` was physically launched on the connected Samsung SM-S901E: compact-shell and past-date rejection checks passed, but one-off and recurring Task creation both failed with `Illegal invocation`, so IMP-21 and J110-IMP-15 remain open. Live Linux/Desktop GitHub acceptance issue #31 remains open.

**WeekPager evidence boundary (2026-11-20):** FR-33/SD-43 supersede the raw-pointer and `usePanGesture` week-navigation implementations. Any retained browser/APK result below that exercised either prior adapter remains historical evidence only. No existing artifact is WeekPager acceptance evidence. Rewritten J110-IMP-23 requires one new exact-head hosted/browser/physical lineage before closure.

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

This candidate remains valid provenance for the gates it actually passed, but it is **not** the current release-candidate lineage after later executable changes. J110-IMP-09 remains complete, but the 2026-11-20 executable/session evidence and the amended IMP-18..23 authority supersede this baseline for final certification.

## Current post-remediation certified candidate — 2026-11-20

- Exact certified source/head: `3b60ad938f2173521c4eb2aa8b59603a15d930b1`.
- Permanent Verify: `44652277552` / #1598 — **PASS** across all three required jobs.
- Linux/browser: strict typecheck **PASS**; 41/41 core/integration/architecture files, 261/261 tests **PASS**; production build **PASS**; browser bootstrap **PASS**; 79/79 real-browser tests **PASS**; installer/lifecycle smoke **PASS**.
- Reviewed browser evidence: artifact `14591328349`, digest `sha256:67c64be9e1c13206aeecfeb5d303bdf10000a99f6220d3700fa2b0a18106310a`, size 2,600,766 bytes. Explicit review confirms the amended compact header/title ownership, body-scale interactive typography, centered Task leading controls and no idle desktop-onboarding scrollbar.
- Android build certification: **PASS**; artifact `14591926175`, digest `sha256:dbb4f96a39af353adfee7360d2b0ebe36ae954d119407273a486fd66e6b610b9`, ZIP size 7,173,854 bytes.
- Unpacked `app-debug.apk`: 9,780,552 bytes; SHA-256 `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0`.
- API-24 runtime: **PASS** — Android Emulator 37.3.10 booted with `ANDROID_I_WANT_MY_TCG=yes`; 5/5 instrumentation tests completed; Gradle ended `BUILD SUCCESSFUL`.
- The TCG environment flag is a narrow hosted-runner compatibility correction. Emulator 37.3.10 had begun rejecting the action's software `-accel off` fallback before instrumentation; the prior product/test code was not implicated.
- J110-IMP-18, IMP-19 and IMP-20 are **COMPLETE**. J110-IMP-21 is **IN PROGRESS** only for focused physical Android confirmation.

### Local follow-up correction — mobile header safe-area inset

- The focused physical review found a redundant Android top safe-area inset above the mobile Jig logo. The follow-up source correction removes that duplicate inset from the narrow application and onboarding headers; the governed mobile application row remains 52px.
- Initial local header-only rebuild: SHA-256 `128bc37c2c2a10024d2b665b92a5ad74336086479f154a5d845de1d8fb733571`.
- Connected Samsung SM-S901E verification: application row measured **52px**, narrow header computed top padding **0px**, and the captured screen shows no empty band above the Jig logo.
- This is a new executable change after certified candidate `3b60ad…`; it requires a fresh hosted Verify and exact APK artifact before it can amend release-candidate certification. The `Illegal invocation` failure remains recorded against the older hosted artifact until that new exact artifact is certified.
- The same local follow-up APK also contains the native UUID-callback correction: physical one-off creation, Weekly recurring creation through the end-date form, and restart persistence all passed; the error did not recur. Local APK SHA-256 is `2755064c364fb1e54b958d6a32848510037cd651323e826fbd36a928606bf338`.
- The final local follow-up also adds the mobile History/Settings inset correction. On Samsung SM-S901E, both destinations measured `padding-inline-start/end: 4px`, matching the narrow Planner track inset; final local APK SHA-256 is `e5ea7fb1b229adfcdbc39f44e6285af858fcbc00a799aeafcb103240e489181c`.
- The latest local follow-up adds narrow Planner current-day anchoring. On Samsung SM-S901E, Planner launch/relaunch measured the current-day section at the content viewport top with `scrollTop: 293.33px`; an active downward swipe exposed the preceding Monday–Thursday sections. Final local APK SHA-256 is `b7d86d3355ed5d41bf8b2cd77364c2f6182fa38584fba73f795deb5de02e12db`.
- The latest local follow-up adds the reminder lifecycle correction. Future cards show `Reminder scheduled`; elapsed incomplete current-day reminders show `Reminder due · time passed`; after the browser service-worker or Android local-notification adapter reports display, the card shows `Reminder notified`. Android already-due reminders now request an immediate foreground notification with an explicitly non-exact request, avoiding an unnecessary exact-alarm settings detour.
- On Samsung SM-S901E / Android 16, the connected foreground app produced a real `Jig reminder` notification for the already-due `Audit Workflow` Task while the app was open; returning to Jig showed `Reminder notified` on the card. Evidence screenshots: `/tmp/jig-reminder-after-rebuild.png` and `/tmp/jig-reminder-notified-card.png`. Final local APK SHA-256 is `f3ddc820d7519a7aff32841e3dda1e886eaba2f4db1e1041c5dc20d79d02387f`.
- The latest local follow-up adds Android Back navigation through the existing destination owner: Back returns Settings → History → Planner, closes the Task workspace after Android first dismisses the focused keyboard, and exits at the Planner root. The installed local APK SHA-256 is `e28953853c242fd68ab41e533ff40567cddf57b7f4d8d5eccf52c37fe538141f`; source tests/typecheck passed at 42 files / 264 tests. Hosted re-certification remains required for this executable change.
- Hosted re-certification is still required before this local result can close IMP-21/IMP-15; issue #31 live Linux/Desktop acceptance and the remaining physical synchronization/notification matrix remain open.

### Local follow-up correction — Android system-bar appearance

- Android now applies the resolved Astryx Light/Dark/System mode to native status/navigation-bar indicator contrast through the narrow `JigSystemBars` adapter.
- Physical Samsung SM-S901E verification passed while the device remained Dark: Jig Light produced light-indicator window flags (`vsysui=2010`), Jig Dark produced `vsysui=1612`, and System followed the device's dark mode with `vsysui=1612`.
- Local debug APK SHA-256: `54bf1cefae429196e7622bfdc6cf33e544b0853ecd927760fb443db0d8cc6237`. Hosted re-certification remains required.

### Local follow-up correction — notified reminder card highlight

- The Task card warning highlight now represents unresolved elapsed reminder attention only; it is removed when the lifecycle reaches `Reminder notified`, while the lifecycle label remains visible.
- Browser reminder coverage passed 12/12 tests. On Samsung SM-S901E / Android 16, both physically visible `Reminder notified` cards had no `jig-task-card-reminder-due` class.
- Local debug APK SHA-256: `e656f2751c243f245c54b307285b4975b5b4aacf3ad283c318383369f7f79440`. Hosted re-certification remains required.

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
- Hosted Verify run `44635494793` / #1541 on exact head `222f2fe…`: Linux/browser **PASS**, Android build certification **PASS**, API-24 runtime **INFRASTRUCTURE FAILURE before instrumentation** because `emulator-5554` never appeared and the boot wait timed out. This remains historical session evidence; the later exact post-remediation candidate satisfied the permanent hosted requirement in run #1598.

**Physical acceptance findings that reopen implementation:**
1. compact header identity/title/chrome and interactive-label legibility;
2. Task grip/checkbox vertical alignment;
3. explicit current/future scheduling rule plus past-date rejection feedback;
4. recurring rollover non-accumulation.

These findings were governed by J110-IMP-18..23. IMP-18..20 remain implemented/non-device certified; IMP-21 owns the remaining focused physical confirmation, IMP-22 owns non-paging motion closure, and IMP-23 is now reopened for the FR-33/SD-43 cross-platform WeekPager refactor. This redesign does not reopen the already-proved Android Git synchronization fix, Secret Service fix, GitHub orchestration architecture or SD-34/35 dnd-kit framework ownership.

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
| Linux/browser permanent Verify | **PASS — CURRENT** — run `44652277552` / #1598 on exact source head `3b60ad938f2173521c4eb2aa8b59603a15d930b1`; 41/41 test files and 261/261 core/integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 79/79 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Governed browser screenshot evidence | **PASS / EXPLICITLY REVIEWED — CURRENT** — artifact `14591328349`, `jig-v1.1-browser-evidence-184c8c824b32ff53c53136eaf1c1e4ab78fe480a`, on exact source head `3b60ad938f2173521c4eb2aa8b59603a15d930b1`; artifact digest `sha256:67c64be9e1c13206aeecfeb5d303bdf10000a99f6220d3700fa2b0a18106310a`. Review confirms Jig identity + centered Planner/History/Settings title, compact/readable navigation typography, centered Task leading controls and no idle desktop-onboarding scrollbar. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is not evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS — CURRENT** — run `44652277552` / #1598; Gradle dependency locks, Android unit/static checks, FLOSS boundary, version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention passed. APK artifact id `14591926175`. |
| Android API-24 instrumentation | **PASS — CURRENT** — run `44652277552` / #1598; current Android Emulator 37.3.10 booted under the explicit TCG software-emulation allowance, 5/5 instrumentation tests completed, and `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
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

The current candidate retains the already-certified synchronization convergence, bootstrap/GitHub orchestration, Android build/runtime boundaries and replacement dnd-kit movement owner, and additionally closes the latest IMP-18 presentation remediation, IMP-19 active-scheduling rule and IMP-20 recurrence-rollover non-accumulation. Geometry assertions and screenshots remain supporting evidence; presentation closure is based on the governed state matrix plus explicit visual review.

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

The development APK retained by permanent Verify run `44652277552` / #1598 is the **current post-remediation physical-certification input**; it is not a GitHub Release asset or public Android distribution channel.

- Certified executable/source head: `3b60ad938f2173521c4eb2aa8b59603a15d930b1`.
- GitHub Actions artifact id: `14591926175`.
- Artifact name: `jig-android-debug-184c8c824b32ff53c53136eaf1c1e4ab78fe480a` (artifact naming uses the PR merge-ref SHA; source head is recorded above).
- Artifact ZIP size: `7,173,854` bytes.
- Artifact digest: `sha256:dbb4f96a39af353adfee7360d2b0ebe36ae954d119407273a486fd66e6b610b9`.
- APK file in the artifact: `app-debug.apk`.
- Unpacked `app-debug.apk` size: `9,780,552` bytes.
- Unpacked `app-debug.apk` SHA-256: `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0`, computed directly from artifact `14591926175`.
- Repository package authority expects Android application ID `com.pontivus.jig` with package-derived version identity. The physical preflight must still verify those APK badging fields with governed Build Tools `aapt`; the recorded SHA does not substitute for that check.

Before physical certification, the device preflight must record/verify the unpacked APK identity/hash for this exact artifact. Any later **executable** change invalidates that APK identity and requires a new certified artifact; later documentation-only closure commits do not change the recorded executable/APK lineage.

## Known corrective evidence

The candidate includes a browser-bootstrap correction for the Android Git runtime boundary. Static reachability from the browser entrypoint had pulled `isomorphic-git`'s Node `Buffer` path into the production browser bundle, causing module-evaluation failure before React mounted. The corrected boundary dynamically loads `runtime-native` only after `Capacitor.isNativePlatform()` is true, and dynamically loads Android GitHub onboarding only on the native path. Permanent architecture tests forbid the static native imports, and the hosted bootstrap smoke plus the current 79/79 browser suite pass prove the browser surface mounts correctly.

The 2026-11-19 authority remediation also replaced the superseded process-shaped setup/reconnect presentation. The certified candidate keeps onboarding inside the canonical Jig shell, presents one Connect GitHub repository intent plus GitHub's required user code/Copy/Open-GitHub handoff, automatically polls and rechecks provider access, consumes complete pagination, routes restricted installations to GitHub-owned access surfaces, auto-continues an unambiguous repository, limits React to coarse-state observation, and exposes reconnect only when managed GitHub authorization actually requires user action. Browser and architecture acceptance explicitly forbid the old Refresh/Grant/Manage/manual-acquire workflow.

## Still required before release-candidate closure

J110-IMP-18, IMP-19 and IMP-20 are implemented and non-device certified. Remaining order:

1. Finish J110-IMP-23's cross-platform WeekPager hard cut, then produce a fresh hosted-certified artifact containing that exact pager implementation together with the mobile-header, History/Settings inset, Planner current-day anchoring and native UUID-callback corrections; do not add an Android-only gesture/workaround.
2. Re-run the focused **J110-IMP-21 physical Android confirmation** on that exact candidate, including compact header/title/height, readable interactive labels, grip/checkbox centering, Task creation, past-date rejection feedback, recurrence non-accumulation, restart persistence and synchronization continuity.
3. Complete the remaining **J110-IMP-15** physical/native matrix, including the J110-IMP-23 populated-region week swipe in both directions with interruption and vertical-scroll checks. J110-IMP-09 remains complete and is not rerun merely to reconstruct its lost record.
4. Complete the external live Linux/Desktop GitHub Device Flow/private-repository acceptance tracked by **issue #31**.
5. Only then may `v1.1` be promoted to `master` and the governed release ceremony begin.

Do not create a competing branch, platform-specific recurrence/scheduling rule or substitute UI/error architecture to close these findings.

## Physical-device evidence

Use [physical-android-certification.md](physical-android-certification.md) as the canonical physical record. It preserves J110-IMP-09 as complete with its detailed record lost and preserves the 2026-11-20 Samsung/Android-16 session on source `222f2fe…` as partial historical IMP-15 evidence. The **current post-remediation physical candidate** is source `3b60ad938f2173521c4eb2aa8b59603a15d930b1`, APK artifact `14591926175`, unpacked APK SHA-256 `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0`.

**J110-IMP-09 COMPLETE / DETAILED EXECUTION RECORD LOST / J110-IMP-18..20 COMPLETE / J110-IMP-21 PHYSICAL CONFIRMATION OPEN / J110-IMP-23 REOPENED FOR FR-33/SD-43 IMPLEMENTATION + CERTIFICATION / J110-IMP-15 PARTIAL.** The replacement Task-movement implementation remains closed. The detailed IMP-09 record was not retained and must not be reconstructed. The `3b60ad9…` remediation remains certified for its tested scope only; WeekPager, its exact-head hosted run, physical Android paging/scroll/drag arbitration and the remaining IMP-15 matrix are still open.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
