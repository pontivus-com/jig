# Jig v1.1.0 implementation evidence

**Status:** hosted non-device implementation/certification PASS for the product/test candidate below. This file does not constitute physical-device evidence and must not be used to close J110-IMP-09 or the physical-device portions of J110-IMP-15.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Certified product/test candidate

- Branch: `v1.1`
- Product/test candidate commit: `bf305695ef06839e8f1e7d5fca803cd8e3e9aaf3`
- Permanent Verify workflow: run `44424575242` / run number `1322`
- Workflow result: **PASS** — Linux/browser Verify, Android deterministic build certification and Android API-24 runtime all completed successfully.
- `package.json.version` remains `1.0.6` by design; the `1.1.0` version transition remains owned by the later `release/v1.1.0` metadata PR.

The product/test candidate is the source state certified by the hosted run. Later evidence-only/documentation commits do not replace this candidate unless they alter executable/product/test behavior.

## Hosted non-device evidence ledger

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | **PASS** — run `44424575242`; 39 test files / 209 core-integration tests passed; production build passed; browser bootstrap smoke passed; 66/66 real-browser tests passed; shell syntax and installer/lifecycle smoke passed. |
| Browser/native platform isolation | **PASS** — permanent architecture tests require lazy native-runtime/native-GitHub loading; hosted browser bootstrap smoke proves Android Git/isomorphic-git is no longer evaluated in the browser entrypoint. |
| Android deterministic build certification | **PASS** — Gradle dependency-lock verification, Android unit/static checks, FLOSS dependency boundary, Android version derivation, development APK/native bridge compilation, F-Droid lint and artifact retention all passed in run `44424575242`. |
| Android API-24 instrumentation | **PASS** — Android 7.0 / API 24 x86_64 emulator; 5 instrumentation tests completed successfully; Gradle `:app:connectedDebugAndroidTest` ended `BUILD SUCCESSFUL`. |
| Android bundled SQLite transaction/restart proof | **PASS at the native-driver/API-24 boundary** — covered by the committed API-24 instrumentation. Cross-platform physical-device continuity remains part of J110-IMP-15. |
| Android Git native HTTP transport | **PASS at the native-transport/API-24 boundary** — committed instrumentation passed; host smart-HTTP/portable interoperability coverage is included in the 209-test core/integration result. Live private-repository acquisition remains external/physical evidence. |
| Android reminder scheduling/reconciliation | **PASS for implemented host/reconciliation semantics** — permanent unit/reconciliation coverage passed. API 31/33/36 policy/permission behavior and physical notification delivery remain J110-IMP-15 evidence. |
| F-Droid candidate metadata lint | **PASS** — permanent Android certification lint passed against the pinned F-Droid category authority. External submission/publication has not occurred. |
| FLOSS/proprietary dependency gate | **PASS** — permanent Android runtime dependency boundary passed; no Play Services/Firebase/proprietary runtime SDK is accepted by the gate. |
| Linux x64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Linux arm64 packaged configured/bootstrap smoke | Permanent Release certification implemented; **release-commit execution pending**. |
| Local `act` rehearsal | **PENDING development-environment evidence** — current connected-repository execution environment has no local checkout plus `act`/container runtime with which to execute the governed rehearsal. Hosted Actions does not substitute for this gate. |
| Live Linux/Desktop GitHub Device Flow/private-repo acquisition | **PENDING external live verification**. |
| Live/physical Android GitHub Device Flow/private-repo acquisition | **PENDING physical-device verification**. |

## Development APK identity

The development APK retained by permanent Verify run `44424575242` is certification input only; it is not a GitHub Release asset or public Android distribution channel.

- GitHub Actions artifact id: `14483202906`
- Artifact archive digest: `sha256:6df9d696b67d5fdc88b91274b60bd51deb35b5b4d97bdf9a301eac309c7c9cd3`
- APK file: `app-debug.apk`
- APK size: `9,755,768` bytes
- APK SHA-256: `d6455972c08477a4e305790466cde1aa224020bdcaf9f58a06d52db6f85d485e`

Any physical-device certification must identify the exact APK/source candidate it uses. A later executable change invalidates this APK identity for that later candidate.

## Known corrective evidence

The candidate includes a browser-bootstrap correction for the Android Git runtime boundary. Static reachability from the browser entrypoint had pulled `isomorphic-git`'s Node `Buffer` path into the production browser bundle, causing module-evaluation failure before React mounted. The corrected boundary dynamically loads `runtime-native` only after `Capacitor.isNativePlatform()` is true, and dynamically loads Android GitHub onboarding only on the native path. Permanent architecture tests forbid the static native imports, and the hosted bootstrap smoke plus 66/66 browser suite pass prove the browser surface mounts correctly.

## Still required before implementation-candidate closure

The hosted non-device implementation gates above do **not** close the remaining governed gates:

1. Run the committed permanent Verify workflow locally with `act workflow_dispatch`, run the PR-event rehearsal, rehearse changed non-publishing Release certification as governed, and record the residue result.
2. Verify the live **Jig Desktop & Mobile** GitHub App configuration and execute real Linux/Desktop Device Flow plus selected private-repository acquisition/synchronization.
3. Execute J110-IMP-09 on a physical Android phone, including the exact drag/drop inter-card-gap gate.
4. Execute the J110-IMP-15 Android matrix across API 24/31/33/36 with at least one physical phone, including GitHub authorization/private clone, same portable dataset as Linux, offline CRUD/order, safe-area/sticky header, rollover, native reminder policy/permission/failure semantics, notification reconciliation, token expiry/reconnect, restart persistence, reconnect-after-network, Git interoperability and uninstall/reinstall continuity.
5. Record the physical device make/model, Android/API/WebView versions, exact source/APK identity and results here.
6. Only after implementation/evidence closure may the separate `release/v1.1.0` metadata transition, immutable tag/Release workflow and external F-Droid submission/publication proceed.

## Physical-device evidence

**NOT RUN in this ledger.** J110-IMP-09 and the physical portions of J110-IMP-15 require a recorded physical Android device, exact candidate APK/source SHA, device/API/WebView versions and the complete governed interaction/synchronization/reminder matrix.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
