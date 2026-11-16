# Jig UX/UI conformance audit — v1.0

**Status:** Governing audit for the post-v1.0.1 UX/UI remediation.  
**Date:** 2026-11-16  
**Scope:** Current production UI on `master` versus the binding structural UI references in `docs/design/reference/`, the UI solution contract, the functional planning-workbench contract, and the corrected v1.0.1 external-system ownership boundary.  
**Purpose:** Identify every material UX/UI deviation, distinguish implementation drift from stale design authority, and define the exact remediation boundary before UI refactoring begins.

## 1. Executive finding

The current UI is **functionally recognizable but structurally non-conformant** with the governed SVG reference set. This is not a palette-polish or spacing-only issue.

The implementation diverged in the highest-level composition choices:

- the reference desktop shell is a persistent left navigation rail with a large planning canvas; the implementation uses a horizontal top bar;
- the reference Week surface is a seven-column week that is simultaneously scannable at the 1440 px reference viewport; the implementation uses fixed 15 rem columns and therefore requires horizontal scrolling at ordinary desktop widths;
- the reference Task row is compact and action-light, with a distinct drag handle and one overflow action affordance; the implementation exposes multiple text actions directly on every row;
- the reference Day surface is one attention sequence plus a desktop task inspector; the implementation splits carry-over and selected-date work into different sections and has no desktop inspector;
- the reference mobile shell is compact and task-first; the implementation wraps the desktop top bar into multiple mobile rows and consumes materially more vertical space;
- the reference History rows expose completion-time and original-schedule context; the implementation does not;
- the current Settings implementation and the Settings SVG no longer share the same product contract because the SVG still describes repository migration, remote selection and worktree details removed by the v1.0.1 ownership correction.

The correct remediation is therefore a **full structural UX/UI conformance rework**, not isolated CSS fixes.

## 2. Authority hierarchy for this audit

The audit uses the following authority order.

1. `docs/product/product-definition.md` — product scope and external-system ownership.
2. `docs/requirements/planning-workbench.md` — required observable planning behavior.
3. `docs/design/ui-solution.md` — binding UX/UI realization and structural contract.
4. `docs/design/reference/*.svg` — governed structural references for hierarchy, geometry, density and representative interaction placement.
5. `docs/design/brand-and-theme.md` — canonical brand/theme ownership.
6. Current implementation under `ui/src/` — implementation evidence, not design authority.

The SVGs are **not pixel-perfect Astryx specifications**, but `ui-solution.md` explicitly makes them authoritative for structure, hierarchy and density. Astryx owns component rendering details; it does not authorize replacing the reference composition with a different application shell or interaction hierarchy.

## 3. Canonical-authority drift discovered during the audit

Before implementation conformance can be completed, three design-authority contradictions must be repaired.

### A-01 — Settings reference is stale after v1.0.1

`docs/design/reference/desktop-settings-sync.svg` still contains:

- `Migrate…`;
- `Remote origin`;
- `Git worktree Clean`;
- copy stating repository migration is deliberate.

These concepts contradict the v1.0.1 product/technical boundary. Repository migration was removed; Git topology, worktrees, remote selection and repository-management semantics are not Jig UI concerns.

**Disposition:** replace this SVG with a corrected Settings/Sync structural reference that preserves repository path, local durability, coarse sync state, service/adapter health, appearance and diagnostics without exposing Git topology.

### A-02 — UI solution contains obsolete migration/remote language

`docs/design/ui-solution.md` still states that Settings exposes remote connection and repository migration and references migration endpoints that no longer exist.

**Disposition:** revise the UI solution before UI implementation so the current ownership boundary is authoritative in the UX contract.

### A-03 — Functional document contains an internal repository-topology contradiction

`docs/requirements/planning-workbench.md` correctly says the Git isolation mechanism is an internal adapter detail, but later states that portable records are versioned in a dedicated Jig branch/ref and that the product must disclose this layout.

That latter statement conflicts with the corrected product/technical ownership boundary.

