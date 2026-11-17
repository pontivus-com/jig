# Jig v1.0.4 implementation evidence

**Status:** PASS — implementation and governed visual states reviewed on 2026-11-17.  
**Implementation branch:** `fix/v1.0.4-ui-interaction-corrections`  
**Implementation PR:** #21  
**Last production-code candidate before evidence-only harness changes:** `c833867d006dd5c0c4c6e1610c76828611463e79`  
**Permanent Verify run:** `44056160140` — PASS  
**Visual capture run:** `44059216745` — PASS  
**Visual artifact:** `jig-v1.0.4-ui-evidence`, artifact ID `14317143638`  
**Capture artifact SHA-256:** recorded by GitHub Actions for the capture archive; the reviewed artifact is the one attached to run `44059216745`.

## Certification result

The v1.0.4 implementation candidate passed the repository's permanent verification path:

- release-metadata guard;
- release-tool compilation;
- Astryx theme artifact drift check;
- strict TypeScript typecheck;
- core and integration tests;
- production UI build;
- real-browser acceptance — 37/37 tests;
- shell syntax;
- installer and lifecycle smoke.

The browser gate explicitly covers the v1.0.4 correction contract, including card-body pointer drag, direct editable workspace opening, blank-content dismissal, Task-to-Task retargeting, exact current-day semantics, no selected-day state, seven-section narrow Planner, full weekday labels, per-date Add, stable header geometry, complete menus, responsive draft continuity and distinct semantic state styling.

## Reviewed visual evidence

The successful capture run produced and the review inspected these ten governed states:

| Screenshot | Reviewed behavior |
|---|---|
| `desktop-planner-light.png` | open reduced-chrome seven-date canvas, full weekday labels, explicit Planner/History/Settings navigation, per-date Add and distinct priority/today semantics |
| `desktop-planner-dark.png` | Dark-mode hierarchy and equivalent semantic state treatment |
| `desktop-planner-task-drawer.png` | selected Task info-blue state and directly editable full Drawer without board reflow |
| `desktop-planner-drag-target.png` | card-body drag overlay plus transient Amber date drop-target treatment |
| `desktop-history.png` | completed Task anatomy and active History navigation in the stable header |
| `desktop-settings.png` | Settings destination, operational controls and stable application-header geometry |
| `mobile-planner.png` | narrow Planner as seven stacked dated sections with compact per-date Add and no selected-day subview |
| `mobile-task-bottom-sheet.png` | same complete editable Task draft rendered through BottomSheet |
| `sync-issue.png` | repository retry/issue warning semantics while local planning remains available |
| `local-save-failure.png` | editable workspace remains open with an explicit failed-save error; unsaved draft is not represented as successful persistence |

Visual review conclusion: **PASS**. The Planner reads as one open planning canvas rather than seven framed panels; Task cards remain discrete without heavy nested chrome; today, selection, priority, drag/focus and repository status do not collapse onto one color treatment; and the information architecture remains consistent across desktop and narrow layouts.

## Architecture evidence

v1.0.4 also adds/extends architecture guards for the correction scope:

- functional-core / imperative-shell dependency direction;
- one canonical Task and TaskCommand;
- displayed-week-only Planner state;
- one discriminated Task workspace state;
- shared desktop/narrow Task-sequence ownership;
- no selected-date projection;
- strict boundary narrowing for repository/SQLite/HTTP data;
- no DTO/service/repository/workflow abstraction inflation;
- Astryx-owned semantic theme/icon integration;
- package version remains the published `1.0.3` on the implementation branch.

## Evidence-harness lifecycle

The screenshot workflow and capture case were temporary certification machinery only. They are removed from the final implementation branch after the reviewed capture. The permanent product/browser verification suite remains the release gate.

Release publication is not part of this evidence step. v1.0.4 metadata/version finalization occurs only after implementation merges to `master`, through the governed `release/v1.0.4` transition.
