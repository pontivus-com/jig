# Jig — planning and UX functional design

**Status:** Binding v1.0.5 functional design v0.14, amended 2026-11-17 after complete post-release review of published v1.0.4 desktop and narrow/mobile interaction paths. v1.0.5 corrects drag ownership/stability, mobile drag, responsive renderer parity, application-navigation parity, Task-menu parity, semantic icon completeness, header density, Task-card legibility and header-brand correctness. Canonical Task, persistence, rollover, reminder, repository ownership, installer and synchronization semantics are unchanged.
**Concern:** Observable planning semantics, task interactions, calendar views, feedback and responsive behavior.  
**Governing intent:** [Jig product definition](../product/product-definition.md).

## 1. Primary interaction

Jig has **one primary Planner surface**. There are no separate Day and Week destinations.

On wide/desktop layouts, Planner presents the current planning week as seven dated columns containing the canonical ordered outstanding Tasks for those dates. The board consumes the available planning canvas rather than preserving an artificial maximum width.

On narrow/mobile layouts, the same Planner reflows to seven vertically stacked dated Task sections for the displayed week. This is a responsive presentation of the same weekly Planner state, not a separate Day view, route, destination or data projection.

The primary planning interaction is master-detail:

- clicking/tapping a Task **selects it and opens the unified editable Task workspace**; selection never moves the Task and never changes application destination;
- direct visual movement/reordering is performed by dragging anywhere on the Task card surface on desktop and narrow/mobile except genuine interactive descendants; checkbox/menu/reference/form controls never initiate drag;
- explicit non-drag rescheduling is performed by editing the Task's scheduled date;
- existing Task selection and Add Task use the same editable field surface; there is no separate read-only inspection step and no second Edit click;
- clicking outside both a Task card and the contextual workspace dismisses the workspace without saving; clicking another Task retargets the workspace to that Task;
- permanent Delete confirmation is the only blocking Task modal.

Jig supports evening planning of the next day, morning planning, and unrestricted changes during work. It is not an appointment scheduler and it does not require an hour estimate.

## 2. Canonical user-level concepts

**Task:** one lightweight scheduled intention with a stable identity. Required user inputs are `title` and `scheduled date`; other user-entered details are optional. A task has a persisted position within its scheduled day and a planned/done condition. The implementation derives display groups from these facts; view-specific copies are not authoritative.

**Date:** the intended local calendar date of work, independent of creation and completion timestamps. Every MVP task has one scheduled date. Planner does not maintain a selected-day presentation state.

**Order:** a deliberate relative position among outstanding tasks on the same date. Order is neither a priority ranking nor a reminder time.

**Priority:** High, Normal (the default), or Low. Its job is initial insertion guidance and visual emphasis; it is not a continuously enforced sort.

**Project/context:** optional short label for filtering and recognition. No project lifecycle or project schema is copied into Jig.

**Reference:** optional external URL or filesystem/repository locator. It may be opened or copied when usable on the active device; it is not dereferenced to create a shadow copy of that project's details.

**Note:** optional short reminder/context text, not a requirement or implementation document.

**Reminder:** optional local date/time notification tied to the scheduled item. It represents an alert time, **not** task start time or estimated duration.

**Completion:** explicit transition to done with a completion timestamp. Completion is distinct from scheduled date. Reopening makes the same task outstanding again.

**Rollover:** persisted daily movement of an outstanding task whose scheduled date is earlier than the current local civil date. Rollover changes the task's `scheduled_date` to the current local civil date and places the card into that day's persisted outstanding order. It is not a separate status flag.

**Deletion:** confirmed permanent removal of a Task from Jig. Deletion creates no soft-delete state, trash record, tombstone, or application-level undo history. If an earlier exported version exists, repository Git history is the recovery mechanism.

## 3. v1.0.3 binding interaction requirements

