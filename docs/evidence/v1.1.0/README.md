# Jig v1.1.0 implementation evidence

**Status:** NON-DEVICE IMPLEMENTATION CLOSED / PHYSICAL-LIVE ACCEPTANCE OPEN — the combined repository/host/emulator candidate is permanently certified. Only J110-IMP-09 physical Task-movement proof, J110-IMP-15 physical/native certification, issue #31 live Linux/Desktop GitHub acceptance and the later governed release ceremony remain open.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Current combined non-device candidate

- Final integration branch: `work/v1.1-final-non-device-candidate-20261119`, tracked by PR #43 into `v1.1`. It freezes the completed tree directly on the current `v1.1` authority tip; the superseded work branch remains audit history only.
- Certified executable/product source candidate: `305b2cd8f14f8f6ac791e3d5d07340b9d5e45efd`. Subsequent changes before the final branch freeze are documentation/evidence reconciliation only.
- Permanent executable-candidate Verify workflow: run `44516299671` / run number `1460`. The final authority-aligned branch is revalidated through CI-only PR #44 before physical certification.
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build/F-Droid certification and Android API-24 runtime all completed successfully on the same candidate.
- Linux/browser evidence: 41/41 test files and 250/250 core/integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 77/77 real-browser tests passed; shell syntax and installer/lifecycle smoke passed.
- Governed browser screenshots: artifact `14525538706`, `jig-v1.1-browser-evidence-4acbe0926e8409b01668a829f90dc4b96d778298`, ZIP digest `sha256:7b3cdc34b75fb8c89cb1df1dcd14f8843303c4b639895f83ba62d4d2d91a3314`.
- Android development APK artifact: `14525298721`, `jig-android-debug-4acbe0926e8409b01668a829f90dc4b96d778298`, artifact ZIP digest `sha256:34f7fde304b8fb041d4101430c65d420589954f3fef4b2cbb125bf1fa50022fe`.
- Android API-24 instrumentation: `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

This candidate closes every repository/host/emulator-capable v1.1 implementation and verification task. It does **not** close J110-IMP-09 physical Task-movement proof, J110-IMP-15 physical/native certification, or the live Linux/Desktop GitHub acceptance tracked by issue #31.

## Historical pre-remediation candidate

- Governed integration branch: `v1.1` via PR #32.
- Certified product/test candidate commit: `d29df9ebeb05eaf44666d12f6ee20ccd81673d32`.
- Permanent Verify workflow: run `44450324316` / run number `1368`.
- Verification-only trigger PR: #33, closed without merge after certification.
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build/F-Droid certification and Android API-24 runtime all completed successfully.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

This candidate is retained as historical pre-remediation evidence. The new product/test candidate and permanent Verify run that were required after the reopened UX work and corrected FR-24 cross-installation synchronization contract are now satisfied by the current combined candidate above. Do not cite run 44450324316 as proof that the amended FR-03/FR-24/FR-28/FR-29/FR-31 contracts pass. The Android Git transport proof remains valid for transport capability, but the prior interoperability coverage did not exercise Desktop/Linux adopting a valid Android remote advance through the real Desktop synchronization controller.

The current presentation target for the reopened candidate is now explicit: `../../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html` and `../../design/reference/jig-v1.1-desktop-onboarding-task-form-governed-reference.html` are binding UX/UI authority for onboarding and the complete Task form/Repeat presentation. Historical `mobile-editor.svg` and the pre-remediation implementation are not closure targets in that scope.

## Hosted non-device evidence ledger

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | **PASS** — run `44516299671`; 41/41 test files and 250/250 core/integration/architecture tests passed; production build passed; browser bootstrap smoke passed; 77/77 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Governed browser screenshot evidence | **PASS** — onboarding desktop + 320/360/390/414 mobile states, mobile Planner/Settings/expanded Weekly Task form states and desktop expanded Weekly Task form state were retained in artifact `14525538706` with ZIP digest `sha256:7b3cdc34b75fb8c89cb1df1dcd14f8843303c4b639895f83ba62d4d2d91a3314`. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is not evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS** — run `44516299671`; Gradle dependency locks, Android unit/static checks, FLOSS boundary, version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention passed. APK artifact id `14525298721`. |
| Android API-24 instrumentation | **PASS** — run `44516299671`; `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
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

## Non-device closure audit

