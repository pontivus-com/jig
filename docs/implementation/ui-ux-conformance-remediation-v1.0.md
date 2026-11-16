# Jig 1.0.2 UX/UI conformance remediation — implementation plan v1.0

**Status:** Implementation-ready bug-fix plan.  
**Target release:** 1.0.2  
**Date:** 2026-11-17  
**Governing audit:** [UX/UI conformance audit v1.0](../design/ui-ux-conformance-audit-v1.0.md)  
**Authority order:** product definition → functional requirements → UI solution → corrected SVG references → brand/theme → implementation.  
**Scope:** Correct the post-1.0.1 UI/UX implementation so it conforms to the approved structural design and restore the broken prior-day carry-over entry workflow.  
**Non-goal:** Change Task semantics, persistence ownership, synchronization architecture, installer behavior, Git ownership boundaries, Astryx ownership, or dnd-kit semantics.

---

## 1. Release objective

1.0.2 is complete only when Jig:

1. opens on **Today / Day** so unfinished prior-day work is immediately visible as carry-over;
2. uses the governed desktop **left rail + planning canvas** shell rather than the current global top bar;
3. shows a seven-day Week at the 1440×900 reference viewport without forced horizontal scrolling;
4. uses compact Task rows with one drag handle and one overflow menu rather than the current visible `Drag / Up / Down / Move / Edit` action cluster;
5. renders Day as one **Attention** sequence with row-level carry-over treatment;
6. provides the governed desktop selected-Task inspector;
7. renders History with original scheduled date and actual completion time;
8. exposes Settings/Sync without repository migration, remote-name configuration, branch/ref/worktree terminology or Git reconciliation semantics;
9. uses a deliberate compact narrow/mobile shell instead of wrapping the desktop chrome;
10. has new browser assertions and screenshot evidence that compare the implementation to the corrected reference set.

This release is a **UI composition and UX correction**. Existing planning behavior remains authoritative unless this plan explicitly identifies a presentation/entry-flow defect.

---

## 2. Architectural constraints

### 2.1 Keep the existing semantic owners

Do not change:

- `Task`, `TaskCommand`, `TaskEditChanges`;
- `dayAttention()`, `outstandingForDate()`, `weekDates()`, `historyByCompletionDate()`;
- priority-assisted insertion law;
- exact-position drag/drop law;
- completion/reopen/delete transitions;
- SQLite schema or repository sync behavior;
- HTTP command shape;
- Astryx theme ownership;
- dnd-kit ownership of sortable behavior.

Presentation-only state may be added in React where this plan requires it:
- destination;
- selected date;
- selected Task id for Day inspector;
- open/closed action menu;
- narrow-shell destination menu.

Do not persist this state to SQLite or portable task data.

### 2.2 No new UI framework or generic abstraction layer

Do not add:
- another component framework;
- DTOs/view models for Task;
- generic page-layout framework;
- generic menu framework;
- service/repository layer for UI.

Small Jig-owned components are permitted only where this plan names them.

### 2.3 Breakpoint

Keep one application-owned semantic breakpoint:

```text
48rem / 768 CSS px
```

- <48rem = narrow composition;
- >=48rem = desktop composition.

Do not introduce independent semantic breakpoints inside Week/Day/History/Settings. Pure CSS density adjustments may use viewport ranges, but the semantic composition must remain one of these two modes.

---

# 3. Wave 0 — repair the canonical UI authority before implementation

These changes land first in the same remediation branch. They prevent the implementation team from rebuilding obsolete 1.0.0 Git-management UI.

## UX-001 — Correct `docs/design/ui-solution.md`

**Files**
- `docs/design/ui-solution.md`

**Required edits**

1. Change the normal entry contract from Week-default to:
   - default destination = Day;
   - default selected date = current local civil date;
   - Week remains the principal weekly planning/rearrangement surface.

2. Replace the Settings contract with exactly these user-facing responsibilities:
   - Appearance;
   - selected planning repository path, informational only;
   - coarse synchronization status;
   - Sync now / retry;
   - service health;
   - local database health;
   - portable-data/repository-adapter health;
   - diagnostics information/action where already supported.

3. Remove all UX requirements for:
   - repository migration;
   - remote-name configuration;
   - branch/ref/worktree state;
   - conflict/merge/reconciliation state;
   - removed migration HTTP endpoint.

4. Make the desktop shell contract explicit:
   - left rail owns primary destinations;
   - planning canvas owns surface heading/actions/status;
   - no global top bar may replace this composition.

5. Make the narrow shell contract explicit as defined in UX-010 below.

6. State that the corrected SVG references are structural acceptance references, not inspiration.

**Acceptance**
- no `Migrate`, `remote name`, `worktree`, `branch/ref` UI requirement remains;
- Day/default-entry wording is unambiguous.