The following requirements are binding for v1.0.3 and supersede any earlier Day/Week navigation or task-modal wording in older design references.

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-103-FR-01 | One Planner destination | Jig exposes one planning destination. Desktop shows the seven-date weekly board; narrow/mobile shows the same seven dated sequences stacked vertically. There is no separately navigable Day view and no selected-day subview. |
| JIG-103-FR-02 | Planner is the default/home surface | Jig opens on Planner with the week containing the current local date displayed. The Jig product mark/home affordance returns from secondary destinations to Planner. v1.0.4 also exposes Planner explicitly in the desktop top navigation under JIG-104-FR-16. Returning home preserves the displayed week for that session; startup initializes to the current week. |
| JIG-103-FR-03 | No persistent desktop sidebar | The former left navigation rail is removed. Desktop secondary navigation is folded into the top region and exposes only History and Settings, with appropriate semantic iconography. |
| JIG-103-FR-04 | Proper mobile hamburger navigation | Mobile uses a top hamburger/menu-button pattern for secondary navigation. Opening it presents History and Settings as a compact menu/popover; it must not open a side-navigation drawer or recreate the former desktop sidebar. |
| JIG-103-FR-05 | Task click/tap opens contextual Task work; it never moves | Clicking/tapping any Task row/card selects that canonical Task and opens the contextual Task workspace in place. The current Planner/History destination remains active. Card selection never changes scheduled date, order or destination. v1.0.4 makes that workspace directly editable rather than read-only. |
| JIG-103-FR-06 | Desktop Task workspace enters from the right | On desktop Planner and History, Task create/edit uses one non-blocking contextual workspace entering from the right. Existing Tasks open directly as editable drafts under JIG-104-FR-07. It overlays secondary content rather than navigating away or opening a centered modal. |
| JIG-103-FR-07 | Mobile Task workspace rises from the bottom | On narrow/mobile layouts, Task create/edit uses one non-blocking bottom sheet rising from the bottom. Selecting an existing Task opens its editable draft directly; Add uses the same sheet and field surface. |
| JIG-103-FR-08 | No Task create/edit modal | Add Task and existing-Task editing must not use centered/fullscreen modal dialogs. Permanent destructive Delete confirmation remains the sole blocking Task dialog. |
| JIG-103-FR-09 | Quick Add is actually quick | **Superseded by JIG-104-FR-07/08.** Add remains low-friction by inheriting date/defaults, but v1.0.4 uses the same full editable Task form for create and existing Tasks. |
| JIG-103-FR-10 | Week board uses available desktop width | The desktop Planner board fills the available main canvas with seven equal fluid date columns and no artificial content max-width. Columns expand on wider screens so ordinary Task titles do not wrap unnecessarily. A 160px per-column minimum remains the lower desktop usability budget. |
| JIG-103-FR-11 | Drag owns direct visual movement | On desktop, drag-and-drop is the direct interaction for same-date reordering and cross-date movement. Dragging places the Task at the exact drop position. Clicking/tapping a card is never overloaded to move or switch it. |
| JIG-103-FR-12 | Edit owns explicit non-drag rescheduling | Cross-date rescheduling without drag is performed through the scheduled-date field in Edit. There is no separate Move-to-date workspace/modal. Same-day keyboard-accessible Move up/Move down remains available where needed. |
| JIG-103-FR-13 | History participates in the same contextual workspace model | Selecting a completed Task in History opens that Task's editable draft in the same contextual workspace model: right-side workspace on desktop, bottom sheet on mobile. History remains the current destination. |
| JIG-103-FR-14 | Responsive reflow preserves state | Crossing the responsive breakpoint while a Task workspace is open preserves the existing/create workspace state and unsaved draft values. Responsive composition must not create duplicate Task state or mutate canonical Task data. |
| JIG-103-FR-15 | Completion leaves the Planner and remains inspectable | Completing a Task removes it from the outstanding Planner sequence and records its completion timestamp. Completed Tasks remain inspectable/reopenable from History; the removed standalone Day completed section is not required. |
| JIG-103-FR-16 | Navigation is intentionally minimal | **Superseded for desktop by JIG-104-FR-16.** History and Settings remain the only non-Planner destinations. Narrow/mobile may continue to expose History and Settings through the compact menu, while Planner is the default/home surface. |
| JIG-103-FR-17 | Centered week navigation is the Planner temporal model | The active week date range is visually centered in the Planner header. Directly beneath that range, one grouped control row contains Previous week, Today and Next week. Previous/Next move the displayed week by exactly seven days. Today displays the week containing the current local date. The range label itself is informational, not an interactive separator between the three controls. There is no selected-day state. |

### v1.0.4 interaction-correction requirements

