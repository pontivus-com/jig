# Jig v1.0.5 implementation evidence

**Status:** PASS — the corrective implementation and governed visual review satisfy JIG-105-FR-01…11 / JIG-105-SD-01…11 / J105-IMP-01…11.  
**Implementation branch:** `fix/v1.0.5-v1.0.4-release-blockers`  
**Implementation PR:** #23  
**Product-code/test candidate:** `220bd405e5628233120fea847bd1859ea13ebce2`  
**Permanent Verify run:** `44082850652` — PASS  
**Visual capture head:** `a24bb709cdefd738ed88913ac7a36a4f72c172fc` — evidence-harness-only changes after the product candidate  
**Visual capture run:** `44083789301` — PASS  
**Visual artifact:** `jig-v1.0.5-ui-evidence`, artifact ID `14328253278`  
**Artifact digest:** `sha256:03479fec00018f0e1c5c67916bc4f92663f5b7842863cafa944e6124d2bc579b`

The v1.0.5 product candidate keeps `package.json.version = 1.0.4`, as required for an implementation branch. Version 1.0.5 is a later governed `release/v1.0.5` metadata transition after implementation merges to `master`.

## Certification result

Permanent Verify run `44082850652` passed on exact product candidate `220bd405e5628233120fea847bd1859ea13ebce2`:

- frozen dependency installation;
- PR release-metadata guard;
- release-tool compilation;
- Astryx theme artifact drift check;
- strict TypeScript typecheck;
- core/integration/architecture tests — **18 test files / 105 tests passed**;
- production build;
- real-browser acceptance;
- shell syntax;
- installer and lifecycle smoke.

The corrective browser suite explicitly covers:

- desktop whole-card cross-date drag with page/runtime error collection and no workspace-selection side effect;
- desktop same-date exact-index whole-card reordering and reload persistence;
- narrow/mobile touch same-date reordering;
- narrow/mobile touch cross-date movement into both non-empty and empty target dates;
- responsive navigation parity for Planner / History / Settings;
- outstanding/completed Task-menu parity;
- governed semantic icons and absence of raw control stand-ins;
- desktop header <=44px and narrow header <=56px;
- Light/Dark Task-card versus canvas separation at desktop and narrow widths;
- zero application-level viewport inset and the 73rem / 1168px responsive boundary;
- shared workspace draft behavior across responsive reflow.

## Reviewed visual evidence

The capture artifact was inspected directly after successful run `44083789301`. The reviewed states are:

| Screenshot | Review result |
|---|---|
| `desktop-planner-light.png` | PASS — full-bleed seven-track Planner; 44px flat application bar; complete Jig wordmark; one-line temporal controls; icon-bearing Add/Planner/History/Settings; clear White Task surfaces over Paper canvas. |
| `desktop-planner-dark.png` | PASS — equivalent hierarchy in Dark; Ink 800 Task cards are materially lighter than Ink 950 canvas; border/state cues remain distinct. |
| `narrow-planner-light.png` | PASS — edge-to-edge stacked seven-date Planner; one compact header row; same Task anatomy and metadata/actions as desktop; no stale mobile panel/frame. |
| `narrow-planner-dark.png` | PASS — narrow Dark cards remain visibly separated from the canvas and use the same responsive semantic model as desktop. |
| `narrow-navigation-menu.png` | PASS — compact menu contains Planner, History and Settings with semantic icons and current-page indication from the shared destination owner. |
| `desktop-task-menu.png` | PASS — governed Task actions, semantic Edit/Complete/Move/Delete icons and priority state are legible without responsive-specific action semantics. |
| `narrow-task-menu.png` | PASS — same Task action vocabulary and icon treatment as desktop, presented through the same menu owner. |
| `desktop-drag-target.png` | PASS — whole-card overlay is visible while canonical source remains in place; target date shows transient Amber dashed drop treatment, consistent with React-owned ordering and suppressed optimistic DOM sorting. |
| `desktop-task-workspace.png` | PASS — selected Task state is distinct and the directly editable Drawer overlays the Planner rather than reflowing/narrowing the weekly board. |

**Visual conclusion:** PASS. The capture specifically closes the visual gaps missed by v1.0.4: header density/chrome, icon/menu normalization, narrow/mobile parity, Dark/narrow card contrast, full-bleed layout and whole-card drag presentation.

## Architecture evidence

The implementation preserves the repository's governed architecture:

- **Functional core / imperative shell:** no v1.0.5 planning/domain semantics were duplicated in UI. Existing canonical `TaskCommand` and pure move/order semantics remain authoritative.
- **One order owner:** dnd-kit performs sensing/collision/overlay only; `onDragOver.preventDefault()` suppresses optimistic DOM sorting and no shadow Task-order state exists.
- **Responsive SoC/DRY:** one `TaskDragProvider`, one dated-section path, one `DateDropZone` path, one `PlannerTaskList`, one `SortableTaskRow`, one destination tuple and one `TaskActionMenu` owner serve desktop and narrow/mobile.
- **Strict typing:** navigation/icon semantics use Astryx public `IconName` / `NamespacedIconName` and menu types; Jig extension keys are checked through `satisfies`; no new `any`, double-cast, non-null assertion, DTO/ViewModel hierarchy or assertion-only type escape was introduced.
- **Astryx boundary:** reusable UI, menus, Buttons/IconButtons, theme generation and semantic icon resolution stay on public Astryx APIs. The only Jig icon extensions are the four governed namespaced meanings `jig:add`, `jig:history`, `jig:edit`, `jig:delete`.
- **Theme ownership:** Task surface/border semantics are authored in `jig-theme.source.ts` and generated artifacts pass `theme:check`.
- **No release pollution:** the implementation does not alter the published v1.0.4 tag/release or prematurely set package version 1.0.5.

## Evidence-harness lifecycle

The v1.0.5 screenshot test and capture workflow are temporary certification machinery only. After the artifact above was captured and reviewed, they are removed from the implementation branch. Permanent architecture/browser tests remain as the regression gate.

Release publication is not part of this evidence step. After this implementation merges to `master`, release metadata must be prepared separately on `release/v1.0.5` under `docs/releases/README.md`.