---

## UX-002 — Correct the remaining functional-document topology contradiction

**Files**
- `docs/requirements/planning-workbench.md`

**Replace**
The paragraph that says the product must disclose a dedicated Jig branch/ref layout.

**With**
A functional statement only:

> Jig keeps its portable planning records inside the selected repository and synchronizes them automatically when repository transport is available. The isolation mechanism is adapter-private and is not part of Jig's user configuration or planning workflow.

Keep:
- local-only/pending/retrying/synchronized/sync-issue semantics;
- unrelated repository content must remain untouched.

Do not alter any Task behavior.

---

## UX-003 — Replace stale Settings/Sync reference SVG

**Files**
- `docs/design/reference/desktop-settings-sync.svg`

**Required 1440×900 reference structure**

Use the same desktop rail geometry as the other desktop SVGs.

Canvas:

```text
Settings                                             [sync-status]
Repository, synchronization, appearance and diagnostics

Appearance
  Theme              [System] [Light] [Dark]

Planning data
  Repository          /absolute/path/to/planning-repo

Synchronization
  Status              Saved · Synced
  [Sync now]

Diagnostics
  Jig service         Healthy
  Local database      Available
  Portable data       Healthy
  [Run diagnostics]   (only if retained in current shell contract)

Local-first behavior
  Local Task saves remain usable when synchronization is unavailable.
```

**Must not appear**
- Migrate;
- Remote: origin;
- branch/ref;
- worktree;
- Git conflict;
- merge/rebase;
- repository reconciliation.

---

## UX-004 — Correct sync-state reference copy

**Files**
- `docs/design/reference/sync-failure-states.svg`

Keep five states:

1. Saved locally / Synced
2. Sync pending / Retrying
3. Local only
4. Sync issue
5. Local save failure

Rewrite copy so it speaks only in terms of:
- local save safety;
- synchronization availability/outcome;
- retry;
- external repository tooling for problems if needed.

Do not expose topology.

---

## UX-005 — Correct obsolete product-supporting copy in references

**Files**
- `docs/design/reference/desktop-week.svg`
- `desktop-day.svg`
- `desktop-history.svg`
- corrected `desktop-settings-sync.svg`

Replace obsolete `Just-in-time planning` supporting text with current product identity copy consistent with `docs/product/product-identity.md`.

Do not alter structural geometry in this copy-only task.

---

# 4. Wave 1 — fix the daily continuity bug and application shell

## UX-006 — Make Today / Day the fresh-session entry surface

**Audit coverage:** UX-F01  
**Files**
- `ui/src/app.tsx`
- `tests/browser/interactions.spec.ts`

**Current code to replace**

```ts
const [destination, setDestination] = useState<Destination>("week");
const [selectedDate, setSelectedDate] = useState(todayCivilDate);
```

**Target**

```ts
const [destination, setDestination] = useState<Destination>("day");
const [selectedDate, setSelectedDate] = useState(todayCivilDate);
```

No destination persistence is added in 1.0.2.

**Required behavior**
- fresh page load opens Day;
- selected date is today's local civil date;
- `dayAttention(tasks, selectedDate)` supplies earlier unfinished work;
- no prior-day Task is rescheduled;
- Week continues to show the Task only on its original scheduled date;
- Today action always sets today + Day.

**Regression test**
Add a new test before the existing explicit Day carry-over test:

```text
"fresh startup exposes prior-day unfinished work in today's attention list"
```

Test sequence:
1. reset canonical state;
2. create Task scheduled yesterday through API;
3. reload as fresh UI;
4. do not click Day;
5. assert Day is current destination;
6. assert today's heading/date;
7. assert Task visible;
8. assert `Carried over · <yesterday>` visible;
9. fetch API state and assert `scheduled_date === yesterday`.

---

## UX-007 — Replace the horizontal top bar with desktop rail + canvas

**Audit coverage:** UI-01, UI-02, UI-03  
**Files**
- `ui/src/app.tsx`
- `ui/src/styles.css`

### 7.1 Remove

Delete from `app.tsx`:
- `topNav` composition;
- `.jig-topbar`;
- top-bar Previous/Today/Next controls;
- top-bar repository status button.

Do not pass the current topNav to `AppShell`.

### 7.2 Add desktop frame

Inside `AppShell`, render:

```tsx
<div className="jig-shell">
  <aside className="jig-sidebar">
    <div className="jig-sidebar-brand">...</div>
    <nav className="jig-sidebar-nav" aria-label="Primary">...</nav>
    <div className="jig-sidebar-context">...</div>
  </aside>

  <main className="jig-main">
    {durableBanner}
    {content}
  </main>
</div>
```

Use the existing light/dark wordmark assets.

