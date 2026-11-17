# Jig — planning and UX functional design

**Status:** Candidate v0.6, updated 2026-11-17 with the binding v1.0.3 single-planner interaction model, persisted daily rollover, deletion, mandatory appearance themes, repository-boundary ownership, full installation, configured-repository, background-sync and usage lifecycle. Visual mockups are an accepted starting point, not a signed component/theme specification.  
**Concern:** Observable planning semantics, task interactions, calendar views, feedback and responsive behavior.  
**Governing intent:** [Jig product definition](../product/product-definition.md).

## 1. Primary interaction

Jig has **one primary Planner surface**. There are no separate Day and Week destinations.

On wide/desktop layouts, Planner presents the current planning week as seven dated columns containing the canonical ordered outstanding Tasks for those dates. The board consumes the available planning canvas rather than preserving an artificial maximum width.

On narrow/mobile layouts, the same Planner reflows to a horizontal seven-date selector plus the canonical outstanding Task list for the selected date. This is a responsive presentation of the same Planner state, not a separate Day view, route, destination or data projection.

The primary planning interaction is master-detail:

- clicking/tapping a Task **selects and inspects** it; selection never moves the Task and never changes application destination;
- direct visual movement/reordering is performed by drag-and-drop where supported;
- explicit non-drag rescheduling is performed by editing the Task's scheduled date;
- Add/Quick Add and Edit reuse the same contextual Task workspace as inspection;
- permanent Delete confirmation is the only blocking Task modal.

Jig supports evening planning of the next day, morning planning, and unrestricted changes during work. It is not an appointment scheduler and it does not require an hour estimate.

## 2. Canonical user-level concepts

**Task:** one lightweight scheduled intention with a stable identity. Required user inputs are `title` and `scheduled date`; other user-entered details are optional. A task has a persisted position within its scheduled day and a planned/done condition. The implementation derives display groups from these facts; view-specific copies are not authoritative.

**Date:** the intended local calendar date of work, independent of creation and completion timestamps. Every MVP task has one scheduled date. The selected date is presentation state; changing it does not edit any task.

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
| JIG-103-FR-01 | One Planner destination | Jig exposes one planning destination. Desktop shows the seven-date weekly board; narrow/mobile shows the same Planner as a date strip plus the selected date's list. There is no separately navigable Day view. |
| JIG-103-FR-02 | Planner is the default/home surface | Jig opens on Planner. The product mark/home affordance returns to Planner from secondary destinations without adding Planner as a redundant menu item. |
| JIG-103-FR-03 | No persistent desktop sidebar | The former left navigation rail is removed. Desktop secondary navigation is folded into the top region and exposes only History and Settings, with appropriate semantic iconography. |
| JIG-103-FR-04 | Proper mobile hamburger navigation | Mobile uses a top hamburger/menu-button pattern for secondary navigation. Opening it presents History and Settings as a compact menu/popover; it must not open a side-navigation drawer or recreate the former desktop sidebar. |
| JIG-103-FR-05 | Task click/tap inspects; it never moves | Clicking/tapping any Task row/card selects that canonical Task and opens its details in place. The current Planner/History destination remains active. Card selection never changes scheduled date, order or destination. |
| JIG-103-FR-06 | Desktop Task workspace enters from the right | On desktop Planner and History, Task view/create/edit uses one non-blocking contextual workspace entering from the right. It overlays secondary content rather than navigating away or opening a centered modal. |
| JIG-103-FR-07 | Mobile Task workspace rises from the bottom | On narrow/mobile layouts, Task view/create/edit uses one non-blocking bottom sheet rising from the bottom. Tapping a Task shows its proper Task details in that sheet; Add/Edit reuse the same sheet. |
| JIG-103-FR-08 | No Task create/edit modal | Add Task, Quick Add, Task inspection and Edit must not use centered/fullscreen modal dialogs. Permanent destructive Delete confirmation remains the sole blocking Task dialog. |
| JIG-103-FR-09 | Quick Add is actually quick | Quick Add/Add Task initially asks only for title and inherits the originating selected date plus canonical defaults. Optional Task metadata is edited afterward through Edit. |
| JIG-103-FR-10 | Week board uses available desktop width | The desktop Planner board fills the available main canvas with seven equal fluid date columns and no artificial content max-width. Columns expand on wider screens so ordinary Task titles do not wrap unnecessarily. A 160px per-column minimum remains the lower desktop usability budget. |
| JIG-103-FR-11 | Drag owns direct visual movement | On desktop, drag-and-drop is the direct interaction for same-date reordering and cross-date movement. Dragging places the Task at the exact drop position. Clicking/tapping a card is never overloaded to move or switch it. |
| JIG-103-FR-12 | Edit owns explicit non-drag rescheduling | Cross-date rescheduling without drag is performed through the scheduled-date field in Edit. There is no separate Move-to-date workspace/modal. Same-day keyboard-accessible Move up/Move down remains available where needed. |
| JIG-103-FR-13 | History participates in the same master-detail model | Selecting a completed Task in History opens that Task's details in the same contextual workspace model: right-side workspace on desktop, bottom sheet on mobile. History remains the current destination. |
| JIG-103-FR-14 | Responsive reflow preserves state | Crossing the responsive breakpoint while a Task workspace is open preserves selected Task, create/edit mode and unsaved draft values. Responsive composition must not create duplicate Task state or mutate canonical Task data. |
| JIG-103-FR-15 | Completion leaves the Planner and remains inspectable | Completing a Task removes it from the outstanding Planner sequence and records its completion timestamp. Completed Tasks remain inspectable/reopenable from History; the removed standalone Day completed section is not required. |
| JIG-103-FR-16 | Navigation is intentionally minimal | The only secondary destinations are History and Settings. Desktop exposes them directly in the top application region; mobile exposes the same two destinations through the hamburger menu. Planner remains the implicit home/default surface. |

