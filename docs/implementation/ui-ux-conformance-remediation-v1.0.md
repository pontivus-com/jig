# Jig 1.0.2 UX/UI conformance remediation — implementation plan v1.0

**Status:** Implementation-ready bug-fix plan, amended 2026-11-17 with mandatory Astryx/CSS architecture correction.  
**Target release:** 1.0.2  
**Date:** 2026-11-17  
**Governing audit:** [UX/UI conformance audit v1.0](../design/ui-ux-conformance-audit-v1.0.md)  
**Authority order:** product definition → functional requirements → technical-solution ownership/dependency contract → UI solution → corrected SVG references → brand/theme → this implementation plan → code.  
**Scope:** Correct the post-1.0.1 UI/UX implementation so it conforms to the approved structural design and replace the broken derived carry-over behavior with persisted daily rollover.  
**Non-goal:** Change the Task schema, persistence ownership, synchronization architecture, installer behavior, Git ownership boundaries, Astryx ownership, or dnd-kit semantics. This release intentionally changes rollover semantics by mutating `scheduled_date` for overdue outstanding Tasks.

**Architecture amendment:** The UI library boundary is a release requirement. Any earlier instruction in this document that could be read as authorizing a second application shell, raw parallel navigation, private Astryx CSS/DOM overrides, a Jig cascade override layer, or CSS-only reconstruction of a different semantic mobile hierarchy is superseded by §2.4 and the corrected UX-007/UX-020/UX-024 tasks below. Existing code that violates those constraints must be removed/recomposed, not visually patched.

---

## 1. Release objective

1.0.2 is complete only when Jig:

1. automatically rolls every unfinished prior-day card into the current day's canonical bucket by changing `scheduled_date`, and opens on **Today / Day**;
2. uses the governed desktop **left rail + planning canvas** shell rather than the current global top bar;
3. shows a seven-day Week at the 1440×900 reference viewport without forced horizontal scrolling;
4. uses compact Task rows with one drag handle and one overflow menu rather than the current visible `Drag / Up / Down / Move / Edit` action cluster;
5. renders Day as one **Attention** sequence from the selected date's canonical bucket after rollover;
6. provides the governed desktop selected-Task inspector;
7. renders History with canonical scheduled date and actual completion time;
8. exposes Settings/Sync without repository migration, remote-name configuration, branch/ref/worktree terminology or Git reconciliation semantics;
9. uses a deliberate compact narrow/mobile shell instead of wrapping the desktop chrome;
10. has new browser assertions and screenshot evidence that compare the implementation to the corrected reference set.

This release is a **UI composition + focused planning-behavior correction**. Existing planning behavior remains authoritative except for the explicitly replaced derived carry-over model.

---

## 2. Architectural constraints

### 2.1 Keep the existing semantic owners

Do not change:

- `Task`, `TaskCommand`, `TaskEditChanges`;
- `outstandingForDate()`, `weekDates()`, `historyByCompletionDate()` remain semantic owners; `dayAttention()` carry-over behavior is retired/replaced by persisted rollover;
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

### 2.4 Astryx-first UI and CSS architecture

The pinned Astryx 0.7.13 public contract is determinate and must be used before Jig-owned styling:

1. `AppShell` is the outermost application frame. It already owns `sideNav`, responsive mobile-navigation behavior, the skip link and the single main landmark.
2. `SideNav` / `SideNavItem` own primary navigation presentation and interaction. Configure rail sizing through supported public props/root styling only.
3. The AppShell `mobileNav` contract owns the mobile drawer and responsive navigation lifecycle. Its default `md` breakpoint is 768 CSS px, matching Jig's one semantic breakpoint. Jig may control/open that drawer from a public Astryx Button in the governed narrow header; it must not recreate navigation with raw `<details>` or a second menu implementation.
4. Astryx public primitives own reusable list, field, button, dialog, feedback, focus and responsive mechanics. Jig React owns only product-specific composition.
5. Jig CSS may style only Jig-owned composition/root classes. It must not target Astryx descendants, generated StyleX anatomy, undocumented/private selectors or private custom properties such as `--_*`.
6. Do not declare a Jig high-priority cascade layer whose purpose is to outrank Astryx, do not use `!important`, and do not increase selector specificity to force a library component into a different anatomy.
7. Explicit pixel dimensions are allowed only for governed structural budgets (20 px application inset where the reference requires it, 190 px rail, Week track/gap geometry, Day 650/30/490 split, Settings 560/580 split, mobile frame/Quick Add geometry). Ordinary spacing, radii, typography and control sizing use Astryx public tokens/props.
8. When desktop and narrow **semantic hierarchy** differs, choose the correct React composition from the one shared layout-mode state. CSS media queries are for pure reflow/density inside that composition, not for mounting desktop DOM and hiding/repositioning fragments into a mobile hierarchy.
9. Each layout property has one owner. When a structure changes, delete the obsolete CSS/DOM path instead of adding a later override that cancels it.
10. If a pinned Astryx public primitive is proven incapable of satisfying a governed reference, document the precise incompatibility first, then use the smallest Jig-owned semantic composition built from Astryx public leaves/tokens. No second UI/styling framework.
11. Jig's custom theme authoring source is `ui/src/jig-theme.source.ts`. It extends the built Neutral theme and is compiled only by pinned `@astryxdesign/cli@0.7.13` through `astryx theme build`. Runtime code consumes the generated `ui/src/jig.js` and `ui/src/jig.css`; authored code must not set Astryx's internal `__built` marker or replace the documented compiler with local theme-generation logic. Generated artifacts are committed and CI runs `theme build --check`; source/artifact drift is a release blocker.