### 7.3 Desktop rail contents

Order exactly:
1. wordmark;
2. supporting line `Schedules attention`;
3. Week;
4. Day;
5. History;
6. Settings;
7. low-priority planning-data label/path context only if it fits the corrected SVG; do not show Git mechanics.

Active destination:
- `aria-current="page"`;
- visually distinct through surface + type weight, not color only.

### 7.4 CSS desktop geometry

At >=48rem:

```css
.jig-shell {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  min-height: 100dvh;
}

.jig-sidebar {
  position: sticky;
  inset-block-start: 0;
  height: 100dvh;
  overflow: auto;
}

.jig-main {
  min-width: 0;
  overflow: auto;
}
```

Target rail width: 12rem / ~192px.

### 7.5 AppShell usage

Retain `AppShell` only as the Astryx application frame/banner host if needed. Jig owns the child grid composition.

Do not introduce a second navigation component library.

---

## UX-008 — Add surface-local header controls and one status pill

**Audit coverage:** UI-02, UI-03, UI-25  
**Files**
- `ui/src/app.tsx`
- `ui/src/week.tsx`
- `ui/src/day.tsx`
- `ui/src/history.tsx`
- `ui/src/settings.tsx`
- `ui/src/styles.css`

Create a small Jig component in `app.tsx` or a new **single-purpose** file `ui/src/status-control.tsx`:

```text
SyncStatusControl
```

It receives `ServiceStatus | null` and `onOpenSettings`.

Exact labels:
- local-only → `Saved locally`
- pending → `Sync pending`
- retrying → `Sync retrying`
- synchronized → `Synced`
- sync-issue → `Sync issue`
- null → `Status unavailable`

It is visually a compact pill/control, not a primary-nav button.

Week and Day headers receive:
- Previous;
- Today;
- Next;
- status pill;
- Add task.

History receives status only.
Settings receives status in its synchronization section rather than duplicating it as a header action if that would be redundant.

---

# 5. Wave 2 — replace the Task row interaction model

## UX-009 — Rebuild `TaskRow` as the canonical compact row

**Audit coverage:** UI-07, UI-08, UI-15, UI-16, UI-17, UI-30  
**Files**
- `ui/src/task-row.tsx`
- `ui/src/styles.css`
- callers in `week.tsx`, `day.tsx`, `history.tsx`

### 9.1 Keep

Keep:
- `CheckboxInput`;
- `ListItem` if it can produce the required card rhythm;
- `useSortable`;
- Task object directly;
- reference open/copy behavior.

### 9.2 Directly visible controls

For active sortable rows, render exactly:
1. completion checkbox;
2. drag handle;
3. title + metadata;
4. overflow action trigger.

For completed/non-sortable rows:
1. completion/reopen control where appropriate;
2. title + metadata;
3. overflow trigger.

### 9.3 Drag handle

Replace:

```tsx
<Button label="Drag" ... />
```

with a compact icon/text-symbol button:

```text
≡
```

Accessible name:
`Drag <task title>`.

The visual label is not `Drag`.

### 9.4 Action menu implementation

Add a local `TaskActionMenu` in `task-row.tsx`.

Do **not** add a dependency.

Implement with a native disclosure:

```tsx
<details className="jig-task-menu">
  <summary aria-label={`Actions for ${task.title}`}>•••</summary>
  <div className="jig-task-menu-panel">
    ...
  </div>
</details>
```

Menu buttons use existing Astryx `Button` primitives.

Action order for active Task:
1. Edit
2. Move to date…
3. Move up (when available)
4. Move down (when available)

Delete remains in editor/inspector because it requires confirmation.

Completed History/Day rows use caller-supplied action set; do not show drag/reorder actions.

### 9.5 Metadata function

Replace `TaskDescription` with a metadata composition that renders in this order when present:
1. carry-over origin;
2. context;
3. reminder;
4. High/Low priority;
5. reference.

Normal priority is omitted.

Carry-over label must be:

```text
Carried over · Wed 18
```

not `From Nov 18`.

### 9.6 Carry-over reminder

When `carriedOverFrom` exists and `reminder_time` exists:

```text
Wed 18 · 10:00
```

Do not render only `Reminder 10:00`.

When not carried over:
```text
10:00
```
with the semantic reminder affordance/icon treatment.

### 9.7 CSS

Delete/reduce:
- `.jig-task-actions` max-width/flex-wrap behavior for visible action clusters.

Add:
- `.jig-task-drag-handle`;
- `.jig-task-menu`;
- `.jig-task-menu-panel`;
- `.jig-task-card`;
- `.jig-task-meta-item`;
- `.jig-task-carried-over`.

The action panel must layer above rows and not affect row width.

---

# 6. Wave 3 — Week conformance