## 4. Functional requirements

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-FR-01 | Create a task quickly | A title entered from a day/column creates a task on that date without requiring priority, estimate, context, or link. |
| JIG-FR-02 | Navigate planning dates | Move between weeks, select any visible date in the Planner, and return to today without altering Task data. Narrow/mobile date selection changes only the selected Planner date. |
| JIG-FR-03 | Order within a day | Drag an outstanding task to any position within its scheduled date. The new order persists across view changes and restart. |
| JIG-FR-04 | Move between dates | Drag into another visible date/position on desktop, or explicitly edit the Task's scheduled date when a non-drag reschedule is needed. The item is moved, not copied. |
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
| JIG-FR-21 | Delete a task | An outstanding or completed Task can be permanently removed after explicit destructive-action confirmation. On success it disappears from planning, completed and History views. Jig provides no trash, soft delete or in-app restore; prior Git history is the only recovery when an exported version exists. |
| JIG-FR-22 | System, Light and Dark appearance | Jig supports System, Light and Dark appearance modes through one semantic theme owner. System follows the platform/browser color preference. Theme changes affect presentation only and never mutate Task data, selected date, ordering, drafts, completion or synchronization state. |

### Initial placement rule

For newly scheduled items, insert **after the last existing outstanding item of equal or higher priority**, or at the beginning if there is none. This gives the expected High → Normal → Low default order when a day has not been manually mixed, while preserving every existing item’s relative position. An already manually mixed day is not forcibly sorted by priority. A task dropped at an explicit position is placed *exactly* where dropped, regardless of its priority. Editing a Task's scheduled date uses suggested insertion; dragging to a target position uses that precise position.

This keeps priority useful on capture without introducing a hidden automatic scheduler.

### Completion placement

The selected date's completed area shows items scheduled for that date which are now done. The history view can group items by actual completion date. These are different queries over the same underlying completion fact. Reopening places the task back into the outstanding list on its scheduled date; any needed ordering adjustment is explicit.

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

Completed Tasks are never rolled forward. Manually moving a Task to another date remains explicit and uses the existing move/edit semantics.

## 5. Desktop spatial UX — v1.0.3

**Planner:** one calendar week of date buckets, with previous/next week controls, jump to today, title-first quick-add scoped to a selected/originating date, compact Task cards, clear drag handles, and obvious same-day/cross-day drop targets. The Planner fills the available main canvas; it has no fixed content max-width. Seven date columns share that width equally and remain at least 160px wide in the desktop composition.

There is no standalone desktop Day destination. Selecting a date changes Planner selection/context only; it does not navigate to another page.

**Task details:** clicking a Planner Task selects it and opens its canonical details in a non-blocking right-side contextual workspace. Planner remains visible underneath/alongside the contextual surface. Selection itself performs no move.

**Task editing/creation:** Edit replaces the right-side detail content with the full editor. Add/Quick Add uses the same right-side workspace in create mode and initially asks only for title. Save returns to the selected Task details. Cancel returns to details for an existing Task or closes create mode.

**History:** simple dated access to completed items, not a productivity dashboard. Selecting a History Task opens the same right-side Task details workspace without changing away from History.

**Navigation:** there is no persistent left sidebar. Planner is the implicit home/default surface. The desktop top application region exposes only History and Settings as secondary destinations, with appropriate semantic icons. The Jig brand/home affordance returns to Planner.

**Actions:** pointer drag-and-drop is the primary direct ordering/cross-date movement mechanism. Same-day Move up/Move down remains available as a keyboard-accessible ordering alternative. Explicit non-drag cross-date rescheduling occurs through the Edit date field. There is no separate Move-to-date workspace. Completion uses one explicit control. Delete always requires explicit destructive confirmation.