These constraints are release blockers. Geometry tests and screenshots do not waive them.

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
  Browser notifications
    Unsupported | Not enabled [Enable] | Enabled | Blocked in browser settings

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

## UX-006 — Implement persisted daily rollover and make Today / Day the fresh-session entry

**Audit coverage:** UX-F01  
**Files**
- `src/core/planning.ts`
- `src/shell/sqlite.ts`
- `src/shell/main.ts`
- `src/shell/http.ts`
- `ui/src/app.tsx`
- `ui/src/day.tsx`
- `tests/core/planning.test.ts`
- `tests/persistence/mutations.test.ts` or equivalent SQLite mutation test
- `tests/browser/interactions.spec.ts`
- new/updated lifecycle test for local-day rollover

### 6.1 Add one pure core rollover operation

Add to `src/core/planning.ts`:

```ts
export function rollForwardOutstanding(
  tasks: readonly Task[],
  currentLocalDate: string,
  updatedAt: string,
): {
  readonly tasks: readonly Task[];
  readonly moved_task_ids: readonly string[];
}
```

Rules:

1. validate Task set, `currentLocalDate`, and `updatedAt`;
2. select Tasks where:
   - `completed_at === null`;
   - `scheduled_date < currentLocalDate`;
3. sort selected Tasks by:
   - source `scheduled_date` ascending;
   - source `position` ascending;
4. remove them from their source-day active sequences;
5. move them directly to `currentLocalDate`;
6. destination sequence is:
   - rolled-forward Tasks in the deterministic order above;
   - then existing current-day outstanding Tasks in their existing relative order;
7. rewrite destination positions contiguously from zero;
8. compact every affected source date;
9. for each moved Task update:
   - `scheduled_date = currentLocalDate`;
   - `updated_at = updatedAt`;
   - keep id/title/priority/context/reference/note/reminder_time unchanged;
10. completed Tasks are untouched;
11. if no Task moves, return the original semantic state with empty `moved_task_ids`.

Do not create:
- `carried_over` flag;
- original-scheduled-date field;
- rollover history table;
- per-day intermediate mutations.

If Jig was inactive for several days, all overdue Tasks move directly to the current local date in one operation.

### 6.2 Remove the derived carry-over planning path

The UI must stop depending on overdue Tasks remaining on old dates.

`dayAttention()` must no longer be the source of a carry-over prefix.

Preferred minimal correction:
- remove `DayAttention` / `dayAttention()` if no remaining caller requires them;
- Day reads `outstandingForDate(tasks, selectedDate)`.

Do not keep both persisted rollover and a derived carry-over projection.

### 6.3 Add one SQLite transaction owner

Add a cohesive persistence operation in `src/shell/sqlite.ts`, conceptually:

```ts
rollForwardOutstandingInDatabase(
  db,
  currentLocalDate,
  updatedAt,
): {
  revision: number;
  moved_task_ids: readonly string[];
}
```

Requirements:
- read one canonical state;
- call the pure core rollover;
- if nothing moved, do not increment revision or dirty sync state;
- if Tasks moved, persist all affected Task dates/positions atomically;
- increment revision exactly once;
- mark pending sync/dirty exactly as a normal successful Task mutation;
- rollback the whole rollover on any persistence failure.

Do not loop through HTTP commands one Task at a time.

### 6.4 Service-owned day-boundary trigger

Rollover is automatic and owned by the service, not by a particular view.

In `src/shell/main.ts`:
1. run an idempotent rollover catch-up during service startup before normal planning state is served;
2. schedule one timer for the next local civil-day boundary;
3. when it fires, run the same SQLite rollover transaction;
4. notify the existing sync controller when Tasks moved;
5. schedule the next boundary;
6. clear the timer on service shutdown.

Also perform a cheap idempotent `ensureCurrentDayRollover()` before:
- returning canonical Task state;
- admitting a Task mutation.

This catches suspend/sleep or delayed timer execution.

No per-Task timers.

### 6.5 Local date owner

Use the service machine's local civil date for automatic rollover.

Add one small date helper in an existing cohesive date/shell module; do not add a date library.

The local service and local browser are assumed to share the host's civil timezone for the desktop MVP.

### 6.6 Reminder behavior

`reminder_time` remains unchanged.

Because `scheduled_date` changes, an overdue Task with `10:00` reminder becomes a current-day Task with a current-day `10:00` reminder.

Do not display the obsolete source date as reminder metadata.

### 6.7 UI entry

Change:

```ts
const [destination, setDestination] = useState<Destination>("week");
```

to:

```ts
const [destination, setDestination] = useState<Destination>("day");
```

Selected date remains today's local civil date.

Day reads the already-rolled canonical bucket.

### 6.8 Core tests

Add tests:

1. yesterday Task moves to today and date changes;
2. Task disappears from yesterday sequence;
3. Task appears in today's sequence;
4. existing today's Tasks remain after rolled-forward Tasks;
5. multiple old dates preserve old-date + position ordering;
6. source positions compact;
7. multi-day catch-up moves directly to current date;
8. completed Tasks never move;
9. reminder time is preserved;
10. no-op rollover returns no moved ids;
11. month/year boundary works.

### 6.9 Persistence tests

Prove:
- all affected dates update in one transaction;
- one revision increment;
- pending sync set;
- rollback leaves every date unchanged on failure;
- restart reads the new rolled-forward dates.

### 6.10 Browser acceptance

Test:

```text
"unfinished prior-day cards roll into today across Day and Week"
```

Sequence:
1. persist Task scheduled yesterday;
2. fresh service/UI startup;
3. assert Day is initial destination;
4. assert card visible in today's Day Attention;
5. fetch API and assert `scheduled_date === today`;
6. navigate Week;
7. assert card is in today's column;
8. assert card is absent from yesterday's column;
9. reload;
10. assert same current-day bucket persists.

This test is the release blocker for the reported bug.

### 6.11 HTTP admission ordering is strict

For every Task mutation request, the service executes in this exact order:

```text
ensureCurrentDayRollover()
→ read post-rollover current revision
→ compare expected_revision
→ 409/refetch if stale
→ execute requested Task mutation only when revision matches
```

Do not:
- compare `expected_revision` before rollover;
- perform rollover after admitting the requested mutation;
- merge rollover and the requested command into one ambiguous admission decision.

Regression test:
1. browser/client holds yesterday's revision;
2. day advances and rollover changes canonical state/revision;
3. client submits a Task mutation with old revision;
4. service returns 409;
5. requested mutation is not applied;
6. refetch returns rolled-forward state and new revision;
7. retry with new revision succeeds normally.

### 6.12 Revalidate an already-open browser across local midnight

The service-side timer alone is insufficient because React holds an in-memory canonical Task array.

In `ui/src/app.tsx`, add one browser-local civil-date observer:

```ts
const [observedToday, setObservedToday] = useState(todayCivilDate);
```

Use the existing canonical refresh function; do not add polling state or a second cache.

Behavior:
1. schedule one timeout for the next local civil-day boundary;
2. on timeout, compute the current local civil date;
3. also recompute on `window.focus` and `document.visibilitychange`;
4. when current local date differs from `observedToday`:
   - update `observedToday`;
   - call the existing canonical-state refresh path;
   - if `selectedDate === oldObservedToday`, set `selectedDate` to the new current date;
   - if the user explicitly selected another historical/future date, preserve it;
5. reschedule the next boundary timeout.

This browser observer does not perform rollover itself. It only revalidates the service-owned canonical state.

The refreshed Task array must flow to:
- Week;
- Day;
- History;
- selected-task inspector;
- `ReminderMonitor`.

Regression tests:

#### 6.12-A open browser midnight rollover
1. start with yesterday/current-day setup and UI already open;
2. advance mocked local date across midnight without reloading;
3. service rollover commits;
4. browser observer refreshes canonical state;
5. Day/Week show the card in the new current-day bucket;
6. no manual navigation/reload is required.

#### 6.12-B explicit date selection preservation
1. user selects a future or historical date;
2. local midnight passes;
3. canonical state refreshes;
4. selected date remains the explicitly selected date.

#### 6.12-C reminder monitor receives refreshed Task date
1. overdue Task has reminder time;
2. rollover moves Task to today while browser remains open;
3. canonical refresh updates ReminderMonitor input;
4. reminder eligibility uses today's date/key.

---

## UX-007 — Replace the horizontal top bar with Astryx-owned rail + canvas

**Audit coverage:** UI-01, UI-02, UI-03  
**Files**
- `ui/src/app.tsx`
- `ui/src/styles.css`

### 7.1 Remove the competing shell

Delete from `app.tsx`:
- the legacy `topNav` composition;
- the current Jig-owned `.jig-shell` / `.jig-sidebar` application-frame implementation;
- any second `<main>`/shell wrapper inside `AppShell`;
- raw/custom primary-navigation mechanics that duplicate Astryx SideNav/AppShell mobile navigation.

Delete the CSS that exists only to make those duplicate structures behave like an application shell.

### 7.2 Use the pinned public AppShell contract

The application root must use `AppShell` as the real outer frame, not as a banner wrapper around another shell.

Conceptually:

```tsx
<AppShell
  sideNav={primarySideNav}
  mobileNav={{
    breakpoint: "md",
    hasToggle: false,
    isOpen: mobileNavOpen,
    onOpenChange: setMobileNavOpen,
  }}
  banner={durableBanner}
  contentPadding={0}
  height="fill"
  variant="section"
>
  {content}
</AppShell>
```

`md` is the pinned Astryx 0.7.13 768 px breakpoint and is therefore the one Jig semantic breakpoint.

`primarySideNav` uses public `SideNav`, `SideNavHeading`/supported header content and `SideNavItem` primitives. The same SideNav content is reused by AppShell's mobile-navigation path. Do not build a second mobile destination list.

### 7.3 Desktop rail contents and geometry