## UX-010 — Rebuild Week header and navigation

**Audit coverage:** UI-06  
**Files**
- `ui/src/week.tsx`
- `ui/src/app.tsx`
- `ui/src/styles.css`

Add props to `WeekView`:
- `onPreviousWeek`;
- `onToday`;
- `onNextWeek`;
- `statusControl` or equivalent rendered element.

App owns date mutation:
- previous = -7 civil days;
- next = +7;
- today = set today + destination Day only when using the global Today shortcut; Week surface's own Today selects today's week and remains Week.

**Week header DOM**

```text
Week
<Monday date> – <Sunday date>          [Previous] [Today] [Next] [status] [Add task]
Plan and rearrange the week
```

Do not return navigation controls to the global rail.

---

## UX-011 — Make all seven Week columns visible at 1440×900

**Audit coverage:** UI-04  
**Files**
- `ui/src/styles.css`
- `ui/src/week.tsx`

### Remove

```css
grid-template-columns: repeat(7, minmax(15rem, 1fr));
min-width: max-content;
width: 15rem;
```

### Target desktop CSS

```css
.jig-week-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(8.75rem, 1fr));
  gap: var(--spacing-2);
  min-width: 0;
}

.jig-week-column {
  width: auto;
  min-width: 0;
}
```

The Week container may use horizontal overflow only when the available desktop canvas is narrower than the semantic minimum required by seven 8.75rem columns plus gaps.

At 1440×900 with 12rem rail, standard Jig padding and gaps:
- `scrollWidth <= clientWidth` on the Week board viewport;
- all seven column headers must intersect the visible viewport.

---

## UX-012 — Correct Week column structure

**Audit coverage:** UI-05, UI-08  
**Files**
- `ui/src/week.tsx`
- `ui/src/styles.css`

Each column renders:

```text
[weekday]
[date]                 [count]

task card
task card
...

[+ Add task]
```

Changes:
- remove header-level `Add`;
- add count = `outstandingForDate(tasks,date).length`;
- add bottom low-chrome Add task button;
- keep header sticky;
- selected date uses subtle selected surface + border;
- Today uses explicit `Today` marker in header, not CSS pseudo-content as the sole semantic owner;
- empty column remains a visible drop zone.

Do not use raw divider-list styling as the final visual boundary. The task card itself owns its boundary.

---

# 7. Wave 4 — Day conformance and inspector

## UX-013 — Convert Day to one Attention sequence

**Audit coverage:** UI-09, UI-13  
**Files**
- `ui/src/day.tsx`
- `ui/src/styles.css`

Delete:
- separate `Carried over` section heading;
- separate carry-over section border;
- separate scheduled-date active section heading.

Build one active container:

```text
Attention        [N tasks]

[carried row]
[carried row]
[today row]
[today row]
```

Implementation sequence:

```ts
const attention = dayAttention(tasks, selectedDate);
const active = [
  ...attention.carried_over.map(task => ({ task, carriedOver: true })),
  ...attention.scheduled.map(task => ({ task, carriedOver: false })),
];
```

Do not create a persisted/UI Task subtype. This local tuple/object is presentation-only.

The selected-date `DateDropZone` wraps the active list so carried-over rows can still be explicitly dragged into today and rescheduled through the existing move operation.

Important:
- a carried-over row remains in its original dnd group until the user explicitly drops/moves it;
- its displayed position in the Attention prefix does not rewrite persisted ordering.

---

## UX-014 — Implement row-level carry-over semantics

**Audit coverage:** UI-10, UI-11  
**Files**
- `ui/src/day.tsx`
- `ui/src/task-row.tsx`
- `ui/src/styles.css`

For each carried row:
- pass `carriedOverFrom={task.scheduled_date}`;
- add `jig-task-carried-over` class through a new TaskRow boolean/class prop;
- render explicit origin text;
- render reminder origin date + time;
- use restrained left-edge/surface differentiation on the row only.

Remove `.jig-carry-over-section`.

---

## UX-015 — Add selected Task state for desktop inspector

**Audit coverage:** UI-12  
**Files**
- `ui/src/app.tsx`
- `ui/src/day.tsx`
- `ui/src/task-row.tsx`
- `ui/src/styles.css`

### App state

Add:

```ts
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
```

Derived:

```ts
const selectedTask =
  selectedTaskId === null
    ? null
    : tasks.find(task => task.id === selectedTaskId) ?? null;
```

This is presentation-only.

### Selection rule

When Day renders:
1. if selectedTaskId identifies a Task in the current Day attention/completed data, retain it;
2. otherwise select the first active Attention Task;
3. if no active Task, select first completed Task;
4. otherwise null.

Do not persist selection.

### TaskRow

Add optional:
- `onSelect?: () => void`;
- `isSelected`.

