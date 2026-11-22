# Jig v1.1.2 IMP-18 exact-candidate closure ledger

**Status:** HOSTED / BROWSER / REPOSITORY EVIDENCE PASS; NATIVE INTERACTION EVIDENCE OPEN.  
**Governing plan:** `docs/implementation/v1.1.2-corrective-implementation-plan.md` J112-IMP-18.  
**Exact executable candidate:** `17db841889ee2d25dbe5801daf4334259a15d8b3`.  
**Permanent Verify:** run `2194` / `45076782420` — `PASS`.  
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
| VIS | Browser evidence artifact `14776095516`, `jig-v1.1.2-browser-evidence-f5fa248e02a47b8e360b87509d4c79deb5c9554b` (PR merge-ref artifact name; run source head is the exact candidate above), ZIP SHA-256 `98c916bc330b8e2ca73e75e9ccaf0153b07fcd0848ecf864e6aefda3b143d1ab`; reviewed application, onboarding, drag, attention, form and resolver screenshots, including all 13 Theme × Light/Dark desktop+narrow application states and all 13 Theme × Light/Dark resolver final states. |
| APK | Android artifact `14775033983`, `jig-android-debug-f5fa248e02a47b8e360b87509d4c79deb5c9554b` (PR merge-ref artifact name; run source head is the exact candidate above), ZIP SHA-256 `e2fde8f2728e0cfbbe30a841ce194d697923ba2f79bf455732e6c936da520c6c`; extracted `app-debug.apk` size `9,831,971 bytes`, SHA-256 `0237d5c018a545d92757233d200c03baa3e7f553d350661aca69193aa3b22259`. |
| NA | `tests/certification/v1.1.2-native-acceptance.md` J112-NA-01..08. These exact-candidate native interaction hooks remain OPEN until executed on an Android device/emulator and recorded with evidence. |

Hosted exact-head summary: `51/51 test files and 348/348 tests PASS`; Chromium `90/90 real-browser tests PASS (plus 1/1 browser bootstrap smoke)`; Android build/static/FLOSS/version/F-Droid certification PASS; API-24 instrumentation `5 tests started / 5 tests finished; BUILD SUCCESSFUL`.

## 2. IMP-16 disposition

J112-IMP-16 is **CLOSED — NO DEFECT REPRODUCED / NO CAUSAL FIX REQUIRED**. The permanent upgraded Desktop reproduction covers initial synchronization, local mutation/export/push, controller restart, an external remote fast-forward, re-observation and adoption and ends synchronized with `pending_sync = false` and idle diagnostics. This is not a claim that a historical defect was fixed and authorizes no speculative ordinary synchronization change.

## 3. Closure-ledger files

- [`adaptive-matrix.md`](adaptive-matrix.md) records IMP-18 matrix §A–E row dispositions.
- [`traceability.md`](traceability.md) records FR-01..15 and SD-01..17 evidence disposition.

## 10. Hosted certification result

The exact candidate passes the permanent type/architecture, theme artifact, unit/integration, build, browser bootstrap/real-browser, shell/installer, Android build/static/FLOSS/version/F-Droid and API-24 instrumentation gates. The browser visual evidence was reviewed rather than inferred from geometry assertions.

The certification is **not yet final** because the governing native acceptance document still has no executed J112-NA-01..08 rows. This is an evidence gap, not a discovered implementation defect. Do not start the `release/v1.1.2` metadata transition until those hooks are executed against the exact certified APK lineage (or design authority explicitly amends that requirement).

## 11. Required final native execution

Use the exact APK identified above and record J112-NA-01..08 in `tests/certification/v1.1.2-native-acceptance.md` with device/model, Android API, date, PASS/FAIL and retained evidence reference. A FAIL reopens the owning implementation task; a complete PASS closes the only remaining IMP-18 gate. No new product code is authorized merely to make the ledger green without a reproduced native failure.