**Disposition:** remove the user-facing disclosure/topology requirement while retaining the functional requirement that portable Jig data is synchronized safely and unrelated repository content is untouched.

These authority corrections are prerequisites to Settings/Sync implementation work. They do **not** invalidate the Week, Day, History, mobile and editor structural references.

## 4. Global shell and information architecture

### UI-01 — Desktop shell uses the wrong primary composition

**Reference:** desktop Week/Day/History/Settings SVGs use a persistent ~190 px left rail inside the application frame. The rail contains the Jig identity, Week/Day/History/Settings destinations, and low-priority planning-data context. The planning canvas begins to the right.

**Current implementation:** `ui/src/app.tsx` renders `.jig-topbar` with brand, all primary destinations, previous/today/next controls and repository status in one horizontal bar.

**Impact:** high.

The top bar changes the product's spatial model, consumes horizontal action space, forces navigation and date controls into the same visual band, and becomes especially expensive on narrow screens where it wraps into multiple rows.

**Required correction:** restore the desktop rail/canvas composition. Keep status and current-surface actions in the canvas header rather than mixing them with primary navigation.

### UI-02 — Status treatment does not match the governed hierarchy

**Reference:** synchronization state is a compact status pill in the canvas header, visually secondary to the current planning heading.

**Current implementation:** synchronization state is a ghost button in the top navigation bar.

**Impact:** medium.

**Required correction:** use a compact semantic status control/pill that remains actionable to Settings but does not read as a peer navigation destination.

### UI-03 — Desktop navigation/date controls are conflated

**Reference:** primary navigation is stable in the side rail. Today/previous/next/quick-add are local controls for the active planning surface.

**Current implementation:** Week/Day/History/Settings and Previous/Today/Next/status share the same top bar.

**Impact:** medium-high.

**Required correction:** separate application navigation from planning-surface controls.

## 4A. Functional continuity defect — unfinished prior-day work is not rolled forward

### UX-F01 — The current carry-over model is functionally wrong

The current planning model treats overdue work as a **derived Day-only projection**: `dayAttention()` reads outstanding Tasks whose `scheduled_date < selectedDate` without changing their canonical date.

That does not satisfy the intended product behavior.

The required behavior is persisted daily rollover:

1. an unfinished Task is scheduled for yesterday;
2. the local civil day advances;
3. Jig changes that Task's canonical `scheduled_date` to the current day;
4. the Task is inserted into the current day's persisted outstanding order;
5. the old date no longer contains the Task;
6. Week, Day, narrow/mobile, restart and synchronized replicas all see the same moved card.

The current implementation therefore fails even if the Day query can visually surface the old Task.

**Classification:** P0 functional defect in the planning model and lifecycle.

**Required correction:**
- add one pure core rollover mutation for every outstanding Task with `scheduled_date < current_local_date`;
- perform rollover automatically at service startup/catch-up and local day boundary;
- persist the changed `scheduled_date` and positions in one SQLite transaction;
- increment revision once and mark sync dirty when at least one Task moves;
- Week must show the moved card in the current-day column and no longer show it in the old column;
- Day must read the same canonical current-day bucket rather than synthesize a separate carry-over prefix;
- a missed multi-day interval catches up directly to the current local date;
- completed Tasks never roll;
- reminder time-of-day remains unchanged and therefore applies to the new scheduled date;
- fresh UI entry still opens Today / Day.

No second carry-over status/history field is introduced in 1.0.2.

## 5. Week view

### UI-04 — Seven-day desktop scanning is broken by column width

**Reference:** `desktop-week.svg` shows all seven days simultaneously in the 1440×900 reference. Columns are approximately 160 px wide in the available canvas.

**Current implementation:** `.jig-week-board` uses `repeat(7, minmax(15rem, 1fr))`; each `.jig-week-column` is explicitly 15 rem wide. Seven columns alone therefore require about 1680 px before gaps.

**Impact:** critical.

This directly undermines the principal Week use case: scanning the week as one board.