Clicking row content selects it.
Checkbox, drag handle, reference link and action menu stop propagation.

---

## UX-016 — Build the desktop Day inspector

**Audit coverage:** UI-12  
**Files**
- `ui/src/day.tsx`
- `ui/src/styles.css`
- optional new cohesive file `ui/src/task-inspector.tsx`

At >=48rem Day body is:

```css
.jig-day-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: var(--spacing-4);
}
```

Inspector:
- sticky below surface header;
- title;
- Complete/Reopen;
- Edit;
- Move to date;
- Delete…;
- Context;
- Priority;
- Reminder;
- Reference;
- Notes.

Delete uses the existing confirmed deletion path. Do not implement a second deletion function.

If a field is null, omit its detail row.

Reference:
- http/https → Open;
- other locator → Copy.

On narrow layout:
- do not render side inspector;
- tapping Task continues to select it;
- Edit/action menu remains the route to full editing.

---

## UX-017 — Correct Day header and Completed group

**Audit coverage:** UI-13, UI-14  
**Files**
- `ui/src/day.tsx`
- `ui/src/styles.css`

Header:
- Day eyebrow;
- full selected date;
- Previous;
- Today;
- Next;
- status;
- Add task.

Then:
- DateStrip;
- Attention heading + count;
- active list;
- compact Completed disclosure.

Completed disclosure stays collapsed/compact by default when appropriate; do not turn it into another large card.

---

# 8. Wave 5 — History conformance

## UX-018 — Replace generic TaskRow use with HistoryTaskRow

**Audit coverage:** UI-18, UI-19, UI-20, UI-21  
**Files**
- `ui/src/history.tsx`
- `ui/src/styles.css`

Create a local `HistoryTaskRow` in `history.tsx`; do not introduce a new Task shape.

Display:

```text
✓  Task title                       10:42     •••
   Context · Scheduled Thu 19
```

Completion time:
- derive from `task.completed_at`;
- format in the same local timezone used by `historyByCompletionDate()`;
- use HH:MM localized time.

Scheduled date:
- always display `Scheduled <weekday short> <day>`.

Actions menu:
1. Reopen
2. Edit
3. Delete… (through existing confirmed deletion flow; add callback plumbing from App)

Do not show drag/move up/down.

### App plumbing

Extend `HistoryViewProps` with:
- `onDelete` or an `onRequestDelete` callback that opens the existing TaskEditor/confirmation path.

Prefer reusing the existing editor delete confirmation rather than adding a second AlertDialog implementation.

### Visual grouping

Remove heavy card border from every `.jig-history-group`.

Use:
- date heading;
- completed count;
- compact rows/dividers.

No dashboard metrics.

---

# 9. Wave 6 — Settings and synchronization conformance

## UX-019 — Rebuild Settings to the corrected reference

**Audit coverage:** UI-22, UI-23  
**Files**
- `ui/src/settings.tsx`
- `ui/src/styles.css`
- corrected Settings SVG from UX-003

Render sections in this order:

### Appearance
- System / Light / Dark segmented control.

### Planning data
- label: `Repository`;
- value: `status.repository_path`;
- informational only.

### Synchronization
- status message based on coarse `repository_status`;
- Sync now button;
- when `sync-issue`, copy says local planning data remains safe.

### Diagnostics
- Jig service: Healthy/Unavailable based on status availability;
- Local database: Available/Unavailable;
- Portable data: Healthy/Needs attention from `repository_adapter_healthy`.

Do not display:
- remote name;
- worktree;
- ref;
- branch;
- migrate;
- conflict state.

Do not invent new API fields for 1.0.2.

---

# 10. Wave 7 — narrow/mobile composition

## UX-020 — Replace wrapped desktop chrome with one compact narrow header

**Audit coverage:** UI-27, UI-31  
**Files**
- `ui/src/app.tsx`
- `ui/src/styles.css`
- `docs/design/ui-solution.md`
- mobile reference if needed

At <48rem:

Top row only:

```text
[Jig wordmark]     [Day ▾]     [status]
```

The destination control is one compact disclosure:

```tsx
<details className="jig-mobile-destination-menu">
  <summary>Day</summary>
  <div>
    Week
    Day
    History
    Settings
  </div>
</details>
```

No new dependency.

The menu choices call `setDestination`.

Do not render the desktop sidebar.

Do not render a separate full-width row of all four destination buttons.

Surface-local Today/Previous/Next remain in the Day/Week surface header below the compact app header.

This keeps destination access complete without recreating the current three-row wrapped top bar.

---

## UX-021 — Fit the seven-date strip at the canonical narrow width

**Audit coverage:** UI-28  
**Files**
- `ui/src/date-strip.tsx`
- `ui/src/styles.css`