The following requirements supersede the affected v1.0.3 interaction wording while preserving the single-Planner information architecture and canonical Task semantics.

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-104-FR-01 | Card-body drag must work | On desktop, dragging from the non-interactive body/title/meta region of an outstanding Task card starts the canonical dnd-kit drag interaction. Same-date and cross-date drops persist the exact chosen position. Completion checkbox, Task action menu and reference controls never initiate dragging. A tiny dedicated handle is not required for the primary pointer interaction. |
| JIG-104-FR-02 | Current day is an exact date, not a weekday recurrence | The current-day treatment applies only when a visible Planner date equals the browser's current local civil date. Navigating to another week must not highlight that week's date merely because it has the same weekday as today. |
| JIG-104-FR-03 | Visual states have separate semantics | Current day, selected Task, Task priority and drag/drop target use deliberately distinct visual treatments. Exact current day uses the governed subtle teal date/header/border treatment. There is no Planner-day selection treatment because Planner has no selected-day state. Selected Task uses the governed subtle info-blue selection surface/border. Priority remains a leading cue with High=error/red, Normal=quiet neutral and Low=calm/success-green semantics. Drag target uses transient Amber/accent treatment. No single brand or semantic color is reused as the dominant treatment for unrelated states. |
| JIG-104-FR-04 | Workspace dismisses on outside interaction | With a Task workspace open, clicking/tapping Planner or History content outside a Task card and outside the workspace closes it without saving. Selecting another Task replaces the open workspace target with that Task. Explicit close and Escape continue to close it. |
| JIG-104-FR-05 | Application header geometry is stable | The top application header has the same outer pixel height for Planner, History and Settings at a given responsive layout. Switching destination must not move the content vertically because Planner has two temporal rows and the secondary destinations have only a title. |
| JIG-104-FR-06 | Task action menu contains the relevant direct actions | An outstanding Task card menu exposes Edit/Open, Complete, priority selection (High/Normal/Low), applicable Move up/Move down actions and Delete. History exposes the corresponding Reopen, priority selection, Edit/Open and Delete actions. Priority changes reuse canonical Task edit semantics and never reorder established manual order. |
| JIG-104-FR-07 | One editable Task workspace | There is no separate read-only view mode. Clicking an existing Task opens the canonical Task form directly with Title, Date, Context, Priority, Reminder, Reference and Notes visible and editable. Add Task opens the same field surface with its derived or explicit originating date and canonical defaults already populated. Title and scheduled date are required by the Task contract; optional fields remain optional. |
| JIG-104-FR-08 | Add is not a reduced secondary form | Add Task must not hide optional fields behind a later Edit step. The same workspace component and field hierarchy are used for new and existing Tasks. The inherited date/defaults keep creation low-friction without creating a separate Quick Add interaction model. |
| JIG-104-FR-09 | Unified workspace retains responsive continuity | Desktop Drawer and narrow/mobile BottomSheet render the same editable Task draft state. Responsive reflow preserves the current draft. Save persists through the existing create/edit commands; Cancel/outside dismissal closes without persistence. |
| JIG-104-FR-10 | Local-only durability is visually healthy | When Jig reports `Local only`, the status control keeps that explicit label but uses a restrained success/green status cue because local persistence is healthy. `Synced` remains the distinct repository-synchronized state. Neutral grey is reserved for unknown/unresolved status; pending/retrying remain warning and sync issue remains error. |
| JIG-104-FR-11 | Per-day Add lives in the date header | Each dated Planner section exposes one compact icon-only Add control immediately beside the full weekday/date label. Activating it opens the unified create draft for that explicit date; it does not select the date first. The old full-width `Add task` control at the bottom of each lane is removed. The global header Add task remains the convenient week-context shortcut. |
| JIG-104-FR-12 | Desktop lanes are content-driven | Desktop date lanes may grow or shrink vertically with their Task content; Jig does not reserve artificial lane height merely to pin an Add action to the bottom. Empty lanes retain only the minimum usable drop-target area required for drag-and-drop. All seven tracks remain equal in width; vertical height need not be equal. |
| JIG-104-FR-13 | Planner has no selected-day state | Date labels are not selectors and clicking a date does not create Planner state. Desktop shows all seven dates simultaneously; narrow/mobile shows the same seven dates as stacked day sections. The only persistent temporal Planner state is the displayed week. |
| JIG-104-FR-14 | Global Add derives a date without selection | Global Add task opens the unified full Task form with a derived default date inside the displayed week: the date whose weekday matches the current local weekday. In the current week this is today; in another displayed week it is the corresponding weekday in that week. The Date field is immediately editable before Save. Per-date `+` always uses its explicit date. |
| JIG-104-FR-15 | Weekday labels are written in full | Planner date headers use the full English weekday names `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`; do not abbreviate them to Mon/Tue/Wed/etc. The header remains a non-selectable date signifier plus its compact `+` action. |
| JIG-104-FR-16 | Planner uses reduced chrome and explicit top navigation | Desktop keeps the existing three-zone application-header placement and centered temporal controls, but the right-side navigation explicitly contains `Planner`, `History` and `Settings` together, with Planner visibly active on the planning surface. The weekly board is visually lightweight: no boxed lane containers, no thick lane borders, no decorative panel framing, and no redundant separators. Structure is conveyed primarily by whitespace, typography, subtle hairline separators where needed, semantic state color and iconography. Task cards remain discrete interactive units but use restrained borders/shadows rather than heavy chrome. Icons may communicate Task metadata/status/action meaning when accompanied by accessible labels/tooltips or text where needed. |


### v1.0.5 post-release corrective requirements

The JIG-105 requirements below supersede earlier version-specific wording in JIG-103/JIG-104 wherever those older rows describe desktop-only drag, body/title-only drag activation, the earlier navigation composition, or the earlier two-line header/temporal geometry. Those older rows remain release-history provenance and must not override the current v1.0.5 requirements.

