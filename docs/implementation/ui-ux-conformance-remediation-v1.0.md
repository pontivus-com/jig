# Jig UX/UI conformance remediation — implementation plan v1.0

**Status:** Implementation-ready corrective plan, pending review of the v1.0 audit.  
**Date:** 2026-11-16  
**Governing audit:** [UX/UI conformance audit v1.0](../design/ui-ux-conformance-audit-v1.0.md)  
**Scope:** Canonical-reference repair plus implementation conformance.  
**Non-goal:** Change Task semantics, persistence, Git ownership boundaries, synchronization behavior, or introduce a new component framework.

## 1. Implementation rule

The remediation must preserve the existing planning domain and service behavior while correcting the UI composition to the governed design.

For every UI change:

1. keep Task identity and planning operations unchanged unless the audit identifies a semantic presentation defect;
2. use Astryx for primitives and Jig React composition for product-specific hierarchy;
3. keep dnd-kit as the only drag/sort owner;
4. do not introduce a parallel UI state model;
5. do not reintroduce repository migration, Git topology, remote-name configuration, branch/ref/worktree terminology or reconciliation UI;
6. do not add dashboard metrics, project-management workflow or unrelated features while fixing visual conformance.

## 2. Phase A — repair canonical UX authority

Implementation must not begin with Settings/Sync until these authority defects are corrected.

### A1 — update `docs/design/ui-solution.md`

Remove obsolete statements that Settings exposes:
- repository migration;
- remote-name configuration;
- Git worktree status;
- removed migration endpoints.

Replace with the corrected operational contract:
- selected repository path as informational context;
- local durability status;
- coarse synchronization outcome;
- Sync now/retry;
- service/local database/repository-adapter health;
- diagnostics without Git-topology workflow.

Also explicitly state:
- desktop shell uses the governed left rail/canvas composition;
- narrow shell is a separate responsive composition, not a wrapped desktop top bar;
- current reference SVGs govern structural hierarchy and density after their v1.0 corrections.

### A2 — correct functional-document contradiction

In `docs/requirements/planning-workbench.md`, remove the statement that the product must disclose the dedicated branch/ref layout.

Retain only:
- portable Jig records are synchronized automatically;
- any isolation mechanism is adapter-private;
- unrelated repository content is untouched;
- local-only/pending/retrying/synchronized/sync-issue are the only UI-level repository outcomes.

### A3 — replace stale Settings/Sync SVG

Replace `docs/design/reference/desktop-settings-sync.svg`.

Required structure:
- same desktop left rail as other desktop references;
- Settings title + short operational subtitle;
- Appearance section;
- Planning data section with repository path, informational only;
- Synchronization section with coarse status and Sync now;
- Diagnostics section with Service, Local database, Portable data/Repository adapter health;
- optional Run diagnostics action if the current shell contract supports it.

Forbidden:
- Migrate;
- remote name;
- branch/ref/worktree state;
- Git conflict/reconciliation language.

### A4 — update sync-state SVG copy

Update `docs/design/reference/sync-failure-states.svg` so user-visible text describes synchronization outcomes without exposing Git implementation mechanics.

Keep the five distinct states:
- Saved locally / Synced;
- Pending / Retrying;
- Local only;
- Sync issue;
- Local save failure.

### A5 — define narrow navigation contract

Update `docs/design/ui-solution.md` and, if necessary, the mobile reference set to define how Week, Day, History and Settings remain reachable below 48 rem.

Do not leave implementation to invent this.

### A6 — update obsolete brand supporting copy in reference assets

Where reference SVGs still say `Just-in-time planning`, align them with the current product identity.

Do not change the structural layout while performing this copy correction.

## 3. Phase B — application shell

### B1 — desktop shell

Refactor `ui/src/app.tsx` + `ui/src/styles.css`.

Required desktop structure:
- persistent left navigation rail;
- complete Jig wordmark/supporting identity;
- Week/Day/History/Settings vertical destinations;
- planning canvas to the right;
- surface-level heading/actions/status inside the canvas;
- no horizontal global top bar replacing the rail.

Preserve:
- current destination state;
- selected date;
- theme;
- operation error;
- sync state;
- all keyboard/focus semantics.

### B2 — narrow shell

At <48 rem:
- do not wrap the desktop rail/top bar;
- use the canonical compact mobile shell defined in A5;
- keep all four destinations reachable;
- keep status compact;
- prioritize task/date content vertically.

### B3 — status control

Replace the ghost navigation-like status button with one compact semantic status control.

It must:
- navigate/open Settings;
- render local-only/pending/retrying/synchronized/sync-issue honestly;
- not claim synchronized before service status does;
- not expose Git topology.

## 3A. Phase B0 — restore everyday carry-over continuity

This is a functional blocker and must land before or with the shell refactor.

### B0.1 — current Day is the normal planning entry surface

Change application initialization so a fresh Jig UI session opens:
- destination: Day;
- selected date: current local civil date.

Do not silently change any Task's `scheduled_date`.