Remove the current `minmax(3.75rem, 1fr)` narrow rule.

Target:

```css
.jig-week-strip {
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--spacing-0-5);
  overflow: visible;
}

.jig-week-strip-date {
  min-width: 0;
  min-height: 3rem;
  padding-inline: var(--spacing-0-5);
}
```

At 390 CSS px viewport:
- no horizontal strip scroll;
- all 7 dates visible;
- each date control remains at least 44 CSS px effective touch target through cell width/height.

Playwright must assert `scrollWidth <= clientWidth`.

---

## UX-022 — Add persistent narrow Quick Add

**Audit coverage:** UI-29  
**Files**
- `ui/src/day.tsx`
- `ui/src/week.tsx`
- `ui/src/styles.css`

At <48rem:
- hide large header Add task button;
- render one fixed/sticky `+` action in bottom-right;
- accessible name `Add task`;
- opens editor for selected date.

Position:
- above safe-area bottom;
- above any destination/menu overlay;
- does not cover final task row.

Use existing `Button` with compact/icon-like label; no new floating-action dependency.

---

## UX-023 — Narrow Week behavior

Current narrow Week already renders one date at a time through `DayTaskLists`. Retain this semantic approach, but:
- use the corrected unified Attention composition;
- use the compact mobile header;
- use compact row actions;
- preserve Week destination label so the user knows they are browsing the weekly context.

Do not render seven unreadable desktop columns below 48rem.

---

# 11. Wave 8 — editor conformance

## UX-024 — Correct field order and header context

**Audit coverage:** UI-32, UI-33, UI-34  
**Files**
- `ui/src/task-editor.tsx`
- `ui/src/styles.css`

Field order must be:

1. Title
2. Date
3. Context
4. Priority
5. Reminder
6. Reference
7. Notes

Move Context above Priority.

Header:
- Add Task subtitle: selected date, formatted;
- Edit Task subtitle: Task's scheduled date, formatted.

Remove generic:
- `Start with a title. Everything else is optional.`
- `Update only what changed.`

Keep:
- Save;
- Cancel;
- Delete task…;
- explicit confirmation;
- current TaskCommand behavior.

At narrow width:
- dialog fills most/all viewport height as needed;
- Save/Cancel remain visible/reachable;
- Delete remains visually separated from primary Save.

---

# 12. Wave 9 — visual-system cleanup

## UX-025 — Replace heavy generic card stacks with governed low-chrome structure

**Audit coverage:** UI-08, UI-21, UI-36  
**Files**
- `ui/src/styles.css`

Remove/reduce container border + radius treatment from:
- History groups;
- Day active section;
- Settings section stack where references use simple section separation.

Keep card/border treatment where the reference actually uses a bounded Task card or inspector.

Do not modify `theme.css` primitive palette.

Do not hard-code new colors in `styles.css`; use Astryx semantic tokens.

---

## UX-026 — Explicit selected/current/focus semantics

**Files**
- `ui/src/styles.css`
- Week/Day row classes

Ensure these states remain independently visible in Light and Dark:
- selected destination;
- selected date;
- today;
- selected Task;
- carried-over Task;
- focused control;
- drag target;
- completed Task;
- High/Low;
- sync issue.

No state may rely on color alone.

---

# 13. Wave 10 — save/sync feedback conformance

## UX-027 — Keep durable local-save failure visible at the planning surface

**Audit coverage:** UI-26  
**Files**
- `ui/src/app.tsx`
- `ui/src/task-editor.tsx`
- `tests/browser/sync-failure.spec.ts`

Keep:
- global durable operation-error Banner for list/reorder/complete failures;
- editor inline error for editor save failure;
- sync issue separate from local-save failure.

Move the durable Banner into `.jig-main` immediately above the active surface.

Do not:
- convert local-save errors to transient toast;
- show `Saved` after failed command;
- collapse sync issue and local-save failure into one state.

---

# 14. Wave 11 — exact browser/test implementation

## UX-028 — Update existing tests for the new shell and row controls

**Files**
- `tests/browser/interactions.spec.ts`
- `core-flow.spec.ts`
- `sync-failure.spec.ts`
- helpers if needed

Replace selectors that depend on removed visible buttons:
- `Drag`;
- `Up`;
- `Down`;
- `Move…`;
- global top-bar Previous/Today/Next.

Use accessible names on:
- drag handle;
- task action menu;
- menu actions;
- surface controls.

Do not weaken interaction assertions.

---

## UX-029 — Add structural conformance spec

**New file**
- `tests/browser/ui-conformance.spec.ts`

Required tests:

### C01 — desktop shell
Viewport 1440×900.
Assert:
- sidebar visible;
- Week/Day/History/Settings in sidebar;
- `.jig-topbar` absent;
- main canvas visible.