**Visual hierarchy:** dates and work-item titles dominate; the current/selected date is clear; priority is visually modest, with high priority exceptional rather than every Normal value becoming a strong badge; reminder *time* must be recognizable as an alert and not a time block.

**Appearance:** System, Light and Dark are mandatory presentation modes. They use the same semantic hierarchy, component structure and interaction model; theme is local presentation preference rather than Task or Git-synchronized planning state. All focus, selection, priority, completion, save and sync states remain distinguishable in both Light and Dark without relying on color alone.

## 6. Narrow/mobile responsive UX — v1.0.3

Narrow/mobile is the same Planner and the same Task model, not a separate Day/Week product mode.

- The Planner reflows to a compact horizontal seven-date strip plus the selected date's canonical outstanding Task list. Selecting a date changes the Planner date context only.
- There is no Day destination and no Week destination in mobile navigation.
- A top hamburger/menu button exposes only the secondary destinations **History** and **Settings**. The menu is a compact menu/popover treatment; it must not open a side-navigation drawer.
- Tapping a Task opens its proper detail content in a non-blocking BottomSheet rising from the bottom.
- Add/Quick Add and Edit reuse that same BottomSheet. Create mode initially asks only for title; Edit exposes the full optional Task fields.
- Touch-sized controls are required. Direct drag ordering may be unavailable on narrow/mobile; the Edit date field provides explicit cross-date rescheduling and same-day ordering controls remain available where needed.
- Responsive reflow between desktop and narrow/mobile preserves selected Task, workspace mode and unsaved draft state.
- Task creation/editing is never a centered/fullscreen modal. Permanent Delete confirmation remains blocking.
- The same work item does not become a separate mobile data/lifecycle shape.
- No full background/scheduled mobile notification requirement is introduced.

The earlier mockups used the working Day/Week split to validate relationships. For v1.0.3 that navigation split is superseded by the single responsive Planner contract above. Their colors, card shadows, navigation duplicates, and illustrative URLs/dates are **not** normative visual design or live data.

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
11. **Single Planner navigation:** launch Jig on desktop and mobile. Planner is the default. Desktop has no left navigation rail; only History and Settings appear in the top region. Mobile hamburger contains only History and Settings and does not open a side drawer.
12. **Inspect without moving:** click/tap a Task. Its details open in the right-side desktop workspace or bottom mobile sheet while its scheduled date/order and current destination remain unchanged.
13. **Quick Add:** invoke Add/Quick Add from a date context. Only Title is initially required/visible for capture; the Task is created on the originating date with canonical defaults and can then be edited for optional metadata.
14. **Movement semantics:** drag a desktop Task within/between date columns and observe exact-position movement. Click/tap alone never moves it. Change scheduled date through Edit and observe non-drag rescheduling without a separate Move-to-date surface.
15. **History details:** select a completed History row. History remains active and the Task details open in the same contextual desktop-right/mobile-bottom workspace.
16. **Theme parity:** switch among System, Light and Dark. Layout, task meaning, focus, selection, priority, save and synchronization states remain equivalent and readable; changing theme makes no Task mutation.

## 9. Installation, everyday operation and data lifecycle

The initial experience starts **before** the user sees the planner:

1. User runs one installer script from the Jig application distribution. It checks Linux prerequisites, installs the pinned application/runtime in the user's application directory, and accepts either an existing local Git repository or a repository URL plus new/empty checkout destination. URL mode invokes ordinary Git clone behavior and then continues through the same selected-checkout installation path.
2. The installer verifies that the target is a writable Git repository other than Jig's public source checkout, establishes Jig's repository-contained local data area, and determines whether valid existing Jig portable data is already present. Existing valid Jig data is adopted; otherwise Jig initializes a new dataset. Any Git isolation mechanism used for automatic synchronization remains an internal adapter detail and must not become installer/user-visible repository-management behavior.
3. The installer creates a `jig` launcher and installs/enables a Linux **user** service. It reports the exact repository path, local UI address, data location, and sync state. No elevated/root install is required for the ordinary path.
4. The user runs `jig` or visits the local UI. The service may already be running. It opens Day (defaulting to the current local date) or Week without an installer or terminal wizard on every visit; Today remains a shortcut, not a separate destination.
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

## 9. Non-decisions

This functional specification does **not** select SQLite, file formats, a Git merge/conflict/reconciliation policy, a drag-and-drop library, exact breakpoints, deployment wrappers, or the implementation component graph. Git history reconciliation is outside Jig's domain rather than a deferred Jig behavior. It does require System/Light/Dark appearance semantics; the technical and UI solutions own their concrete realization. See [technical solution](../architecture/technical-solution.md). The technical choices satisfy this document and do not redefine it.