**Required correction:** at normal desktop reference widths, fit all seven columns in the planning canvas. Use a substantially smaller semantic minimum column width and allow horizontal scrolling only when the viewport genuinely cannot preserve readable task text.

### UI-05 — Week column visual hierarchy differs materially from the target

**Reference:** selected date uses a stronger header treatment and subtle selected-column surface; each header shows date and count. Add-task is a low-chrome action at the bottom of each column.

**Current implementation:** selected date outlines the entire column; Today is injected via a pseudo-element; each column has a header-level `Add` button; task count is absent.

**Impact:** high.

**Required correction:** implement the reference date/count hierarchy, selected/current distinction and bottom add affordance.

### UI-06 — Global Week heading/action hierarchy is incomplete

**Reference:** “Week of …” heading, explanatory subline, month navigation and Today are grouped as planning controls, with prominent Quick add.

**Current implementation:** heading is only the range and Add task. Previous/Today/Next live in the global top bar; the explanatory hierarchy and month label are absent.

**Impact:** medium.

**Required correction:** move surface controls into the Week header and reproduce the governed hierarchy without adding dashboard metrics.

### UI-07 — Week task rows are too action-heavy

**Reference:** each task card exposes checkbox, distinct drag handle, title, restrained metadata and one overflow action affordance.

**Current implementation:** each row may expose `Drag`, `Up`, `Down`, `Move…` and `Edit` text buttons simultaneously.

**Impact:** critical.

This is the opposite of the reference's compact, low-chrome scan model and consumes the narrow column width needed to see the week.

**Required correction:** keep completion and drag handle directly visible; move keyboard/non-drag alternatives and edit/move/delete actions into one accessible overflow/action menu. Keyboard accessibility must remain first-class.

### UI-08 — Week task visual density uses list rows instead of the intended compact card rhythm

**Reference:** tasks are discrete compact cards with bounded metadata, clear drag/action anchors and meaningful whitespace.

**Current implementation:** Astryx `List`/`ListItem` with dividers is used directly inside columns.

**Impact:** medium-high.

**Required correction:** compose Astryx primitives into the governed compact task-card rhythm rather than treating the raw list presentation as the final visual solution.

## 6. Day view

### UI-09 — Day is built around an obsolete derived carry-over model

**Corrected functional contract:** after daily rollover, Day reads one canonical outstanding sequence for the selected date.

**Current implementation:** `DayTaskLists` renders a separate `Carried over` section based on overdue Tasks that still retain old scheduled dates.

**Impact:** critical.

**Required correction:** remove the separate carry-over projection. Render one `Attention` sequence from the selected date's canonical bucket after rollover.

### UI-10 — Obsolete carry-over decoration must be removed

The corrected persisted-rollover model does not retain a second carry-over status or originating-date presentation field.

**Current implementation:** the UI renders a special carry-over section/labels for Tasks that should already have been moved canonically.

**Impact:** high.

**Required correction:** once rollover commits, the card is a normal card in the current date bucket. Remove `From …` / `Carried over …` presentation and carry-over-only section styling.

### UI-11 — Reminder semantics must follow the rolled-forward date

Under persisted rollover, `scheduled_date` changes while `reminder_time` remains the same local clock time.

**Required correction:** after rollover, the reminder belongs to the new current date. Do not display an obsolete originating reminder date.

### UI-12 — Desktop Day inspector is missing

**Reference:** `desktop-day.svg` uses the main attention list plus a right-side selected-task inspector with Context, Priority, Reminder, Reference, Notes and task actions.

**Current implementation:** Day is a centered single-column layout with a maximum width of 60 rem. Editing always opens the modal editor.

**Impact:** critical.

**Required correction:** add the governed desktop inspector/detail pane. It must reference the same canonical Task object; Edit may open the bounded editor, but selection and inspection should not require modal entry.

### UI-13 — Day task-count/Attention hierarchy is missing

**Reference:** the selected day has an `Attention` heading with a task-count chip above the unified list.