The repository-executable defects that reopened v1.1 are now closed on the certified candidate: app-wide mobile touch geometry/menu density, Settings information design, integrated Repeat form/save semantics, the replacement dnd-kit Task-movement candidate, governed onboarding presentation and FR-24/SD-41 cross-installation synchronization convergence. The Task-movement implementation is still subject to the separate IMP-09 physical proof before merge approval.

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
- Android SQLite, Git **transport capability**, GitHub Device Flow composition, reminder reconciliation, dependency/FLOSS boundary and F-Droid candidate path have permanent host/emulator certification; bidirectional Desktop/Linux ↔ Android synchronization convergence is now covered by the certified repository/host test matrix, while physical same-repository confirmation remains J110-IMP-15 evidence;
- permanent architecture tests enforce these ownership boundaries so the closure is regression-protected.

The real Linux/Desktop Device Flow/private-repository exercise is deliberately classified as **external live acceptance**, not unfinished repository implementation: it requires an interactive GitHub user authorization and live Secret Service environment that the connected repository execution surface cannot manufacture. Its absence does not authorize additional code or a substitute authentication architecture.

## Development APK identity

The development APK retained by permanent Verify run `44516299671` is the current physical-certification input; it is not a GitHub Release asset or public Android distribution channel.

- Certified executable source head: `305b2cd8f14f8f6ac791e3d5d07340b9d5e45efd`.
- GitHub Actions artifact id: `14525298721`.
- Artifact name: `jig-android-debug-4acbe0926e8409b01668a829f90dc4b96d778298` (artifact naming uses the PR merge-ref SHA; source head is recorded above).
- Artifact ZIP size: `7,176,724` bytes.
- Artifact ZIP digest: `sha256:34f7fde304b8fb041d4101430c65d420589954f3fef4b2cbb125bf1fa50022fe`.
- APK file in the artifact: `app-debug.apk`.

Before physical certification, the device preflight must record/verify the unpacked APK identity/hash for the exact artifact used. Any later executable change invalidates that APK identity and requires a new certified artifact.

## Known corrective evidence

The candidate includes a browser-bootstrap correction for the Android Git runtime boundary. Static reachability from the browser entrypoint had pulled `isomorphic-git`'s Node `Buffer` path into the production browser bundle, causing module-evaluation failure before React mounted. The corrected boundary dynamically loads `runtime-native` only after `Capacitor.isNativePlatform()` is true, and dynamically loads Android GitHub onboarding only on the native path. Permanent architecture tests forbid the static native imports, and the hosted bootstrap smoke plus 77/77 browser suite pass prove the browser surface mounts correctly.

The 2026-11-19 authority remediation also replaced the superseded process-shaped setup/reconnect presentation. The certified candidate keeps onboarding inside the canonical Jig shell, presents one Connect GitHub repository intent plus GitHub's required user code/Copy/Open-GitHub handoff, automatically polls and rechecks provider access, consumes complete pagination, routes restricted installations to GitHub-owned access surfaces, auto-continues an unambiguous repository, limits React to coarse-state observation, and exposes reconnect only when managed GitHub authorization actually requires user action. Browser and architecture acceptance explicitly forbid the old Refresh/Grant/Manage/manual-acquire workflow.

## Still required before release-candidate closure

1. Run **J110-IMP-09** on the exact certified candidate APK lineage and prove the replacement dnd-kit Task-movement implementation on physical Android. The old Pangea result cannot close this gate.
2. Run the remaining **J110-IMP-15** physical/native matrix on the same candidate: onboarding, complete mobile touch/menu/Task form/Settings usability, Weekly/Monthly expanded form scrolling and IME reachability, Stop repeating consequence, first-empty-Planner activation, safe-area/header behavior, reminders, lifecycle/restart and physical cross-installation Git interoperability, including physical Android GitHub authorization/private-repository acquisition.
3. Complete the external live Linux/Desktop GitHub Device Flow/private-repository acceptance tracked by **issue #31**.
4. Only after those gates pass may the `release/v1.1.0` metadata/tag/GitHub Release/F-Droid publication ceremony proceed.

All repository/host/emulator-capable implementation and verification work is closed. Governed browser screenshots are already retained by run `44516299671`; the screenshots/notes still missing are specifically physical-device evidence owned by IMP-09/IMP-15.

## Physical-device evidence

**PARTIAL PHYSICAL FEEDBACK RECORDED / CERTIFICATION NOT CLOSED.** Physical Android use has produced a blocking FAIL for the Pangea drag interaction (unreliable destination/drop with stranded floating-card behavior) and material UX findings for touch density, Settings and Repeat composition. Those findings reopened the design. J110-IMP-09 must be rerun on the replacement implementation; the full J110-IMP-15 matrix remains open.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