### C02 — Day is initial destination
Fresh state.
Assert Day current and today's date.

### C03 — carry-over startup
Persist yesterday Task.
Fresh load.
Assert immediate visibility + carry-over origin + API date unchanged.

### C04 — Week seven-day visibility
Navigate Week.
Assert:
- 7 columns;
- all 7 bounding boxes inside board viewport;
- board `scrollWidth <= clientWidth`.

### C05 — row action density
Create Task.
Assert:
- drag handle visible;
- one action summary visible;
- no visible buttons named Up/Down/Move/Edit until menu opened.

### C06 — unified Day Attention
Create yesterday + today Tasks.
Assert:
- one `Attention` heading;
- no `Carried over` section heading;
- carried row precedes today's row.

### C07 — reminder origin
Yesterday Task with reminder.
Assert text includes yesterday date and reminder time.

### C08 — desktop inspector
Select Task.
Assert inspector visible and contains Context/Priority/Reminder/Reference/Notes as applicable.

### C09 — History semantics
Complete a yesterday-scheduled Task today.
Assert History row includes:
- `Scheduled <yesterday>`;
- completion HH:MM.

### C10 — Settings forbidden terms
Navigate Settings.
Assert page does not contain:
- `Migrate`;
- `worktree`;
- `branch`;
- `ref`;
- `Remote origin`.

### C11 — narrow shell
Viewport 390×844.
Assert:
- desktop sidebar absent;
- one compact app header;
- destination disclosure accessible;
- Day content starts without stacked desktop navigation rows;
- all four destinations reachable via disclosure.

### C12 — narrow date strip
390px width.
Assert strip does not scroll horizontally and shows all 7 dates.

### C13 — mobile Quick Add
Assert persistent + Add button visible and last task remains unobscured.

### C14 — theme parity
Run representative Day/Week assertions under Light and Dark.

---

# 15. Wave 12 — screenshot evidence

## UX-030 — Capture new 1.0.2 evidence set

**New directory**
- `docs/evidence/v1.0.2/browser/`

Capture exactly:
- `desktop-week-light.jpg`
- `desktop-week-dark.jpg`
- `desktop-day-carry-over.jpg`
- `desktop-day-inspector.jpg`
- `desktop-history.jpg`
- `desktop-settings.jpg`
- `mobile-day.jpg`
- `mobile-editor.jpg`
- `sync-issue.jpg`
- `local-save-failure.jpg`

Do not overwrite `docs/evidence/v1/browser/`.

Add:
- `docs/evidence/v1.0.2/README.md`

For every screenshot record:
- viewport;
- theme;
- scenario;
- governing SVG;
- intentional variances, if any.

Any remaining structural variance must be documented and approved before release.

---

# 16. File-by-file final state

## `ui/src/app.tsx`

Must:
- default destination to Day;
- own selected date;
- own selectedTaskId;
- render desktop rail or narrow compact header;
- stop rendering the old topNav;
- keep durable Banner in main canvas;
- pass surface navigation callbacks/status controls;
- pass delete/edit/move callbacks to inspector/History.

Must not:
- contain global Previous/Today/Next row;
- expose Git topology;
- persist destination/selection to domain storage.

## `ui/src/task-row.tsx`

Must:
- render compact row;
- direct checkbox;
- direct drag handle if sortable;
- one overflow disclosure;
- correct carry-over/reminder metadata;
- support selected styling;
- stop propagation for interactive children.

Must not:
- render visible text action cluster.

## `ui/src/week.tsx`

Must:
- desktop seven-column board;
- counts;
- sticky headers;
- bottom Add;
- surface navigation;
- narrow one-date composition.

Must not:
- use 15rem fixed columns;
- use header Add per column;
- duplicate carry-over into later Week dates.

## `ui/src/day.tsx`

Must:
- one Attention sequence;
- row-level carry-over;
- completed disclosure;
- desktop inspector;
- narrow no-side-inspector composition.

Must not:
- render separate Carried over active section.

## `ui/src/history.tsx`

Must:
- History-specific row;
- scheduled date;
- completion time;
- compact actions.

Must not:
- use generic sortable/planning action density.

## `ui/src/settings.tsx`

Must:
- Appearance;
- Planning data path;
- synchronization state/action;
- service/db/portable-data diagnostics.

Must not:
- expose remote name/migration/topology.

## `ui/src/task-editor.tsx`

Must:
- correct field order;
- date subtitle;
- preserve confirmation behavior.

## `ui/src/date-strip.tsx`

Must:
- seven visible narrow dates;
- current/selected semantics;
- no horizontal scroll at 390px.

## `ui/src/styles.css`