Published v1.0.4 did not satisfy several binding interaction/presentation outcomes in direct product use. v1.0.5 is the corrective patch. Each requirement below is intentionally atomic so technical design and implementation can map one-to-one without hiding responsive or menu behavior inside a generic UI task.

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-105-FR-01 | Drag is crash-free and React/canonical order remains coherent | Desktop same-date and cross-date whole-card drag never raises a browser/React DOM exception, including `NotFoundError: removeChild`. The sortable Task card itself is the pointer source; genuine interactive descendants remain excluded. The visible list remains coherent before, during and after drop; persistence/reload shows exactly the chosen date/index; cancel/failure leaves order unchanged. |
| JIG-105-FR-02 | Narrow/mobile direct drag is a first-class interaction | Narrow/mobile supports touch/pen/mouse drag from the same whole Task-card surface used on desktop, excluding genuine interactive descendants. Same-date reorder, cross-date move and empty-date drop use the same canonical exact-position move semantics. Checkbox, menu, references and other interactive controls do not start drag. A successful drag/drop does not also execute Task selection or open/retarget the Task workspace on release. Move up/down remains an accessibility/non-drag alternative, not a replacement for missing mobile drag. |
| JIG-105-FR-03 | Planner responsive rendering is one semantic UI, not a stale mobile implementation | Desktop and narrow/mobile show the same seven dated sections, Task-card anatomy, state semantics, metadata/actions and drop capabilities; only geometry/reflow/touch density change at the breakpoint. A breakpoint change must not switch to a different Task renderer, different surface system, obsolete chrome or a reduced interaction model. |
| JIG-105-FR-04 | Application navigation/menu destinations are identical across responsive layouts | Planner, History and Settings are the one navigation destination set. Desktop exposes that set in the right-side navigation group; narrow/mobile exposes the same three destinations in the compact hamburger menu with the same labels, semantic icons and active-destination meaning. No responsive layout may silently omit Planner or own a second destination list. |
| JIG-105-FR-05 | Task action menus have state-based parity, never layout-based parity | For the same Task state, desktop and narrow/mobile expose the same Task actions. Outstanding Tasks expose Open/edit, Complete, priority High/Normal/Low, applicable Move up/down and Delete. Completed Tasks expose Open/edit, Reopen, priority High/Normal/Low and Delete. Differences are derived only from canonical Task state/sequence position, never from viewport/layout. |
| JIG-105-FR-06 | Semantic iconography is complete and normalized | Visible application actions/status/metadata use the pinned Astryx semantic icon system consistently: temporal chevrons, Add, Planner/History/Settings, hamburger, Task overflow, reminder, reference/copy, completion, movement and repository status. Raw Unicode stand-ins are not used where Astryx exposes the meaning. Missing Jig-specific meanings use Astryx's documented namespaced extension-icon mechanism, not a second icon library. Accessible labels/text remain authoritative. |
| JIG-105-FR-07 | Application header is compact, flat and destination-invariant | The header has one outer height per responsive layout and no destination jump, while materially reducing the shipped v1.0.4 vertical budget. On desktop it is not a separate gray/surface panel: it inherits the application background, uses one bottom hairline as its only persistent chrome, and places the existing Home, temporal, Add, Planner/History/Settings and sync controls directly on that bar. The previous two-line temporal center is superseded: Previous, compact week range, Next and Today render as one inline temporal group so the complete control set fits the governed height without clipping or offsets. Narrow/mobile likewise uses one compact header row with the same temporal semantics, icon-first actions and hamburger navigation. Desktop target is approximately half the shipped v1.0.4 5.5rem minimum: about 44 CSS px, with a hard maximum of 2.75rem. Narrow/mobile target is approximately half the shipped 7rem minimum: about 56 CSS px, with a hard maximum of 3.5rem, while preserving touch-operable controls and the intended hierarchy. |
| JIG-105-FR-08 | Task cards are clearly legible against the Planner canvas in every mode | Before hover/selection, Task cards are immediately distinguishable from their surrounding Planner canvas in Light/Dark and desktop/narrow. Light uses a clear white/elevated card over Paper canvas; Dark uses a materially lighter Ink card surface over Ink 950 canvas. Narrow/mobile must not set the enclosing canvas/frame and Task card to the same surface. |
| JIG-105-FR-09 | Header brand uses the canonical Jig wordmark treatment | Application chrome renders the complete canonical Jig wordmark at compact scale. It does not compose the standalone J symbol beside a second live “Jig” word. Light/Dark assets switch through the existing theme presentation without creating a separate mobile brand treatment. |
| JIG-105-FR-10 | Release acceptance proves responsive semantic parity, not only component presence | A v1.0.5 candidate is not acceptable until real-browser verification covers desktop and narrow/mobile drag with zero runtime/page errors, opens and compares responsive navigation menus, verifies Task-action parity, checks icon presence/absence of Unicode stand-ins, enforces header geometry, verifies card/canvas computed-style separation in Light/Dark, verifies zero application-level viewport inset and the 73rem responsive boundary, and reviews desktop+narrow visual evidence. |
| JIG-105-FR-11 | Application layout is full-bleed with zero viewport margins | Desktop and narrow/mobile use the full browser viewport from edge to edge. There is no application-shell or page-level margin/padding on the left, right, top or bottom, no outer framed content panel, and no artificial max-width/inset around Planner, History or Settings. Header and main content begin at the viewport edges. Local spacing inside headers, date sections, cards, forms and controls remains allowed because it is component spacing, not screen-edge margin. |