Order exactly:
1. canonical compact Jig identity;
2. supporting line `Schedules attention` where supported by the SideNav public header/top-content API;
3. Week;
4. Day;
5. History;
6. Settings;
7. low-priority planning-data context only where it fits the reference and public SideNav slots; do not show Git mechanics.

Active destination uses the public SideNav selected/current semantics and remains distinguishable without color alone.

The governed desktop frame remains:
- 20 px outer application inset where the reference surface requires it;
- 190 px rail visual budget;
- planning canvas origin at x=240 at 1440×900.

Achieve those budgets through public AppShell/SideNav/root sizing and Jig-owned outer composition only. Do not style Astryx internal descendants or private variables to obtain them. If the exact 190 px budget requires a public root width/xstyle/style configuration, use that supported API and prove the resulting geometry in Playwright.

### 7.4 AppShell ownership acceptance

Acceptance:
- exactly one AppShell application frame;
- exactly one main landmark, provided by AppShell;
- primary destinations are SideNav-owned;
- mobile destination navigation is AppShell/mobileNav-owned;
- no `.jig-shell` or `.jig-sidebar` parallel frame remains;
- no raw `<details>` navigation replacement;
- no CSS selector reaches into Astryx shell/navigation internals.

Do not introduce a second navigation/component library.

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

## UX-009 — Rebuild `TaskRow` as the canonical Task card

**Audit coverage:** UI-07, UI-08, UI-15, UI-16, UI-17, UI-30  
**Files**
- `ui/src/task-row.tsx`
- `ui/src/drag.tsx`
- `ui/src/styles.css`
- callers in `week.tsx`, `day.tsx`, `history.tsx`

### 9.1 The card is the primary interaction object

The UI must read as **cards that can be picked up and moved**, similar to the interaction clarity of a Trello card.

A normal active Task card contains only:

```text
┌──────────────────────────────┐
│ □  ≡  Task title        •••  │
│       Context · 10:00        │
│       High                   │
└──────────────────────────────┘
```

Depending on Task data, metadata rows collapse naturally.

There must be **no visible text controls** saying:
- Drag;
- Edit;
- Move;
- Up;
- Down.

The card itself communicates:
- this is one movable Task;
- checkbox = complete/reopen;
- subtle grip = drag affordance;
- `•••` = secondary actions.

### 9.2 Card visual contract

The canonical Week SVG establishes the target proportions:
- approximately 148 px wide inside a 160 px Week column;
- typical card height ~86 px for title + one/two metadata lines;
- ~8 px corner radius;
- 1 px semantic border;
- surface background distinct from column background;
- compact internal padding;
- cards separated by whitespace, not full-width list dividers.

Implementation must remain fluid rather than hard-code 148 px, but preserve this visual density.

Use:
- `background: var(--color-background-surface)`;
- semantic border token;
- Astryx radius token closest to the reference;
- no decorative shadow at rest unless the current Astryx token is materially needed for separation.

The selected card may use the governed subtle selected surface/border.

Component ownership is mandatory:
- first attempt the card with Astryx `List`/`ListItem` through **public props only** for density, start/label/end content, selection and focus;
- do not set private ListItem variables, target generated descendants, or impose a second internal grid/padding model on the Astryx row;
- if browser proof shows that the public ListItem contract cannot produce the governed draggable-card anatomy, record that exact limitation and replace only the row host with the smallest semantic Jig `<li>`/card composition while continuing to use Astryx public `CheckboxInput`, menu/button/link primitives and semantic tokens;
- the fallback is preferable to forcing a library component through private CSS because it leaves exactly one owner for card geometry.

### 9.3 Card content hierarchy

Visible content is limited to Task information and compact affordances.

Order:
1. checkbox;
2. subtle drag grip `≡`;
3. title;
4. overflow trigger `•••`;
5. metadata beneath title.

Metadata order when present:
1. context;
2. reminder;
3. High/Low priority;
4. reference affordance.

Normal priority is omitted.

Do not display implementation verbs on the card.

### 9.4 Drag behavior — move the full card

The current `ui/src/drag.tsx` renders only:

```tsx
<div className="jig-drag-overlay">{activeTask.title}</div>
```

Delete this title-only overlay.

During drag, the overlay must render a **full visual Task card clone**, with the same:
- dimensions;
- title;
- context/reminder/priority metadata;
- border/radius;
- internal spacing.

Interactive controls inside the drag clone are inert/aria-hidden.

The user must see the same card lift and move, not a text label detach from the card.

### 9.5 Drag activation

The **non-interactive card surface is the primary drag activator**.

Pointer behavior:
- press/drag on the card body starts the sortable drag;
- the subtle `≡` grip is a visual cue and is also draggable, but it is not the only valid grab point;
- the user must not have to target a tiny handle to move the Task;
- checkbox, reference/link controls and `•••` action menu must stop propagation and must never start a drag.

This is the intended Trello-like behavior: grab the Task card itself and move it.

Cursor:
- draggable card surface uses `cursor: grab`;
- active drag uses `cursor: grabbing`;
- interactive child controls keep their normal pointer/focus cursor behavior.

Keyboard/touch:
- retain dnd-kit accessible keyboard drag behavior;
- touch dragging must move the same whole-card object;
- overflow retains Move to date / Move up / Move down as accessible non-drag alternatives;
- touch targets remain at least approximately 44 CSS px even where the visual glyph is small.