**Current implementation:** the page heading is followed by the date strip and then section headings.

**Impact:** medium.

**Required correction:** restore the Attention heading/count hierarchy.

### UI-14 — Completed presentation is structurally close but not fully aligned

The implementation's compact `details` group is directionally correct. It should be retained, but its spacing and row treatment should be aligned with the reference after the unified attention list is implemented.

**Impact:** low-medium.

## 7. Task row interaction model

### UI-15 — Drag affordance is textual instead of a compact handle

**Reference:** drag handle is a distinct compact handle (`≡`) separate from the action menu.

**Current implementation:** a text button labelled `Drag`.

**Impact:** high.

**Required correction:** use a compact icon/handle affordance with accessible name; do not use a wide text button in every row.

### UI-16 — No single overflow action affordance

**Reference:** one `•••` action menu.

**Current implementation:** several visible buttons.

**Impact:** high.

**Required correction:** one accessible action menu containing Edit, Move to date and keyboard reorder alternatives as applicable. Destructive Delete remains confirmed.

### UI-17 — Metadata hierarchy is insufficiently specialized

Current metadata is one flex row. The reference distinguishes context, reminder, priority and carry-over with different visual roles. High/Low are exceptional markers; Normal is omitted.

**Impact:** medium.

**Required correction:** preserve semantic differentiation while keeping the row compact.

## 8. History

### UI-18 — Completion time is missing

**Reference:** each History row includes actual completion time.

**Current implementation:** generic `TaskRow` does not display `completed_at`.

**Impact:** critical because History is defined as completion history.

**Required correction:** use a History-specific row composition that shows local completion time.

### UI-19 — Scheduled date is not discernible in History

**Functional acceptance:** History must show the Task's canonical scheduled date at completion together with actual completion time.

After automatic rollover, that scheduled date is the rolled-forward date; 1.0.2 does not introduce a separate original-schedule history field.

**Current implementation:** generic Task row does not expose the scheduled date.

**Impact:** critical.

**Required correction:** show the canonical scheduled date with completion-time context.

### UI-20 — History uses generic task actions instead of completion-history actions

**Reference:** compact row + overflow action affordance.

**Current implementation:** generic row uses completion checkbox and Edit.

**Impact:** medium-high.

**Required correction:** compose History rows specifically for reopen/edit/delete while retaining explicit accessibility.

### UI-21 — History groups are visually heavier than the low-chrome target

Current groups are bordered rounded containers. The reference is closer to dated section headings with compact row groups.

**Impact:** medium.

**Required correction:** reduce card-stack treatment and emphasize date grouping.

Optional context filtering/sort controls shown in the SVG are not mandatory functional acceptance and should not be introduced solely for visual parity unless the revised UI contract keeps them.

## 9. Settings and synchronization

### UI-22 — Settings cannot be audited against the current SVG without first repairing the reference

The implementation is already closer to the corrected v1.0.1 ownership boundary than the old SVG because it no longer exposes migration, remote selection or worktree state.

**Impact:** design-authority blocker, not an instruction to restore removed features.

**Required correction to the target reference:** Settings should include:
- Appearance;
- selected repository path as informational context;
- coarse synchronization state;
- Sync now/retry;
- service health;
- local database health;
- repository-adapter/portable-data health expressed without Git-topology terminology;
- diagnostics action/details where useful.

It must not expose:
- repository migration;
- branch/ref/worktree state;
- remote-name configuration;
- Git reconciliation concepts.

### UI-23 — Settings current diagnostics are too sparse for the intended operational surface

Current Settings exposes Repository, Local database and Repository adapter plus Sync now.

**Impact:** medium.

**Required correction:** once the canonical reference is repaired, include the minimum service/diagnostic information required by that corrected contract without reintroducing Git mechanics.

## 10. Sync and save states

### UI-24 — Durable sync-issue behavior is directionally correct

The current app renders a persistent warning Banner with retry for `sync-issue`. This conforms to the core honesty requirement and should be preserved.