## 4. Functional requirements

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-FR-01 | Create a task quickly | A title entered from a Planner date context/column creates a task on that date without requiring priority, estimate, context, or link. |
| JIG-FR-02 | Navigate planning weeks | Previous/Next move the Planner by one calendar week; Today returns to the week containing the current local date. Date labels themselves are not navigation controls. None of these navigation actions alter Task data. |
| JIG-FR-03 | Order within a day | Drag an outstanding task to any position within its scheduled date. The new order persists across view changes and restart. |
| JIG-FR-04 | Move between dates | Drag into another visible date/position on desktop or narrow/mobile, or explicitly edit the Task's scheduled date when a non-drag reschedule is needed. The item is moved, not copied. |
| JIG-FR-05 | Priority-assisted insertion | On quick-add/new scheduling, priority suggests an insertion point without rearranging existing tasks. A previously manually mixed list is not silently sorted into priority groups. |
| JIG-FR-06 | Preserve manual intent | Changing a task's priority after creation changes its indicator only. It does not reorder an existing day. Manual drag order remains authoritative. |
| JIG-FR-07 | Flexible modifications | Title, date, priority, context, reference, note and reminder can be edited in the contextual Task workspace without an approval/workflow gate or a separate modal editor. |
| JIG-FR-08 | Complete and reopen | Completion removes the task from the outstanding Planner sequence, records when it completed, and makes it visible in History. Reopen restores the same task identity and schedule. |
| JIG-FR-09 | Roll unfinished work into the current day | When Jig observes that the local civil date has advanced, every outstanding Task whose `scheduled_date` is earlier than the current local civil date is persistently moved into the current day's bucket by changing its `scheduled_date`. The same moved card must therefore appear in the current-day bucket in Planner and every other Task surface. Completed Tasks are never rolled forward. |
| JIG-FR-10 | Reminder delivery while Jig is open | While Jig is open, a due Task reminder displays an unobtrusive in-app toast when the page is visible. When the page is open but not visible and browser notification permission has been explicitly granted, Jig delivers the reminder through the browser Notification API. Permission is requested only from an explicit user action. There is no service-worker/background notification contract when Jig is closed. |
| JIG-FR-11 | Access original context | Open/copy a provided reference without duplicating project execution or source content into Jig. |
| JIG-FR-12 | Report honest outcomes | On persistence failure, the UI does not claim that the change was saved; the operator can understand and recover from the failure. |
| JIG-FR-13 | Preserve common meaning across devices | Desktop and narrow/mobile use the same Planner, Tasks, dates, priority semantics, completion meaning and actions. Responsive change alone must not mutate or discard work. |
| JIG-FR-14 | Retain local data | App restart retains tasks, their date/order, reminders and completion history within the selected personal Git repository. |
| JIG-FR-15 | Single-command installation and configuration | A single installer configures Jig against either a user-selected existing local Git repository (`--repo`) or a repository URL plus new/empty checkout destination (`--repo-url` + `--checkout`). URL mode delegates acquisition to Git and then uses the same installation path. The installer also configures Jig's data directories, `jig` launcher, and Linux user service, with explicit failure if prerequisites are unmet. |
| JIG-FR-16 | Repository-contained planning data and Git-native continuity | The selected repository, not the public Jig source repository, contains Jig's operational SQLite database and portable Git-versioned task data. On installation, valid existing Jig data in that repository is adopted automatically. The repository may be supplied as an existing checkout or obtained by the installer's thin Git-clone handoff; moving/reorganizing repositories remains ordinary Git/filesystem tooling. Jig provides no separate repository-migration workflow. |
| JIG-FR-17 | Convenient desktop availability | After installation, `jig` opens the locally running UI or starts its service; an enabled Linux user service keeps Jig available without a foreground terminal. |
| JIG-FR-18 | Automatic save and Git synchronization | Each successful task edit is durable locally without a Save-to-Git action; Jig automatically serializes, commits and synchronizes its own portable data when a remote is configured, with bounded batching and retry. |
| JIG-FR-19 | Safe cohabitation and synchronization honesty | Jig must not stage, commit or rewrite unrelated repository content. Missing remote or repository synchronization failure never invalidates a successful local Task save. The UI reports only the operational synchronization outcome; Jig does not classify Git topology, merge histories or provide repository reconciliation. |
| JIG-FR-20 | Low-friction idle operation | The desktop service starts predictably, stays lightweight and idle-efficient, and offers immediate access to the Planner throughout the working day without requiring repeated initialization. |
| JIG-FR-21 | Delete a task | An outstanding or completed Task can be permanently removed after explicit destructive-action confirmation. On success it disappears from Planner and History. Jig provides no trash, soft delete or in-app restore; prior Git history is the only recovery when an exported version exists. |
| JIG-FR-22 | System, Light and Dark appearance | Jig supports System, Light and Dark appearance modes through one semantic theme owner. System follows the platform/browser color preference. Theme changes affect presentation only and never mutate Task data, displayed week, ordering, drafts, completion or synchronization state. |

### Initial placement rule

For newly scheduled items, insert **after the last existing outstanding item of equal or higher priority**, or at the beginning if there is none. This gives the expected High → Normal → Low default order when a day has not been manually mixed, while preserving every existing item’s relative position. An already manually mixed day is not forcibly sorted by priority. A task dropped at an explicit position is placed *exactly* where dropped, regardless of its priority. Editing a Task's scheduled date uses suggested insertion; dragging to a target position uses that precise position.

This keeps priority useful on capture without introducing a hidden automatic scheduler.

### Completion placement

Planner contains the canonical outstanding sequence only. Completing a Task removes it from Planner and records its completion timestamp. History groups completed Tasks by actual completion date and remains the canonical UI for inspecting/reopening completed work. Reopening places the same Task back into the outstanding Planner sequence on its scheduled date at the end of that date's current outstanding order; any later ordering adjustment is explicit.

### Daily rollover and ordering

Rollover is a persisted planning mutation, not a view-only projection.

When Jig starts, resumes, or otherwise detects that the local civil date is later than a Task's scheduled date, every outstanding overdue Task is moved to the current local civil date. This updates the canonical Task itself, so desktop and narrow/mobile Planner presentations, restart and synchronization all observe the same bucket.

Rollover ordering is deterministic:

1. overdue Tasks are collected oldest scheduled date first;
2. within each source date, preserve persisted position;
3. place that rolled-forward sequence at the beginning of the current day's outstanding sequence;
4. preserve the existing relative order of Tasks already scheduled for the current day after the rolled-forward sequence;
5. rewrite positions contiguously from zero.

If Jig was not running for multiple days, one catch-up mutation moves every still-outstanding Task with `scheduled_date < current_local_date` directly to `current_local_date`. Do not create intermediate historical day mutations.

Because the scheduled date physically changes, Planner must show the card in the new current-day column and must no longer show it in the old column.

A reminder is part of the scheduled Task. When rollover changes the Task's scheduled date, its existing reminder time remains the same time-of-day and therefore applies to the new rolled-forward date. Do not preserve or display an obsolete originating reminder date unless a separate future product requirement introduces explicit schedule history.

Completed Tasks are never rolled forward. Explicit date changes use either desktop drag/drop or the scheduled-date field in Edit.