Week remains reachable as the seven-day scheduled-date board.

### B0.2 — carry-over must be visible immediately on fresh open

On a fresh page/session with an outstanding Task scheduled before today:
- load canonical state;
- render today's Day attention sequence;
- show the prior-date Task as carried over without any navigation action;
- preserve its original scheduled date.

### B0.3 — update canonical UX wording

Where `ui-solution.md` currently describes Week as the default productive surface, revise it to distinguish:
- **Day/current date** = default operational entry and continuity surface;
- **Week** = principal weekly planning/rearrangement surface.

This does not reduce Week's importance; it ensures yesterday's unfinished work cannot be missed when Jig is opened today.

### B0.4 — regression tests

Add browser coverage that:
1. creates/persists an outstanding yesterday Task;
2. starts from a fresh page load with no prior destination state;
3. asserts Day/current date is the initial destination;
4. asserts the Task is visible with carry-over treatment;
5. asserts the Task's stored `scheduled_date` is still yesterday.

Keep the existing explicit Day carry-over test as lower-level coverage.

## 4. Phase C — canonical task-row composition

Create one cohesive Task row composition in `ui/src/task-row.tsx` using Astryx primitives.

Directly visible:
- completion control;
- compact drag handle for active sortable rows;
- title;
- restrained task metadata;
- one overflow/actions affordance.

Move into the overflow/actions surface:
- Edit;
- Move to date;
- Move up;
- Move down;
- other non-primary row actions.

Rules:
- drag handle and action menu are separate controls;
- menu does not swallow checkbox/link/focus interaction;
- all keyboard alternatives remain accessible;
- Normal priority remains visually silent;
- High/Low remain restrained;
- web reference remains openable and non-web reference copyable;
- action density must fit the canonical Week columns.

Do not create separate semantic Task shapes for Week/Day/History.

## 5. Phase D — Week surface

### D1 — desktop width/density

Refactor `.jig-week-board` / `.jig-week-column`.

Acceptance:
- at 1440×900 with the canonical desktop rail, all seven date columns are simultaneously visible;
- task titles remain readable;
- horizontal board scrolling is permitted only when a smaller desktop viewport cannot satisfy the semantic minimum width.

Do not retain the current fixed 15 rem column width.

### D2 — week header

Implement the reference hierarchy:
- Week of date range;
- secondary explanation where retained by canonical reference;
- previous/next/month navigation;
- Today shortcut;
- Quick add;
- compact sync status.

These controls belong to the Week surface, not global primary navigation.

### D3 — date columns

Each column:
- date;
- outstanding count;
- selected/current distinction;
- stable sticky date header;
- bottom Add task affordance;
- visible empty drop target.

Selected/current must remain distinguishable without color alone.

### D4 — Week cards

Use the canonical compact task-card rhythm rather than a raw divider-list presentation.

No simultaneous `Drag / Up / Down / Move / Edit` text-button row.

## 6. Phase E — Day surface

### E1 — unified Attention sequence

Refactor `ui/src/day.tsx`.

Render:
1. carried-over outstanding Tasks ordered by canonical planning query;
2. selected-date outstanding Tasks;
3. compact Completed group.

These are one Attention sequence, not two independent active sections.

### E2 — row-level carry-over treatment

For each carried-over row:
- explicit `Carried over · <origin date>`;
- restrained row edge/surface distinction;
- color is not the only cue.

Remove the current whole-section-only carry-over treatment.

### E3 — reminder origin semantics

If a carried-over Task has a reminder:
- render originating date + reminder time;
- do not display reminder time alone in a way that implies it belongs to the selected date.

Add direct unit/component coverage for this text derivation.

### E4 — desktop inspector

At desktop width:
- selected Task opens in the right-hand inspector;
- inspector displays title, context, priority, reminder, reference, notes;
- actions include complete/reopen, Edit, Move to date, Delete;
- Delete remains confirmed;
- inspector reads the same canonical Task object.

Edit can still open the bounded editor.

### E5 — Day heading

Implement:
- selected-date heading;
- date strip;
- Attention heading;
- outstanding count;
- Add task;
- Today/status controls per reference shell.

## 7. Phase F — History

Do not reuse the generic planning row unchanged.

Create a History presentation that displays:
- title;
- context if present;
- original scheduled date;
- actual local completion time;
- compact action menu.

Actions:
- reopen;
- edit;
- confirmed delete.

Keep History grouped by completion date.

Do not add productivity metrics.

Context filter/sort controls remain optional unless retained in the corrected UI contract.

Reduce heavy card-stack styling in favor of date sections + compact rows.

## 8. Phase G — Settings and sync

Implement only after Phase A reference repair.

Required current-scope sections:
- Appearance;
- Planning data/repository path;
- Synchronization state + Sync now/retry;
- Service health;
- Local database health;
- repository-adapter/portable-data health;
- diagnostics action/details if supported.

Forbidden:
- migration;
- remote selection/name configuration;
- branch/ref/worktree state;
- conflict resolution;
- Git history.