Must:
- remove old topbar rules;
- add sidebar/main/narrow header;
- fix Week grid;
- add compact Task card/menu;
- add Day inspector grid;
- reduce heavy section cards;
- preserve semantic tokens.

## `ui/src/theme.css`

No product palette changes expected.

---

# 17. Audit finding → implementation task traceability

| Audit finding | Implementation task |
|---|---|
| UX-F01 | UX-006 |
| UI-01 | UX-007 |
| UI-02 | UX-008 |
| UI-03 | UX-007, UX-008 |
| UI-04 | UX-011 |
| UI-05 | UX-012 |
| UI-06 | UX-010 |
| UI-07 | UX-009 |
| UI-08 | UX-009, UX-012, UX-025 |
| UI-09 | UX-013 |
| UI-10 | UX-014 |
| UI-11 | UX-014 |
| UI-12 | UX-015, UX-016 |
| UI-13 | UX-013, UX-017 |
| UI-14 | UX-017 |
| UI-15 | UX-009 |
| UI-16 | UX-009 |
| UI-17 | UX-009 |
| UI-18 | UX-018 |
| UI-19 | UX-018 |
| UI-20 | UX-018 |
| UI-21 | UX-018, UX-025 |
| UI-22 | UX-001, UX-003, UX-019 |
| UI-23 | UX-019 |
| UI-24 | preserve; UX-027 regression |
| UI-25 | UX-008 |
| UI-26 | UX-027 |
| UI-27 | UX-020 |
| UI-28 | UX-021 |
| UI-29 | UX-022 |
| UI-30 | UX-009, UX-020 |
| UI-31 | UX-001, UX-020 |
| UI-32 | UX-024 |
| UI-33 | UX-024 |
| UI-34 | UX-024, UX-029 |
| UI-35 | UX-005 |
| UI-36 | UX-025 |

No audit finding is allowed to remain without a task or an explicit preserve/no-change disposition.

---

# 18. Execution order and merge gates

Execute in this order:

1. UX-001…005 — canonical docs/references.
2. UX-006 — Day default + carry-over startup regression.
3. UX-007…008 — shell/status.
4. UX-009 — Task row/action model.
5. UX-010…012 — Week.
6. UX-013…017 — Day/inspector.
7. UX-018 — History.
8. UX-019 — Settings.
9. UX-020…023 — narrow/mobile.
10. UX-024 — editor.
11. UX-025…027 — visual/feedback cleanup.
12. UX-028…029 — regression + conformance tests.
13. UX-030 — evidence set.

### Gate A — after UX-006
Carry-over startup bug test green.

### Gate B — after UX-012
Desktop shell + Week conformance tests green at 1440×900.

### Gate C — after UX-017
Day Attention + inspector + carry-over semantics green.

### Gate D — after UX-024
History, Settings, narrow shell, editor green.

### Gate E — release candidate
All existing tests + `ui-conformance.spec.ts` + screenshot evidence review green.

Do not defer structural failures to polish.

---

# 19. Release acceptance checklist

1. Fresh open lands on Today / Day.
2. Yesterday unfinished work appears immediately.
3. Original scheduled date remains unchanged.
4. Desktop has left rail; no replacement top bar.
5. Week shows all seven columns at 1440×900.
6. Week columns show count + bottom Add.
7. Row shows compact drag + overflow only.
8. Day has one Attention sequence.
9. Carry-over label is explicit and row-local.
10. Carry-over reminder shows originating date.
11. Desktop Day inspector exists.
12. History shows scheduled date + completion time.
13. Settings has no forbidden Git-management concepts.
14. Narrow shell is compact and all destinations are reachable.
15. Seven mobile dates fit at 390px.
16. Mobile Quick Add is persistent and unobstructive.
17. Editor hierarchy matches reference.
18. Local-save failure remains durable/actionable.
19. Sync issue remains distinct from local save failure.
20. Light/Dark/System preserve hierarchy.
21. Existing drag/edit/complete/delete/reminder/sync tests stay green.
22. New conformance tests stay green.
23. New 1.0.2 screenshot evidence is reviewed against corrected SVGs.
24. No Task/persistence/Git architecture change is introduced.

---

# 20. Definition of done

The 1.0.2 UX/UI remediation is done only when the code, corrected design authority, browser assertions and screenshot evidence all agree.

Passing functional tests alone is insufficient.

Passing screenshots alone is insufficient.

The release requires both:
- **behavioral correctness**, including prior-day continuity;
- **structural conformance**, including shell, density, row actions, Day inspector, History semantics and narrow composition.

The implementation team should not make additional UX design choices while executing this plan. If a required Astryx primitive is unavailable, use the smallest local semantic HTML composition needed for the behavior described here and document that implementation detail; do not change the target interaction or add a new dependency without a separate architectural decision.