## 5. Desktop spatial UX — v1.0.3

Desktop Planner is one wide weekly planning surface plus one global application header. There is no persistent left rail and no separate Day or Week destination.

**Global header hierarchy:** the header has three semantic zones and one centered temporal centerpiece.

- **Left:** the Jig product mark/wordmark. It is the Planner/Home affordance.
- **Center (v1.0.5 override):** the Planner temporal navigator is one inline group: **Previous week chevron · compact active week range · Next week chevron · Today**. The range is informational; Previous/Next/Today are the controls. This v1.0.5 one-row geometry supersedes the earlier v1.0.3 two-line arrangement so the complete header fits the 44px budget without offsets or clipping.
- **Right:** **Add task**, **Planner**, **History**, **Settings**, and compact synchronization status. Planner, History and Settings form one adjacent navigation group; Planner is visibly active on the Planner surface.
- The center region remains optically/page centered even when the left and right zones have unequal widths.

**Week range formatting:** use compact human-readable local dates without explanatory prefixes such as “Week of”.

- same month: `16–22 Nov 2026`;
- different months, same year: `30 Nov–6 Dec 2026`;
- different years: `28 Dec 2026–3 Jan 2027`.

**Temporal state:** Planner maintains exactly one temporal presentation state: the visible week start. At startup it is the Monday containing the current local date. Previous/Next shift the displayed week by exactly seven days. Today restores the week containing the current local date. Date headers are labels/actions containers, not selectors.

**Planner board:** the seven Monday–Sunday date columns fill the available planning canvas equally in width. There is no artificial content max-width. Each column remains at least 160px wide in desktop composition. Column height is content-driven rather than equalized or stretched for a bottom action. Column headers are non-selectable date signifiers using full weekday names plus the day number, such as `Thursday 19`; each header also contains the compact day-specific `+` action adjacent to the date label.

**Reduced chrome:** date lanes are not boxed panels. Do not draw thick perimeter borders or persistent card-like lane containers around each day. Use the minimum visual structure needed to scan the week: whitespace between lanes, typography, and at most subtle hairline dividers between adjacent lanes. Empty lane space remains visually open. Task cards are the primary discrete surfaces and use restrained borders/shadows; do not stack multiple outlines, heavy shadows or redundant framing around cards inside framed lanes.

**Date/state treatment:** current date, Task selection, drag target and Task priority are distinct visual states. Only the exact current local civil date receives persistent current-day emphasis. There is no selected-day visual state. Current day uses a subtle neutral border/header treatment, not a full-column brand fill. Selected Task uses a separate subtle selection surface/border. Drag-over uses a third transient treatment. Priority remains a leading card cue with High/Normal/Low semantics. These states remain distinguishable without relying on color alone.

**Task scanability, iconography and color:** compact Task cards use restrained surfaces, clear title hierarchy and small semantic iconography for metadata/status where useful (for example reminder, reference/context, completion or synchronization-related information). Priority uses the governed leading cue and, where necessary, icon/text semantics so color is not the sole carrier. Icons must use public Astryx/Lucide-style system primitives where available, remain secondary to the Task title, and have accessible names/tooltips when their meaning is not already expressed in adjacent text. Normal priority must not become a visually dominant badge.

**Task workspace:** clicking a Planner Task selects it and opens the canonical editable Task form directly in the non-blocking right-side workspace. There is no read-only detail step and no second Edit click. The workspace overlays from the right and **must not resize, reflow or narrow the seven Planner columns**. Selection itself performs no move. Clicking Planner/History content outside a Task card and outside the workspace closes it without saving; clicking another Task retargets it.

**Task editing/creation:** existing and new Tasks use the same field surface: Title, Date, Context, Priority, Reminder, Reference and Notes. Add task populates an originating/default date but does not hide optional fields. Global Add derives the default date from the displayed week and current local weekday. A per-date `+` uses its explicit date directly. No date selection is created by either path, and no full-width Add control remains at the bottom of a lane. Save persists through the canonical create/edit command; Cancel or outside dismissal closes without persistence.

**History:** selecting a completed Task opens the same right-side Task workspace while History remains the active destination.

**Actions:** pointer drag-and-drop is the primary direct same-date ordering/cross-date movement mechanism. Same-day Move up/Move down remains a keyboard-accessible ordering alternative. Explicit non-drag cross-date rescheduling occurs through the Edit date field. There is no separate Move-to-date workspace. Delete always requires explicit destructive confirmation.

**Copy discipline:** remove explanatory/meta labels that restate the interaction model. The production UI must not contain copy such as “selected date view”, “Today is a shortcut”, “Your ordered plan”, “full available canvas”, or similar implementation/design commentary. Controls, dates and Task content provide the orientation.

**Appearance:** System, Light and Dark are mandatory presentation modes. They use the same semantic hierarchy, component structure and interaction model; theme is local presentation preference rather than Task or Git-synchronized planning state. Focus, selection, priority, completion, save and sync states remain distinguishable in both Light and Dark without relying on color alone.

## 6. Narrow/mobile responsive UX — v1.0.5

Narrow/mobile is the same Planner and the same Task model, not a separate Day/Week product mode or a reduced-function implementation.

The governed v1.0.5 header is one compact row:

1. **One application/temporal row:** compact complete Jig wordmark · Previous · compact active week range · Next · Today · Add · compact synchronization state · hamburger. Icon-only `sm` controls may be used where required for width, but accessible labels remain authoritative. Do not create a second temporal row.
2. **Shared navigation semantics:** the hamburger renders the same **Planner · History · Settings** destination set as desktop from the same typed destination owner. It is a compact menu/popover, never a side-navigation drawer.
3. **Seven dated sections:** all seven dates for the displayed week appear as vertically stacked day sections. Each section header shows the date and its semantic Add icon; no date strip or selected-day control exists.
4. **Task lists:** each dated section contains that date's canonical outstanding sequence directly below its header and uses the same sortable Task row, metadata and Task action menu as desktop.
5. **Global Add:** Add task remains available as a convenient week-context action and opens the unified form with the derived weekday-matching default date; the Date field can be changed immediately.
6. **Direct movement:** whole-card touch/pen/mouse drag is available with the same exact-position movement semantics as desktop; genuine interactive descendants do not initiate drag.

Tapping a Task opens its directly editable full Task form in a non-blocking **BottomSheet rising from the bottom**. Add task uses the same BottomSheet and the same full field hierarchy with inherited date/defaults. There is no read-only inspection step or reduced title-only create screen.

Touch-sized controls are required. Direct drag ordering may be unavailable on narrow/mobile. When drag is unavailable, touch-operable Move up/Move down commands provide same-day ordering and the Edit scheduled-date field provides explicit cross-date rescheduling. These commands mutate the same canonical order/date state as desktop interactions; there is no mobile-specific ordering model.

Responsive reflow between desktop and narrow/mobile preserves displayed week, selected Task, workspace mode and unsaved draft state. There is no selected-day state to preserve. A Task workspace that is open as a desktop right overlay becomes the mobile BottomSheet, and vice versa, without duplicating Task/draft state.

Task creation/editing is never a centered/fullscreen modal. Permanent Delete confirmation remains blocking. No full background/scheduled mobile notification requirement is introduced.

The earlier Day/Week mockups remain historical design inputs only. Their separate destinations, sidebar/navigation duplication, completed-in-Day section, illustrative URLs/dates and explanatory labels are superseded by this v1.0.3 contract.

## 7. Feedback and notification interaction

- A successful mutation visibly updates the list and its date/count, in the same interaction.
- Failed local saving is visible and actionable. Repository synchronization failure is reported separately as a durable generic sync issue while the successful local Task state remains available; Jig does not translate Git conflict/topology details into planning state.
- In-app reminder toast is transient and non-blocking, with an obvious dismiss action. No separate reminder inbox is necessary in v1.
- Browser notification is a user-permission enhancement only. If unavailable, in-app toast still works while the application is open.
- No external push server, mobile background worker, or guaranteed alerts when the app is closed.

## 8. Acceptance scenarios

1. **Evening planning:** on Wednesday evening, add a Thursday task with title only; it appears under Thursday and can be reordered; no required time estimate.
2. **New high priority:** add a High priority task to a day with an existing manually arranged list; the new task is inserted at a suitable high-priority position and all existing items retain their relative order.
3. **Midday replanning:** drag an item from Thursday's third position to first, then drag another to Friday; the saved state survives reload and no other task moves unexpectedly.
4. **Changing priority:** change an existing third-position task to High; its position does not change.
5. **Interrupted work:** a Thursday Task left unfinished is automatically rolled into Friday by changing its canonical scheduled date; the same Task identity, title, reminder and external reference are preserved.
6. **Completion history:** complete a Task on Friday after rollover; History shows the canonical Friday scheduled date together with the actual completion timestamp. No separate pre-rollover schedule-history field is required in v1.
7. **Reminder:** while Jig is open and visible, a due reminder produces one in-app toast. If Jig remains open but hidden and browser notification permission is granted, the same due reminder produces one browser Notification instead. No success claim is made while Jig/browser is closed.
8. **Responsive continuity:** narrow and wide layouts represent the same Planner state, selected Task, Task-workspace mode and values, without a Day/Week destination split, destination switching caused by selection or loss of edits.
9. **Daily rollover:** leave a Thursday Task outstanding and advance the local day to Friday. Jig changes the Task's canonical `scheduled_date` to Friday, moves the same card into Friday's Planner bucket, and removes it from Thursday. Desktop and narrow/mobile Planner presentations show the same moved Task. If Jig is inactive across multiple days, the outstanding Task catches up directly to the current local date. Existing reminder time-of-day is preserved.
10. **Deletion:** choose Delete on an outstanding or completed Task, cancel the confirmation once with no change, then confirm; the Task is removed from Jig and the next portable Git snapshot records its absence. No in-app trash or restore is offered.
11. **Single Planner navigation and centered temporal controls:** launch Jig on desktop and mobile. Planner is the default. Desktop has no left navigation rail; the Jig mark is Home, the right-side navigation group explicitly contains Planner, History and Settings, and the centered week range sits above a grouped Previous/Today/Next row. Previous/Next move the displayed week by seven days; Today returns to the current week. No selected-day state exists. Mobile presents the same temporal centerpiece below its application band, and its hamburger renders the same Planner, History and Settings destination set from the shared navigation owner.
12. **Inspect without moving:** click/tap a Task. Its details open in the right-side desktop workspace or bottom mobile sheet while its scheduled date/order and current destination remain unchanged.
13. **Unified Add:** invoke Add task from a date context. The workspace opens the same Title, Date, Context, Priority, Reminder, Reference and Notes fields used for an existing Task, pre-populated with the originating date and canonical defaults. Title and Date are required; optional fields may be left empty. Saving creates the Task without a later Edit step.
14. **Movement semantics:** drag a desktop Task within/between date columns and observe exact-position movement. Click/tap alone never moves it. Change scheduled date through Edit and observe non-drag rescheduling without a separate Move-to-date surface.
15. **History details:** select a completed History row. History remains active and the Task details open in the same contextual desktop-right/mobile-bottom workspace.
16. **Theme parity:** switch among System, Light and Dark. Layout, task meaning, focus, selection, priority, save and synchronization states remain equivalent and readable; changing theme makes no Task mutation.