### UI-25 — Status presentation lacks the reference's compact semantic state treatment

The text-only ghost status button does not reproduce the compact state pill hierarchy used by the reference screens.

**Impact:** medium.

**Required correction:** implement one compact state control that distinguishes synchronized, pending/retrying, local-only and issue without implying Git topology.

### UI-26 — Local-save failure placement requires interaction-specific review

The app has a durable global operation-error Banner and the task editor has persistent inline form errors. The design contract requires failed local saving to remain visible/actionable and not be hidden behind a transient toast.

**Disposition:** retain inline editor failure; during remediation, verify drag/reorder/completion failure communicates at the affected workflow surface and does not leave the UI appearing saved.

## 11. Mobile/narrow layout

### UI-27 — Mobile shell is a wrapped desktop top bar rather than a mobile composition

**Reference:** compact Jig/status row, compact Day/Today planning controls, date strip, then task-first content.

**Current implementation:** `.jig-topbar` wraps so brand takes a full row, primary navigation another row and topbar actions another row.

**Impact:** critical.

This consumes the most valuable narrow-screen vertical space before any planning content appears.

**Required correction:** implement an explicit narrow shell rather than wrapping the desktop shell.

### UI-28 — Seven-date strip is wider than typical mobile viewport

**Current CSS:** seven columns at a minimum 3.75 rem each plus gaps, which inherently exceeds common ~375–390 px content widths.

**Reference:** all seven compact dates are visible in the narrow reference.

**Impact:** high.

**Required correction:** fit the seven-date strip at the canonical narrow reference width while retaining touch target requirements. If horizontal scrolling is intentionally retained, the revised canonical reference must explicitly approve it.

### UI-29 — Mobile Add interaction does not match the reference hierarchy

**Reference:** persistent compact/floating `+` affordance in the thumb-reachable area.

**Current implementation:** `Add task` is in the view heading.

**Impact:** medium-high.

**Required correction:** implement the governed persistent Quick Add placement without obscuring the last task or reminder feedback.

### UI-30 — Mobile rows inherit the same action-overload problem as desktop

The direct text actions are particularly damaging at narrow widths.

**Impact:** critical.

**Required correction:** use compact drag/action affordances and a menu while keeping touch-sized targets.

### UI-31 — Mobile navigation for History/Settings is underspecified by the existing SVG set

The reference mobile Day SVG does not fully specify how all four primary destinations are reached.

**Impact:** canonical-design gap.

**Required correction:** the revised UI solution must explicitly define narrow navigation for Week, Day, History and Settings before implementation. Do not invent a second semantic navigation model in code.

## 12. Task editor

### UI-32 — Editor is broadly functional but hierarchy/order differs

Current editor fields are:
Title → Date → Priority → Context → Reminder → Reference → Notes.

Reference hierarchy is:
Title → Date → Context → Priority → Reminder → Reference → Notes.

**Impact:** medium.

**Required correction:** align ordering/hierarchy with the reference unless a revised reference explicitly changes it.

### UI-33 — Existing-task editor header does not expose the selected-date context shown by the reference

Current subtitle is generic (`Update only what changed.`). The reference shows the task date directly beneath the editor title.

**Impact:** low-medium.

**Required correction:** show meaningful date context, not generic instructional filler.

### UI-34 — Mobile editor composition must be visually certified

The current responsive Dialog is technically bounded and may satisfy the functional requirement, but the implementation has not been certified against the mobile editor reference for vertical hierarchy, action placement and destructive-action separation.

**Disposition:** include in fresh visual/browser certification.

## 13. Brand and typography

### UI-35 — Supporting line mismatch is intentional product evolution, not an SVG-fidelity bug

The SVG references use `Just-in-time planning`; current brand authority uses `Jig schedules attention, not project execution.` and the UI uses `Schedules attention`.

The product/brand documents supersede the old supporting line.

**Disposition:** do not restore obsolete SVG copy. Update reference assets during canonical repair.