Implementation requirement:
- attach dnd-kit sortable activation to the card/root interaction surface rather than making `dragHandleRef` the sole pointer activator;
- if interactive descendants need explicit event suppression, add it locally to those descendants;
- do not replace dnd-kit with custom pointer-drag code.

The **visual object and interaction object are the same card**.

### 9.6 Drop behavior

While dragging:
- source card is visually lifted/ghosted but its location remains understandable;
- candidate destination column/date gets the existing semantic drop-target treatment;
- exact insertion position remains visible through dnd-kit sortable behavior;
- dropping within a date preserves exact-position reorder;
- dropping in another date performs the existing exact-position move;
- dropping onto an empty date appends at index 0;
- cancel returns the card with no Task mutation.

Do not change `TaskCommand` or move semantics.

### 9.7 Overflow menu

Add a local `TaskActionMenu` composition in `task-row.tsx`, but do not implement a second menu system.

Use the pinned Astryx public `DropdownMenu` / `DropdownMenuItem` API (or its documented public trigger/presentation contract) for trigger, focus, keyboard, dismissal and adaptive presentation. Jig owns only the Task-specific action list and callbacks.

Do **not**:
- add a dependency;
- use raw `<details>`/custom fixed-position menu mechanics while Astryx provides the required public menu primitive;
- style DropdownMenu private descendants or internal variables.

Actions for an active Task:
1. Edit
2. Move to date…
3. Move up — accessible alternative only
4. Move down — accessible alternative only

These labels appear **inside the opened menu**, never on the resting card.

Delete remains behind the confirmed editor/inspector path.

### 9.8 Rolled-forward card presentation

After rollover commits, the Task is a normal card in the new current-day bucket.

Do not render:
- `Carried over · …`;
- `From …`;
- originating-date reminder metadata;
- a persisted/derived carry-over badge.

The fact that the card moved forward is represented by its canonical date/bucket.

### 9.9 CSS replacement

Remove/reduce:
- `.jig-task-actions` visible action-cluster layout;
- generic full-width divider-list treatment as the card boundary;
- title-only `.jig-drag-overlay`.

Add only Jig-owned presentation hooks that remain necessary:
- `.jig-task-card`;
- `.jig-task-card-selected`;
- `.jig-task-card-dragging`;
- `.jig-task-drag-handle`;
- `.jig-task-meta-item`;
- `.jig-drag-card-overlay`.

Do not add local menu-panel positioning/anatomy CSS when Astryx DropdownMenu owns that surface. Do not use private Astryx custom properties such as the current ListItem `--_item-*` family.

The action panel must layer above cards and never increase card width.

### 9.10 Acceptance

At rest:
- a Task reads visually as one card;
- no visible Drag/Edit/Move/Up/Down text exists;
- card content is legible in the canonical narrow Week column.

During drag:
- the complete card lifts;
- the complete card follows the pointer/keyboard operation;
- destination highlighting/insertion remains clear;
- no title-only drag chip appears.

Browser assertions must verify:
- resting card has one checkbox, one grip and one overflow trigger;
- visible action text is absent before menu open;
- drag overlay contains the Task card title **and metadata**, not title alone;
- dragged overlay bounding box is approximately the source card bounding box;
- cross-date drop and exact-position reorder still mutate the same canonical Task correctly.

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

## UX-013 — Render Day from the canonical selected-date bucket

**Audit coverage:** UI-09, UI-13  
**Files**
- `ui/src/day.tsx`
- `ui/src/styles.css`

Delete:
- separate `Carried over` section;
- carry-over section border;
- `dayAttention().carried_over` rendering;
- carry-over-only presentation branching.

Use:

```ts
const active = outstandingForDate(tasks, selectedDate);
```

Render one active container:

```text
Attention        [N tasks]

[task card]
[task card]
[task card]
```

The current date has already been normalized by the service rollover lifecycle.

The selected-date `DateDropZone` wraps the list so normal explicit drag/reschedule continues to work.

Do not create a second view-only ordering authority.

---

## UX-014 — Remove obsolete carry-over-only UI semantics

**Audit coverage:** UI-10, UI-11  
**Files**
- `ui/src/day.tsx`
- `ui/src/task-row.tsx`
- `ui/src/styles.css`

Remove:
- `carriedOverFrom` TaskRow prop if it has no other purpose;
- `.jig-carry-over-section`;
- `.jig-task-carried-over`;
- `From <date>`;
- `Carried over · <date>`;
- reminder-origin-date formatting.

After automatic rollover, the card is visually a normal card in its new date bucket.

The reminder shows its normal current scheduled time.

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
- always display `Scheduled <weekday short> <day>` from the Task's canonical `scheduled_date` at completion;
- do not imply that this is a pre-rollover/original date.

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
- Browser notifications row:
  - unsupported → `Not supported by this browser`;
  - default → `Not enabled` + `Enable`;
  - granted → `Enabled`;
  - denied → `Blocked in browser settings`.
- `Enable` must invoke `Notification.requestPermission()` only from the click handler.
- do not persist a second Jig notification-preference boolean.

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

## UX-020 — Render the governed narrow hierarchy through AppShell mobile navigation

