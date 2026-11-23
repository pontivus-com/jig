# Jig v1.1.2 IMP-18 exact-candidate closure ledger

**Status:** HOSTED / BROWSER / REPOSITORY / CROSS-RUNTIME GIT / ANDROID UPDATE-PRESERVATION EVIDENCE PASS; NATIVE HOST INTERACTION PARTIAL (NA-08 host interaction only).
**Governing plan:** `docs/implementation/v1.1.2-corrective-implementation-plan.md` J112-IMP-18.  
**Baseline native candidate:** `17db841889ee2d25dbe5801daf4334259a15d8b3`.
**Corrected executable candidate:** `4343738b2b08901c1c57d16f276a1d0b31ab09fa`.
**Permanent Verify:** run `2213` / `45094008515` — `PASS`.
**Package version:** `1.1.1` (intentionally unchanged pending the separate `release/v1.1.2` transition).

## 1. Evidence identities

| Key | Exact evidence |
|---|---|
| ARCH | `tests/architecture/architecture-compliance.test.ts`, `tests/architecture/ui-ownership.test.ts`, `tests/architecture/v1.1.2-boundaries.test.ts`; all included in exact-head `bun run test`. |
| UI | `tests/browser/ui-conformance.spec.ts`; exact-head Chromium acceptance. |
| DRAG | `tests/browser/interactions.spec.ts`; exact-head Chromium hard drag matrix including 20-cycle stability, exact placement, cancellation, touch activation and runtime-error trapping. |
| SETUP | `tests/browser/setup.spec.ts` + `tests/browser/onboarding.spec.ts`; desktop/narrow and capability/width separation. |
| RESOLVER | `tests/browser/sync-conflict.spec.ts` + `tests/ui/sync-conflict-state.test.ts`; shared resolver semantics, breakpoint continuity, cancellation and Theme × Light/Dark state matrix. |
| SYNC | `tests/sync/{worker,desktop-runtime-reproduction,desktop-recovery,recovery-git,diagnostics}.test.ts`; ordinary outcomes, IMP-16 non-reproduction, recovery, stale/race/crash/refusal and diagnostics. |
| XPLAT | `tests/native/git-smart-http.test.ts`; Desktop→Android→Desktop, Android→Desktop→Android, related divergence, semantic conflict and Android recovery restart evidence. |
| NUNIT | `tests/native/{app-lifecycle,notifications,reminder-reconciliation,jig-sqlite,secure-credentials}.test.ts`; native adapter/lifecycle semantics. |
| API24 | Exact-head `Android API 24 runtime` instrumentation: `5 tests started / 5 tests finished; BUILD SUCCESSFUL`. |
| VIS | Browser evidence artifact `14783030515`, ZIP digest SHA-256 `66deadd97b6cd7e84bc14d9a85ed08d9d9facc0c62a1b29804fea13575c7cd17`; run source head `4343738b2b08901c1c57d16f276a1d0b31ab09fa`; 91/91 real-browser tests plus bootstrap smoke PASS. |
| APK | Corrected Android artifact `14782503658`; extracted `app-debug.apk` size `9,832,023 bytes`, SHA-256 `21e443084a3e1768fd076cb05e37dbbecc4be4209143f40e6eda413f4b389444`; stable non-production certification certificate SHA-256 `a40da80a59d170caa950cf15c18c454d47a39b26989d8b640ecd745ba71bf5dc`. |
| GITCI | Dedicated permanent Git synchronization/recovery gate in Verify `45094008515`: `tests/native/git-smart-http.test.ts` + `tests/sync/recovery-git.test.ts` + `tests/sync/desktop-recovery.test.ts`, 3/3 files and 17/17 tests PASS. Includes the exact pending-Android-local + remote-advance topology, stale-case rejection, refreshed resolution and accepted non-force synchronization. |
| UPDATE | Stable-signature Android certification plus API-24 in-place reinstall proof: two successful update installs preserve app-private `.jig/local` and Git repository sentinels before 5/5 instrumentation tests; uninstall/package-clear is not used. |
| NA | `tests/certification/v1.1.2-native-acceptance.md` records NA-01..07 physical PASS, baseline NA-08 causal FAIL, and corrected-candidate NA-08 Git/recovery semantics PASS in permanent CI. Only native resolver-host/Back interaction remains open if retained. |

Hosted exact-head summary: dedicated Git recovery gate `3/3 files, 17/17 tests PASS`; full suite `51/51 test files and 348/348 tests PASS`; Chromium `91/91 real-browser tests PASS (plus 1/1 browser bootstrap smoke)`; Android build/static/FLOSS/version/F-Droid + stable-signature certification PASS; API-24 in-place reinstall preservation PASS; instrumentation `5 tests started / 5 tests finished; BUILD SUCCESSFUL`.

## 2. IMP-16 disposition

J112-IMP-16 is **CLOSED — NO DEFECT REPRODUCED / NO CAUSAL FIX REQUIRED**. The permanent upgraded Desktop reproduction covers initial synchronization, local mutation/export/push, controller restart, an external remote fast-forward, re-observation and adoption and ends synchronized with `pending_sync = false` and idle diagnostics. This is not a claim that a historical defect was fixed and authorizes no speculative ordinary synchronization change.

## 3. Closure-ledger files

- [`adaptive-matrix.md`](adaptive-matrix.md) records IMP-18 matrix §A–E row dispositions.
- [`traceability.md`](traceability.md) records FR-01..15 and SD-01..17 evidence disposition.

## 10. Hosted certification result

The exact candidate passes the permanent type/architecture, theme artifact, unit/integration, build, browser bootstrap/real-browser, shell/installer, Android build/static/FLOSS/version/F-Droid and API-24 instrumentation gates. The browser visual evidence was reviewed rather than inferred from geometry assertions.

The synchronization/recovery defect that blocked NA-08 is corrected and permanently certified in GitHub Actions; a physical device is no longer a Git-correctness gate. IMP-18 remains non-final only to the extent the governing native hook still requires direct resolver-host/Back interaction evidence. Android update certification is now non-destructive: a signing mismatch must stop rather than trigger uninstall/package-clear.

## 11. Remaining native-host execution

Do not rerun Git synchronization/recovery semantics on a physical device as a substitute for the permanent CI gate. If the J112-NA-08 native hook is retained, its remaining scope is only direct Android resolver-host/Back interaction. Use corrected artifact `14782503658` (APK SHA-256 `21e443084a3e1768fd076cb05e37dbbecc4be4209143f40e6eda413f4b389444`) or a later artifact from the same stable certification-signing lineage. Install by in-place update only; never uninstall or clear `com.pontivus.jig` to make a candidate fit.