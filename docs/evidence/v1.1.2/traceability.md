# Jig v1.1.2 IMP-18 FR/SD traceability ledger

Exact executable candidate: `17db841889ee2d25dbe5801daf4334259a15d8b3`; Verify run `2194` / `45076782420`. Evidence keys are defined in [`README.md`](README.md).

## 8. FR closure ledger

| FR | Implemented by | Evidence disposition |
|---|---|---|
| FR-01 surface roles | IMP-12 | PASS — ARCH + UI + all-theme VIS. |
| FR-02 viewport fill | IMP-03 | PASS — ARCH + UI + VIS. |
| FR-03 live drag placement | IMP-07, IMP-11 | PASS — DRAG + VIS. |
| FR-04 touch drag | IMP-11 | PASS — DRAG narrow/coarse acceptance. |
| FR-05 synchronization diagnostics | IMP-15 | PASS — SYNC + UI Diagnostics. |
| FR-06 evidence-driven root cause + bounded recovery | IMP-15, IMP-16, IMP-17 | PASS hosted/repository evidence — IMP-16 no-defect-reproduced disposition + SYNC/XPLAT. |
| FR-07 recovery safety | IMP-17 | PASS core/controller safety; final Android in-app resolver interaction remains part of NA-08 before IMP-18 closes. |
| FR-08 corrective release audit | IMP-01..17 | OPEN only because required native interaction evidence is open. |
| FR-09 perceptible motion | IMP-13 | PASS — ARCH + UI/reduced-motion evidence. |
| FR-10 desktop/narrow compositions | IMP-02..07, IMP-09 | PASS — ARCH + UI/SETUP/VIS. |
| FR-11 viewport-appropriate feedback | IMP-05, IMP-13 | PASS browser; native safe-area geometry is carried by NA-04 before final certification. |
| FR-12 adaptive interaction audit gate | IMP-01..13 | OPEN only for required Android/native rows. |
| FR-13 orthogonal selectors | IMP-01..03, IMP-08..12 | PASS architecture; native rendered lifecycle/capability evidence remains in NA hooks. |
| FR-14 complete concern registry | IMP-01..13, IMP-17 | OPEN only for required native evidence rows. |
| FR-15 guided conflict resolution | IMP-14, IMP-17 | PASS core/Linux/Android controller + browser UI; OPEN exact Android in-app interaction under NA-08. |

## 9. SD closure ledger

| SD | Implementing task(s) | Evidence disposition |
|---|---|---|
| SD-01 explicit theme surfaces | IMP-12 | PASS — ARCH + all-theme UI/VIS. |
| SD-02 AppShell/scroll owner | IMP-03 | PASS — ARCH + UI. |
| SD-03 React-owned drag placement | IMP-07, IMP-11 | PASS — DRAG. |
| SD-04 pointer activation | IMP-11 | PASS — DRAG. |
| SD-05 diagnostics/evidence | IMP-15, IMP-16 | PASS — SYNC + IMP-16 disposition. |
| SD-06 resumable recovery | IMP-17 | PASS — SYNC + XPLAT. |
| SD-07 lifecycle matrix | IMP-15, IMP-16, IMP-17 | PASS repository/controller matrix; native app lifecycle observation remains NA-01 where separately required by IMP-18. |
| SD-08 corrective acceptance | IMP-11, IMP-12, IMP-15..17 | OPEN only for IMP-18 native interaction evidence. |
| SD-09 motion tokens | IMP-13 | PASS — ARCH + UI. |
| SD-10 feedback placement | IMP-05, IMP-13 | PASS browser; native safe-area observation remains NA-04. |
| SD-11 adaptive registry enforcement | IMP-01..11 | PASS — ARCH + matrix traceability. |
| SD-12 theme/motion/responsive browser acceptance | IMP-03..13 | PASS — exact Chromium UI/VIS. |
| SD-13 branch/share semantics | IMP-02..07, IMP-09 | PASS — ARCH + UI/SETUP. |
| SD-14 orthogonal architecture | IMP-01..11 | PASS — ARCH. |
| SD-15 platform lifecycle/capabilities | IMP-03, IMP-06, IMP-08..10, IMP-12, IMP-17 | **OPEN** — hosted/unit owners pass; J112-NA-01..07 required native evidence is not recorded. |
| SD-16 guided Jig-data conflict resolution | IMP-17 | **OPEN final native acceptance only** — core/controller/browser evidence passes; J112-NA-08 remains. |
| SD-17 Git/provider source ownership | IMP-14, IMP-17 | PASS — ARCH target topology and dependency direction. |