### UI-36 — The broader low-chrome visual principle is not consistently realized

The current implementation relies heavily on bordered rounded sections and generic List containers. The reference and UI solution call for subtle boundaries and compact scan-oriented structure rather than decorative card stacks.

**Impact:** medium-high across Day, History and Settings.

## 14. Root cause

The implementation drift is explainable from the repository state.

### RC-01 — Structural references were documented but not converted into implementation acceptance gates

Playwright acceptance primarily verifies behavior: drag, completion, carry-over, theme, responsive switching and failures. It does not assert the reference shell, seven-day desktop visibility, inspector composition, action density, or History metadata hierarchy.

### RC-02 — “Astryx owns components” was allowed to become “generic Astryx composition is sufficient”

The design contract intended Astryx to own primitive rendering while Jig owned composition. The implementation frequently used raw `List`/`ListItem` and Button combinations as the final layout, bypassing the reference composition.

### RC-03 — No visual-conformance review blocked release

Browser screenshots existed as evidence, but there was no explicit checklist comparing them to each governed SVG before declaring the UI complete.

### RC-04 — Design authority became stale during the Git-boundary correction

v1.0.1 correctly removed repository-management UI semantics, but the Settings SVG and parts of `ui-solution.md` were not updated simultaneously. This demonstrates why the next UI remediation must update canonical references and implementation in one governed change set.

## 15. Remediation priorities

### P0 — Canonical repair before code
- correct Settings/Sync SVG and UI solution for the v1.0.1 ownership boundary;
- remove the contradictory branch/ref disclosure from functional UX requirements;
- define narrow primary navigation explicitly;
- update obsolete supporting-line copy in reference assets.

### P1 — Structural shell and primary planning surfaces
- desktop side rail/canvas shell;
- compact narrow shell;
- Week seven-column density;
- compact Task row with drag handle + overflow menu;
- unified Day attention sequence;
- desktop Day inspector.

### P2 — Semantic content fidelity
- persisted daily rollover and reminder-on-new-date semantics;
- History scheduled date + completion time;
- corrected status pill and operational hierarchy;
- Settings diagnostics under the corrected boundary.

### P3 — Editor, spacing and visual polish
- editor field order/date context;
- low-chrome section treatment;
- exact theme/spacing/contrast refinement.

## 16. Required validation before remediation is considered complete

The remediation must produce fresh browser evidence and an explicit side-by-side conformance review for:

1. Desktop Week at the 1440×900 reference viewport.
2. Desktop Day with carried-over work and selected-task inspector.
3. Desktop History with scheduled date and completion time.
4. Corrected Desktop Settings/Sync.
5. Mobile Day at the canonical narrow reference width.
6. Mobile editor.
7. Sync pending/retrying/local-only/issue and local-save failure.
8. Light and Dark for representative Week, Day and Settings surfaces.

In addition to interaction tests, acceptance must assert these structural invariants:

- seven Week dates are simultaneously visible at the reference desktop viewport;
- desktop primary navigation is in the governed rail, not a top-bar replacement;
- Week/Day task rows do not expose the full action set as simultaneous text buttons;
- Day presents one Attention sequence;
- rolled-forward reminder applies to the new scheduled date;
- Day inspector exists at desktop width;
- History rows expose canonical scheduled date and actual completion time;
- narrow layout does not stack the desktop navigation/action bars above content;
- all four destinations remain reachable on narrow screens;
- Settings contains no migration, branch/ref/worktree or remote-name configuration UI.

## 17. Verdict

The current UI should **not** be treated as the completed realization of the existing UX/UI design.

The planning behavior underneath it is substantially reusable. The remediation should preserve the canonical Task model, planning operations, Astryx theme ownership and dnd-kit behavior, while replacing the composition and presentation that diverged from the governed references.

This audit is the scope authority for the next UI/UX remediation. The implementation task plan is maintained separately in `docs/implementation/ui-ux-conformance-remediation-v1.0.md`.