## 9. Phase H — mobile/narrow composition

### H1 — compact header/navigation

Implement the corrected narrow shell from A5.

Acceptance:
- planning content begins near the top of the screen;
- no three-row wrapped desktop navigation/action bar;
- status remains visible but secondary.

### H2 — date strip

At the canonical mobile reference width:
- seven dates fit or the revised canonical design explicitly authorizes horizontal scrolling;
- touch targets remain usable;
- selected/current state remains non-color-only.

### H3 — quick add

Use the governed thumb-reachable persistent Add affordance.

It must not:
- obscure the last Task;
- cover toast/reminder feedback;
- conflict with editor/dialog actions.

### H4 — task actions

Use the same compact handle + overflow model as desktop with touch-sized targets.

### H5 — mobile editor

Align:
- field order;
- date context;
- Save/Cancel hierarchy;
- destructive Delete separation;
- responsive sheet/dialog sizing.

Preserve draft across responsive reflow.

## 10. Phase I — visual-system cleanup

After structural conformance is complete:

- reduce unnecessary bordered rounded section stacks;
- align spacing/radii with the SVG density while continuing to use Astryx semantic tokens;
- ensure Jig Ink/Amber/Paper remains the only product palette mapping;
- preserve semantic status colors;
- verify System/Light/Dark parity;
- no one-off hard-coded color system.

Do not tune polish before structural phases B–H are correct.

## 11. Phase J — validation and evidence

### J1 — interaction regression

Existing behavior tests must remain green:
- create/edit;
- exact-position drag;
- cross-date move;
- completion/reopen;
- delete confirmation;
- carry-over;
- reminders;
- sync failure/retry;
- theme;
- responsive state preservation.

### J2 — new structural browser assertions

Add Playwright assertions for:
- desktop rail exists at ≥48 rem;
- global topbar replacement does not exist at desktop;
- all seven Week columns are visible in one 1440×900 screenshot without horizontal board scroll;
- Week rows expose one drag handle and one overflow menu, not the previous text action set;
- Day renders one Attention sequence;
- carried-over row has explicit originating label;
- carried-over reminder has originating date;
- desktop Day inspector is visible when a Task is selected;
- History row includes scheduled-date text and completion-time text;
- narrow shell does not stack desktop chrome;
- Settings contains none of the forbidden Git-management terms.

### J3 — governed screenshot set

Capture fresh release-candidate screenshots:
- desktop-week-light;
- desktop-week-dark;
- desktop-day-carry-over;
- desktop-history;
- desktop-settings;
- mobile-day;
- mobile-editor;
- sync-issue/local-save-failure state.

Store as a new evidence set rather than silently overwriting historical v1.0.0 screenshots.

### J4 — manual conformance review

Before release, review each current screenshot beside its canonical SVG.

Record:
- conformant;
- intentional documented variance;
- unresolved deviation.

No UX/UI release may be declared complete while a structural P0/P1 deviation remains undocumented.

## 12. File-level change map

Primary implementation:
- `ui/src/app.tsx`
- `ui/src/styles.css`
- `ui/src/week.tsx`
- `ui/src/day.tsx`
- `ui/src/history.tsx`
- `ui/src/settings.tsx`
- `ui/src/task-row.tsx`
- `ui/src/task-editor.tsx`
- `ui/src/date-strip.tsx`

Canonical docs/references:
- `docs/design/ui-solution.md`
- `docs/design/reference/desktop-settings-sync.svg`
- `docs/design/reference/sync-failure-states.svg`
- narrow/mobile reference assets if A5 requires it
- `docs/requirements/planning-workbench.md`
- `docs/design/brand-and-theme.md` only if reference-copy alignment requires clarification

Tests/evidence:
- current Playwright/browser suite
- focused component/unit coverage for carry-over reminder metadata
- new v1 UI evidence directory

## 13. Explicit non-changes

Do not change:
- canonical Task data model;
- priority insertion law;
- exact-position drag semantics;
- completion/reopen/delete domain transitions;
- SQLite authority;
- repository synchronization ownership boundary;
- installer;
- Git adapter topology;
- release architecture;
- Astryx/dnd-kit dependency choices.

If UI implementation appears to require any of these changes, stop and demonstrate the requirement before expanding scope.

## 14. Completion definition

The remediation is complete only when:

1. canonical UI references no longer contradict v1.0.1 ownership;
2. current functional/technical/design docs agree on the UI boundary;
3. desktop shell, Week, Day, History and Settings conform structurally;
4. narrow/mobile composition conforms structurally;
5. task actions are compact without losing keyboard/touch accessibility;
6. carry-over and History semantics are visibly correct;
7. System/Light/Dark all preserve hierarchy;
8. interaction tests are green;
9. structural browser assertions are green;
10. fresh screenshot evidence has been reviewed against every governed reference.

The objective is not to create a new design. It is to **finally implement the design Jig already approved**, correcting only those reference elements that became invalid when the v1.0.1 external-system ownership boundary was repaired.