**Audit coverage:** UI-27, UI-31  
**Files**
- `ui/src/app.tsx`
- `ui/src/day.tsx`
- `ui/src/week.tsx`
- `ui/src/styles.css`
- `docs/design/ui-solution.md`

At <48rem, do **not** render desktop shell/surface chrome and then hide pieces with CSS.

Use the one AppShell `mobileNav` state from UX-007. The governed 414×900 Day hierarchy is:

```text
[Jig identity]                         [status]
[Day destination trigger]              [Today]
[Mon][Tue][Wed][Thu][Fri][Sat][Sun]
Thursday, 19 November
Your ordered plan
Attention
...
                                      [+]
```

Requirements:
- the Day destination trigger is an Astryx public control that opens the AppShell-managed mobile navigation; it is not a raw `<details>`;
- AppShell/SideNav owns the actual destination list and drawer behavior;
- all four destinations remain reachable;
- Today is a shortcut on the same compact surface-navigation row as the destination trigger, matching the governed reference hierarchy;
- do not add a separate Previous/Today/Next desktop toolbar row on narrow Day;
- narrow Day does not mount the desktop heading, desktop toolbar or desktop inspector;
- desktop Day does not mount narrow-only chrome/Quick Add;
- the same selected date/Task/editor draft state survives the mode switch.

Week may reuse the same narrow application header/navigation owner while retaining its one-date narrow planning semantics.

CSS may size/reflow the already-correct narrow composition. It must not be responsible for converting desktop DOM into this hierarchy.

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

Responsive editor presentation:
- keep one Task draft/form state and the same ordered Astryx fields across modes;
- desktop uses the bounded Dialog treatment;
- narrow uses a supported public Astryx Dialog configuration/variant/width/max-height behavior that naturally matches the governed mobile editor composition;
- do **not** resize/reposition private Dialog descendants with Jig CSS and do not mount a desktop presentation merely to hide/override it into mobile;
- Save/Cancel remain visible/reachable;
- Delete remains visually separated from primary Save.

If the pinned public Dialog API is proven unable to realize the governed narrow composition, document the precise incompatibility before introducing the smallest Jig-owned host around the same Astryx field primitives.

---

# 11A. Wave 8A — browser reminder notifications

## UX-024A — Add browser Notification delivery for due reminders

**Files**
- `ui/src/reminder.tsx`
- `ui/src/settings.tsx`
- `ui/src/app.tsx` only if permission/status plumbing is needed
- `tests/browser/interactions.spec.ts` or a focused new `tests/browser/reminders.spec.ts`
- `docs/design/ui-solution.md` Settings/reminder copy if needed for exact wording

### 24A.1 Preserve one reminder eligibility calculation

Keep the existing eligibility rules:
- Task is outstanding;
- `scheduled_date === today`;
- `reminder_time !== null`;
- due time is after the current app-session start;
- due time is <= now;
- delivery key has not already been delivered.

Do not create separate toast and notification schedulers.

### 24A.2 Split delivery by document visibility

Refactor `ReminderMonitor` so one eligible reminder chooses exactly one presentation channel:

```text
document visible
  → Astryx toast

document hidden + Notification supported + permission granted
  → browser Notification

document hidden + permission default/denied/unsupported
  → do not mark delivered;
     allow focus/visibility catch-up toast when the page becomes visible
```

This avoids duplicate toast + browser notification delivery for the same reminder.

### 24A.3 Browser Notification payload

For granted permission, construct:

```ts
new Notification("Jig reminder", {
  body: task.title,
  tag: reminderKey(task),
})
```

No Task note/reference/private metadata is placed in the system notification body.

If notification construction throws, do **not** mark the delivery key; visible/focus catch-up remains possible.

### 24A.4 Delivery suppression

The same `reminderKey(task)` is authoritative for both channels:

```text
jig-reminder-delivered:|task-id|scheduled-date|HH:mm
```

Rules:
- mark delivered only after toast dispatch or browser Notification construction succeeds;
- never mark merely because a due reminder was detected;
- use the same key as Notification `tag`;
- completion makes a reminder ineligible;
- editing date/time naturally creates a different key;
- daily rollover changes `scheduled_date`, therefore creates a new key for the rolled-forward date;
- pruning may remove keys for dates earlier than today.

Do not add server-side reminder delivery state.

### 24A.5 Explicit permission UX in Settings

Add a small `Browser notifications` row in Settings.

States:
- unsupported → `Not supported by this browser`; no action;
- `default` → `Not enabled` + `Enable` button;
- `granted` → `Enabled`;
- `denied` → `Blocked in browser settings`; no repeated permission prompt.

The `Enable` button directly calls:

```ts
await Notification.requestPermission()
```

from the click handler.

Do not request permission:
- at application startup;
- when a reminder is created;
- from a timer;
- from a visibility/focus handler.

Permission preference is browser-owned; do not persist another Jig boolean.

### 24A.6 Rollover interaction

Regression behavior:

```text
Task scheduled yesterday
reminder_time = 10:00
daily rollover → scheduled_date becomes today
reminder_time remains 10:00
today 10:00 eligibility → browser/toast reminder fires using today's key
```

Do not display or notify using yesterday's date after rollover.

### 24A.7 Browser tests

Add deterministic browser tests with the Notification API stubbed before page load.

Required:

#### R01 — visible-page toast
- create due-today reminder;
- page visible;
- assert Astryx reminder toast;
- assert browser Notification constructor not called.

#### R02 — hidden-page browser notification
- permission = `granted`;
- simulate hidden document / invoke the monitor through the test-visible path;
- assert one Notification:
  - title `Jig reminder`;
  - body Task title;
  - tag equals reminder delivery key;
- assert no duplicate toast for same key.

#### R03 — denied/default permission catch-up
- permission `default` or `denied`;
- reminder becomes due while hidden;
- assert delivery key is not marked;
- simulate visible/focus;
- assert in-app toast appears once.

#### R04 — explicit permission request
- Settings shows `Enable` only for `default`;
- clicking it calls `Notification.requestPermission()`;
- startup does not call it;
- denied state does not repeatedly prompt.

#### R05 — rollover + reminder
- create yesterday Task with reminder time still upcoming today;
- trigger/observe rollover;
- assert API `scheduled_date === today`;
- assert reminder key uses today's date;
- assert due reminder is delivered on today's schedule.

#### R06 — completed Task
- complete before due time;
- assert neither toast nor browser notification fires.

### 24A.8 Acceptance

The reminder feature is complete only when:
- visible Jig produces the existing toast;
- hidden/open Jig with granted permission produces a browser-level notification;
- denied/unsupported permission does not break reminder catch-up;
- no duplicate delivery occurs;
- rollover naturally retargets the reminder to the new scheduled date;
- no service worker/background daemon is introduced.

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

As part of this cleanup, remove architecture-debt CSS rather than layering over it:
- delete `@layer jig`/application override-layer machinery used to outrank the library;
- delete rules for the removed custom shell/sidebar/mobile disclosure;
- delete private Astryx custom-property use (including `--_*`) and descendant selectors that depend on Astryx internals;
- delete duplicate/counteracting declarations whose only purpose is to cancel earlier layout rules;
- replace interior pixel tuning with Astryx spacing/radius/type/component props unless the value is one of the governed structural budgets in §2.4;
- retain CSS breakpoint rules only for pure reflow/density inside the already-correct React composition.

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
- Astryx SideNav is visible through the AppShell sideNav slot;
- Week/Day/History/Settings are reachable from that SideNav;
- exactly one `main` landmark exists;
- legacy/custom `.jig-topbar`, `.jig-shell` and `.jig-sidebar` parallel shell structures are absent;
- main canvas visible at the governed geometry.

### C02 — Day is initial destination
Fresh state.
Assert Day current and today's date.

### C03 — persisted daily rollover
Persist yesterday Task.
Fresh service/UI load.
Assert Task is visible in today's Day bucket, API `scheduled_date === today`, Week shows it in today's column, and yesterday's column no longer contains it.

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

### C06 — unified Day Attention after rollover
Create yesterday + today Tasks, trigger rollover, then assert:
- one `Attention` heading;
- no `Carried over` section heading;
- both Tasks belong to today's canonical sequence;
- rolled-forward Task precedes the previously-today Task.

### C07 — reminder follows rolled-forward date
Yesterday Task with reminder.
Trigger rollover and assert API date becomes today, reminder time is unchanged, and UI shows the reminder as today's scheduled reminder with no obsolete yesterday label.

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
- desktop SideNav is not inline;
- one compact governed narrow header composition;
- Day destination trigger opens AppShell-managed mobile navigation;
- no raw `<details>` destination menu exists;
- Day/Today share the governed compact surface-navigation row;
- desktop Day heading/toolbar/inspector are not mounted;
- all four destinations remain reachable through the AppShell/SideNav mobile path.

### C12 — narrow date strip
390px width.
Assert strip does not scroll horizontally and shows all 7 dates.

### C13 — mobile Quick Add
Assert persistent + Add button visible and last task remains unobscured.

### C14 — theme parity
Run representative Day/Week assertions under Light and Dark.

### C15 — library/CSS ownership guard
Add a small source-level architecture test without a new lint dependency. It must fail if Jig-authored UI CSS/source reintroduces:
- `@layer jig` as an application override layer;
- `!important`;
- private custom properties matching `--_*`;
- selectors targeting Astryx internal/generated classes;
- deep/private Astryx package paths such as `/src`, `/dist` or `/internal`;
- hand-authored Astryx compiler/runtime markers such as `__built` or local `generateThemeCSS` compilation;
- unknown Astryx global token names;
- stale `jig.js` / `jig.css` outputs relative to `jig-theme.source.ts`;
- the removed `.jig-shell`, `.jig-sidebar` or raw `.jig-mobile-destination-menu` parallel navigation implementation.

Astryx-generated `jig.js` / `jig.css` are compiler-owned and may legitimately contain Astryx internal implementation data; the guard applies the private-API prohibition to Jig-authored source and separately verifies the generated artifact header/drift contract.

The guard does not replace visual tests; it protects the implementation boundary that visual tests cannot detect.

---

# 15. Wave 12 — screenshot evidence

## UX-030 — Capture new 1.0.2 evidence set

**New directory**
- `docs/evidence/v1.0.2/browser/`

Capture exactly:
- `desktop-week-light.jpg`
- `desktop-week-dark.jpg`
- `desktop-day-rollover.jpg`
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
- canonical reminder metadata after rollover;
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
- retain stale overdue cards in prior Week buckets after rollover.