## 9. Installation, everyday operation and data lifecycle

The initial experience starts **before** the user sees the planner:

1. User runs one installer script from the Jig application distribution. It checks Linux prerequisites, installs the pinned application/runtime in the user's application directory, and accepts either an existing local Git repository or a repository URL plus new/empty checkout destination. URL mode invokes ordinary Git clone behavior and then continues through the same selected-checkout installation path.
2. The installer verifies that the target is a writable Git repository other than Jig's public source checkout, establishes Jig's repository-contained local data area, and determines whether valid existing Jig portable data is already present. Existing valid Jig data is adopted; otherwise Jig initializes a new dataset. Any Git isolation mechanism used for automatic synchronization remains an internal adapter detail and must not become installer/user-visible repository-management behavior.
3. The installer creates a `jig` launcher and installs/enables a Linux **user** service. It reports the exact repository path, local UI address, data location, and sync state. No elevated/root install is required for the ordinary path.
4. The user runs `jig` or visits the local UI. The service may already be running. It opens Planner as the default/home surface without an installer or terminal wizard on every visit; Today remains a date shortcut inside Planner, not a separate destination.
5. Create/edit/reorder/complete/delete operations save to local SQLite at commit time. On successful save, the interface reflects the saved Task. In the background, the repository integration boundary batches the current canonical snapshot into deterministic Git records and attempts synchronization when a configured remote is available.
6. The app keeps working offline. Repository synchronization failures never block Task use or roll back successful local saves. Jig exposes a generic durable **Sync issue — local data safe** outcome and does not inspect, classify or repair Git topology/history. Repository structure, credentials, signing policy and reconciliation remain Git responsibilities; when the selected repository again exposes valid Jig portable data and synchronization succeeds, normal operation resumes.
7. Reboot/log-in and service restarts preserve task data and resume pending Git synchronization. Uninstallation removes application/service artifacts only; personal planning data remains in the configured repository unless explicitly and separately removed.

The SQLite database **lives in the target repository's Jig area** but is not itself committed as a binary Git merge source. Portable textual Task records are synchronized through the repository adapter using an adapter-private isolation mechanism; branch/ref/worktree details are not part of Jig's user workflow or configuration. Unrelated repository content and the user's normal staging area remain untouched. Repository transport is optional for local use; when no synchronization target is available Jig shows an unambiguous `local-only` state.

A responsive visual structure and touch-accessible controls are required at initial desktop delivery, while an independently installed mobile runtime remains future work. The UI screenshots are governed by the [Jig UI solution design](../design/ui-solution.md); they are visual references, not separate domain authority.

### Everyday acceptance scenarios

12. **Fresh or existing-data installation:** Install Jig against either an existing personal Git repository or a repository URL cloned into a new/empty checkout. If the selected repository contains no Jig data, Jig initializes a dataset; if it already contains valid Jig portable data, Jig adopts it automatically. Start the user service, run `jig`, and verify the database and portable records are under the selected repository, not the public source checkout.
13. **No manual Git routine:** Reorder two tasks and close the browser; the background service saves/commits automatically, retries an unavailable remote, and synchronizes when transport returns, without losing the task order.
14. **Repository coexistence:** Place unrelated staged and unstaged documents in the selected repository. Jig synchronization must not stage, commit, rewrite or push those changes as part of Jig's own branch/ref.
15. **Restart:** Restart the Linux user service or log out and back in. The current plan is immediately usable and unsynchronized changes resume transfer; a missing remote is displayed as local-only.
16. **Repository synchronization issue:** Arrange the repository so synchronization cannot complete. Jig keeps the locally saved Task state usable and reports a generic sync issue without exposing a planning-level divergence/conflict state. Reconcile the repository with Git tooling outside Jig; once the repository boundary is healthy again, synchronization resumes without Jig performing merge/conflict resolution.
17. **Idle lifecycle:** Leave the service running without the browser for a working day. It remains responsive when reopened and does not continuously poll at an unnecessarily expensive cadence.

### Responsibility boundary

Jig owns Task behavior, local persistence, deterministic portable Jig records, automatic synchronization intent and coarse synchronization outcomes. Git owns repository acquisition, repository topology, branches/refs/worktrees, signing and identity policy, credentials, history, merge/rebase/conflict behavior and reconciliation. Functional requirements may require isolation or automatic synchronization outcomes, but must not promote Git implementation mechanics into Jig workflow or user configuration.

## 10. Non-decisions

This functional specification does **not** select SQLite, file formats, a Git merge/conflict/reconciliation policy, a drag-and-drop library, exact breakpoints, deployment wrappers, or the implementation component graph. Git history reconciliation is outside Jig's domain rather than a deferred Jig behavior. It does require System/Light/Dark appearance semantics; the technical and UI solutions own their concrete realization. See [technical solution](../architecture/technical-solution.md). The technical choices satisfy this document and do not redefine it.