## `ui/src/day.tsx`

Must:
- one canonical selected-date Attention sequence;
- no derived carry-over section;
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
- remove legacy topbar and the current duplicate custom shell/sidebar/mobile-navigation rules;
- contain only Jig-owned product geometry/composition;
- fix Week grid through governed structural budgets;
- style compact Task card/menu only through Jig-owned roots and public Astryx APIs/tokens;
- add Day inspector/Settings product grids without reaching into Astryx internals;
- reduce heavy section cards;
- preserve semantic tokens;
- contain no Jig override cascade layer, `!important`, private Astryx variables/selectors or compensating desktop-to-mobile hiding rules.

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

### Cross-cutting functional traceability

| Functional requirement | Implementation task |
|---|---|
| JIG-FR-09 persisted daily rollover | UX-006 |
| JIG-FR-09 HTTP revision safety after rollover | UX-006 §6.11 |
| JIG-FR-09 open-browser day-boundary revalidation | UX-006 §6.12 |
| JIG-FR-10 visible reminder toast | UX-024A |
| JIG-FR-10 hidden/open browser Notification | UX-024A |
| JIG-FR-10 explicit permission/settings state | UX-003, UX-019, UX-024A |
| JIG-FR-10 rollover-reminder interaction | UX-006, UX-024A |

No audit finding or cross-cutting functional requirement is allowed to remain without a task or an explicit preserve/no-change disposition.

---

# 18. Execution order and merge gates

Execute in this order:

1. UX-001…005 — canonical docs/references.
2. UX-006 — persisted daily rollover + Day default + cross-view regression.
3. UX-007…008 — shell/status.
4. UX-009 — Task row/action model.
5. UX-010…012 — Week.
6. UX-013…017 — Day/inspector.
7. UX-018 — History.
8. UX-019 — Settings.
9. UX-020…023 — narrow/mobile.
10. UX-024 — editor.
11. UX-024A — browser reminder notifications + permission UX.
12. UX-025…027 — visual/feedback cleanup.
13. UX-028…029 — regression + conformance tests.
14. UX-030 — evidence set.

### Gate A — after UX-006
Persisted rollover core/persistence/browser tests green, including:
- Week bucket movement;
- strict rollover-before-revision admission;
- open-browser midnight canonical refresh;
- explicit selected-date preservation;
- ReminderMonitor receiving refreshed rolled-forward Tasks.

### Gate B — after UX-012
Desktop shell + Week conformance tests green at 1440×900.

### Gate C — after UX-017
Day Attention + inspector + post-rollover semantics green.

### Gate D — after UX-024A
History, Settings, narrow shell, editor, browser notification permission states and reminder channel tests green.

### Gate E — release candidate
All existing tests + `ui-conformance.spec.ts` + screenshot evidence review green.

Do not defer structural failures to polish.

---

# 19. Release acceptance checklist

1. Fresh open lands on Today / Day.
2. Yesterday unfinished work is automatically moved into today's canonical bucket.
3. API `scheduled_date` is physically changed to today; Week and Day show the same moved card in today's bucket.
4. Desktop has left rail; no replacement top bar.
5. Week shows all seven columns at 1440×900.
6. Week columns show count + bottom Add.
7. Row shows compact drag + overflow only.
8. Day has one Attention sequence.
9. No derived carry-over section/label remains after rollover.
10. Reminder time is preserved and applies to the rolled-forward scheduled date.
11. Desktop Day inspector exists.
12. History shows canonical scheduled date at completion + completion time.
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
24. Browser notification permission is requested only by explicit user action.
25. Due reminders use in-app toast while visible and browser Notification while hidden/open with granted permission.
26. One delivery key prevents duplicate toast/notification delivery.
27. Rolled-forward reminders fire against the new scheduled date while preserving reminder time.
28. An already-open browser refreshes canonical state across local midnight without manual reload.
29. A Task mutation with a pre-rollover revision is rejected with 409 before the requested mutation is executed.
30. Settings exposes browser notification support/permission state without auto-prompting.
31. No Task schema, persistence-ownership, or Git architecture change is introduced beyond the explicitly planned persisted daily-rollover mutation.

---

# 20. Definition of done

The 1.0.2 UX/UI remediation is done only when the code, corrected design authority, browser assertions and screenshot evidence all agree.

Passing functional tests alone is insufficient.

Passing screenshots alone is insufficient.

The release requires all three:
- **behavioral correctness**, including persisted daily rollover across Week and Day;
- **structural conformance**, including shell, density, row actions, Day inspector, History semantics and narrow composition;
- **implementation-architecture conformance**, meaning Astryx owns its documented shell/navigation/component mechanics and Jig CSS does not override private library anatomy.

A screenshot that matches while violating §2.4 is a failed implementation. A green browser suite that does not enforce §2.4 is insufficient evidence.

The implementation team should not make additional UX design choices while executing this plan. If a required Astryx public primitive is unavailable or demonstrably incompatible, record the exact public-API limitation and use the smallest local semantic composition needed for the governed behavior. Do not change the target interaction, reach into Astryx internals, stack CSS overrides, or add a new dependency without a separate architectural decision.
