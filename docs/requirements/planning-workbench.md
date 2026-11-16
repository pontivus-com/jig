# Jig — planning and UX functional design

**Status:** Candidate v0.4, updated 2026-11-16 with carry-over, deletion, mandatory appearance themes, repository-boundary ownership, full installation, configured-repository, background-sync and usage lifecycle. Visual mockups are an accepted starting point, not a signed component/theme specification.  
**Concern:** Observable planning semantics, task interactions, calendar views, feedback and responsive behavior.  
**Governing intent:** [Jig product definition](../product/product-definition.md).

## 1. Primary interaction

The **week planner** is the principal desktop surface: dated columns with an ordered list of unfinished items. The **day view** is an expanded view of a selected date, with the same task identity and order plus completed items. The day and week views represent the same data, not competing boards or independent workflows.

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

**Carry-over:** derived presentation state for an outstanding task whose scheduled date is earlier than the selected date. Carry-over never changes the task's scheduled date and is not a separate persisted status or ordering authority.

**Deletion:** confirmed permanent removal of a Task from Jig. Deletion creates no soft-delete state, trash record, tombstone, or application-level undo history. If an earlier exported version exists, repository Git history is the recovery mechanism.

## 3. Functional requirements

| ID | Requirement | Observable acceptance |
|---|---|---|
| JIG-FR-01 | Create a task quickly | A title entered from a day/column creates a task on that date without requiring priority, estimate, context, or link. |
| JIG-FR-02 | Navigate dates | Move between days and weeks, select any date, and return to today without altering task data. |
| JIG-FR-03 | Order within a day | Drag an outstanding task to any position within its scheduled date. The new order persists across view changes and restart. |
| JIG-FR-04 | Move between dates | Drag into another visible date/position on desktop or choose a date from the task action; the item is moved, not copied. |
| JIG-FR-05 | Priority-assisted insertion | On quick-add/new scheduling, priority suggests an insertion point without rearranging existing tasks. A previously manually mixed list is not silently sorted into priority groups. |
| JIG-FR-06 | Preserve manual intent | Changing a task's priority after creation changes its indicator only. It does not reorder an existing day. Manual drag order remains authoritative. |
| JIG-FR-07 | Flexible modifications | Title, date, priority, context, reference, note and reminder can be edited without an approval or workflow gate. |
| JIG-FR-08 | Complete and reopen | Completion removes the task from the outstanding sequence, records when it completed, and makes it visible in completed/history. Reopen restores the same task identity and schedule. |
| JIG-FR-09 | Carry forward unfinished past work | An outstanding Task whose scheduled date precedes the selected Day remains visible on subsequent Day views until completed, explicitly rescheduled or deleted. It retains its original scheduled date and is marked with a subtle but scan-visible carry-over treatment including that originating date; no silent auto-rollover occurs. |
| JIG-FR-10 | In-app reminders | While Jig is open, a due task reminder displays an unobtrusive toast; a system/browser notification is optional when supported and permitted. There is no background notification delivery contract. |
| JIG-FR-11 | Access original context | Open/copy a provided reference without duplicating project execution or source content into Jig. |
| JIG-FR-12 | Report honest outcomes | On persistence failure, the UI does not claim that the change was saved; the operator can understand and recover from the failure. |
| JIG-FR-13 | Preserve common meaning across devices | Desktop and eventual mobile use the same tasks, dates, priority semantics, completion meaning and actions. Responsive change alone must not mutate or discard work. |
| JIG-FR-14 | Retain local data | App restart retains tasks, their date/order, reminders and completion history within the selected personal Git repository. |
| JIG-FR-15 | Single-command installation and configuration | A single installer configures runtime/build, a local existing Git target repository or a safe clone from a supplied repository URL, Jig's data directories, `jig` launcher, and Linux user service, with explicit failure if prerequisites are unmet. |
| JIG-FR-16 | Repository-contained planning data | The selected repository, not the public Jig source repository, contains Jig's operational SQLite database and the Git-versioned portable task data; the configured target is inspectable and changeable through deliberate migration. |
| JIG-FR-17 | Convenient desktop availability | After installation, `jig` opens the locally running UI or starts its service; an enabled Linux user service keeps Jig available without a foreground terminal. |
| JIG-FR-18 | Automatic save and Git synchronization | Each successful task edit is durable locally without a Save-to-Git action; Jig automatically serializes, commits and synchronizes its own portable data when a remote is configured, with bounded batching and retry. |
| JIG-FR-19 | Safe cohabitation and synchronization honesty | Jig must not stage, commit or rewrite unrelated repository content. Missing remote or repository synchronization failure never invalidates a successful local Task save. The UI reports only the operational synchronization outcome; Jig does not classify Git topology, merge histories or provide repository reconciliation. |
| JIG-FR-20 | Low-friction idle operation | The desktop service starts predictably, stays lightweight and idle-efficient, and offers quick day/week access throughout the working day without requiring repeated initialization. |
| JIG-FR-21 | Delete a task | An outstanding or completed Task can be permanently removed after explicit destructive-action confirmation. On success it disappears from planning, completed and History views. Jig provides no trash, soft delete or in-app restore; prior Git history is the only recovery when an exported version exists. |
| JIG-FR-22 | System, Light and Dark appearance | Jig supports System, Light and Dark appearance modes through one semantic theme owner. System follows the platform/browser color preference. Theme changes affect presentation only and never mutate Task data, selected date, ordering, drafts, completion or synchronization state. |

### Initial placement rule

For newly scheduled items, insert **after the last existing outstanding item of equal or higher priority**, or at the beginning if there is none. This gives the expected High → Normal → Low default order when a day has not been manually mixed, while preserving every existing item’s relative position. An already manually mixed day is not forcibly sorted by priority. A task dropped at an explicit position is placed *exactly* where dropped, regardless of its priority. Moving to a date via a date selector uses suggested insertion; dragging to a target position uses that precise position.

This keeps priority useful on capture without introducing a hidden automatic scheduler.

### Completion placement

The selected date's completed area shows items scheduled for that date which are now done. The history view can group items by actual completion date. These are different queries over the same underlying completion fact. Reopening places the task back into the outstanding list on its scheduled date; any needed ordering adjustment is explicit.

### Carry-over presentation and ordering

The Day attention sequence is a derived concatenation, not a second persisted order. Outstanding tasks from dates earlier than the selected date appear first, ordered by original scheduled date from oldest to newest and then by each date's persisted position. Tasks scheduled for the selected date follow in their persisted position order. Week remains an actual scheduled-date view and does not duplicate one Task into later date columns.

Every carried-over row keeps its normal task structure but receives a subtle, readily scannable treatment such as a restrained surface/edge difference plus text equivalent to **Carried over · Thu 19**. Color alone cannot carry this meaning. The originating date is always the Task's actual scheduled date, not merely “yesterday.” Carry-over is derived from `completed = false` and `scheduled date < selected date`; it is never stored as a status or flag.

Merely viewing a carried-over Task on a later Day does not reschedule it. Dragging a carried-over Task into the selected-date sequence is an explicit reschedule to that selected date and exact drop position. Using a date action/editor is also an explicit reschedule and uses the normal priority-assisted insertion rule.

## 4. Desktop spatial UX — MVP

**Week:** one calendar week of date buckets, with previous/next week controls, jump to today, quick-add scoped to a bucket, compact title-first task rows/cards, clear drag affordances, priority/context/reminder metadata only when it adds value, and an obvious drop target for cross-day movement. Dates with substantial lists must remain navigable without making the entire page unusable. No additional generic “Board” view is needed: the week planner already uses Kanban interaction.

**Day:** selected date and one attention list composed of carried-over earlier outstanding tasks followed by tasks scheduled for the selected date, plus a compact completed section and an on-demand task inspector/editor. Carried-over rows are subtly but immediately distinguishable and show their originating date without changing it. A task's detail surface shows its own minimal fields, optional reference, completion, rescheduling and deletion controls; it does not display the owning project's workflow.

**History:** simple dated access to completed items, not a productivity dashboard. Filter by context/project only if useful; metrics are secondary and not MVP acceptance requirements.

**Quick add:** the default interaction asks only for title and uses the originating date. Secondary fields remain optional and can be edited afterward.

**Actions:** desktop pointer drag-and-drop is the primary ordering mechanism. Provide keyboard-accessible alternatives (move before/after or move to date) and visible focus. Completion uses one explicit control. Delete is a destructive action available for outstanding and completed Tasks and always requires explicit confirmation before mutation. Small touch targets or hover-only essential actions are not acceptable even in the desktop-first MVP.

**Visual hierarchy:** dates and work-item titles dominate; the current/selected date is clear; carried-over work has a subtle but scan-visible treatment with its originating date; priority is visually modest, with high priority exceptional rather than every Normal value becoming a strong badge; reminder *time* must be recognizable as an alert and not a time block.

**Appearance:** System, Light and Dark are mandatory presentation modes. They use the same semantic hierarchy, component structure and interaction model; theme is local presentation preference rather than Task or Git-synchronized planning state. All focus, selection, priority, carry-over, completion, save and sync states remain distinguishable in both Light and Dark without relying on color alone.

## 5. Mobile-first responsive design — later delivery

Define narrow layout and input behavior now, without requiring an independently installable mobile app in desktop v1.

- Day-oriented narrow layout: compact horizontal week strip + one day's attention list, including the same carry-over treatment and originating-date semantics as desktop, rather than seven unreadable columns.
- Touch-sized controls; drag-and-drop ordering can be implemented later, with move-to-date as a reliable non-drag fallback.
- Task editor uses a bounded mobile sheet or full-screen treatment with explicit Save/Cancel and preserved edits when navigation changes.
- The same work item does not become a separate mobile data or lifecycle shape.
- No full background/scheduled mobile notification requirement.

The earlier mockups used the working name Day and were made to validate relationships and task workflows; their product naming is superseded by Jig. Their colors, card shadows, navigation duplicates, and illustrative URLs/dates are **not** normative visual design or live data.

## 6. Feedback and notification interaction

- A successful mutation visibly updates the list and its date/count, in the same interaction.
- Failed local saving is visible and actionable. Repository synchronization failure is reported separately as a durable generic sync issue while the successful local Task state remains available; Jig does not translate Git conflict/topology details into planning state.
- In-app reminder toast is transient and non-blocking, with an obvious dismiss action. No separate reminder inbox is necessary in v1.
- Browser notification is a user-permission enhancement only. If unavailable, in-app toast still works while the application is open.
- No external push server, mobile background worker, or guaranteed alerts when the app is closed.

## 7. Acceptance scenarios

1. **Evening planning:** on Wednesday evening, add a Thursday task with title only; it appears under Thursday and can be reordered; no required time estimate.
2. **New high priority:** add a High priority task to a day with an existing manually arranged list; the new task is inserted at a suitable high-priority position and all existing items retain their relative order.
3. **Midday replanning:** drag an item from Thursday's third position to first, then drag another to Friday; the saved state survives reload and no other task moves unexpectedly.
4. **Changing priority:** change an existing third-position task to High; its position does not change.
5. **Interrupted work:** a Thursday task left unfinished remains identifiable on Friday, and can be rescheduled without losing its original identity or external link.
6. **Completion history:** complete a task scheduled for Thursday on Friday; history shows the Friday completion timestamp while the original Thursday scheduling fact remains discernible.
7. **Reminder:** while Jig is open and reminder time arrives, a toast appears. No success claim is made about notifications while Jig is closed.
8. **Responsive continuity:** narrow and wide layouts represent the same selected task and values, without duplicate project detail or loss of edits.
9. **Carry-forward:** leave a Thursday Task outstanding. On Friday, Saturday and later selected Days it remains visible with its original Thursday date and carry-over treatment until it is completed, explicitly rescheduled or deleted; simply viewing it never changes `scheduled date`.
10. **Deletion:** choose Delete on an outstanding or completed Task, cancel the confirmation once with no change, then confirm; the Task is removed from Jig and the next portable Git snapshot records its absence. No in-app trash or restore is offered.
11. **Theme parity:** switch among System, Light and Dark. Layout, task meaning, carry-over, focus, selection, priority, save and synchronization states remain equivalent and readable; changing theme makes no Task mutation.

## 8. Installation, everyday operation and data lifecycle

The initial experience starts **before** the user sees the planner:

1. User runs one installer script from the Jig application distribution. It checks Linux prerequisites, installs the pinned application/runtime in the user's application directory, and accepts a local existing Git repository or safely clones a configured personal/organization repository URL to a chosen empty local path.
2. The installer verifies that the target is a writable Git worktree, that its Jig subdirectory can be used safely, and whether a remote exists. It configures a repository-contained Jig data area, durable SQLite state, and a dedicated internal Git worktree/branch to keep Jig's commits separate from unrelated project/documentation edits. It refuses unsafe target selection rather than adopting the public Jig source repo.
3. The installer creates a `jig` launcher and installs/enables a Linux **user** service. It reports the exact repository path, local UI address, data location, and sync state. No elevated/root install is required for the ordinary path.
4. The user runs `jig` or visits the local UI. The service may already be running. It opens today's/day or week plan without an installer or terminal wizard on every visit.
5. Create/edit/reorder/complete/delete operations save to local SQLite at commit time. On successful save, the interface reflects the saved Task. In the background, the repository integration boundary batches the current canonical snapshot into deterministic Git records and attempts synchronization when a configured remote is available.
6. The app keeps working offline. Repository synchronization failures never block Task use or roll back successful local saves. Jig exposes a generic durable **Sync issue — local data safe** outcome and does not inspect, classify or repair Git history. Repository reconciliation is performed with external Git tooling; when the boundary later presents a single complete canonical snapshot, normal validation/adoption resumes.
7. Reboot/log-in and service restarts preserve task data and resume pending Git synchronization. Uninstallation removes application/service artifacts only; personal planning data remains in the configured repository unless explicitly and separately removed.

The SQLite database **lives in the target repository's Jig area** but is not itself committed as a binary Git merge source. Textual task records are versioned in a dedicated Jig-managed Git branch/ref within the same selected repository. The product must disclose this layout; the normal document branch and user staging area remain untouched by Jig's Git automation. A Git remote is optional for local use but **required for remote synchronization**; Jig shows an unambiguous `local-only` state when none is configured.

A responsive visual structure and touch-accessible controls are required at initial desktop delivery, while an independently installed mobile runtime remains future work. The UI screenshots are governed by the [Jig UI solution design](../design/ui-solution.md); they are visual references, not separate domain authority.

### Everyday acceptance scenarios

12. **Fresh installation:** Install Jig once, select an existing personal Git repository, start the user service, run `jig`, and create a task; the database and portable record are under the selected repository, not the public source checkout.
13. **No manual Git routine:** Reorder two tasks and close the browser; the background service saves/commits automatically, retries an unavailable remote, and synchronizes when transport returns, without losing the task order.
14. **Repository coexistence:** Place unrelated staged and unstaged documents in the selected repository. Jig synchronization must not stage, commit, rewrite or push those changes as part of Jig's own branch/ref.
15. **Restart:** Restart the Linux user service or log out and back in. The current plan is immediately usable and unsynchronized changes resume transfer; a missing remote is displayed as local-only.
16. **Repository synchronization issue:** Arrange the repository so synchronization cannot complete. Jig keeps the locally saved Task state usable and reports a generic sync issue without exposing a planning-level divergence/conflict state. Reconcile the repository with Git tooling outside Jig; once the repository boundary is healthy again, synchronization resumes without Jig performing merge/conflict resolution.
17. **Idle lifecycle:** Leave the service running without the browser for a working day. It remains responsive when reopened and does not continuously poll at an unnecessarily expensive cadence.

## 9. Non-decisions

This functional specification does **not** select SQLite, file formats, a Git merge/conflict/reconciliation policy, a drag-and-drop library, exact breakpoints, deployment wrappers, or the implementation component graph. Git history reconciliation is outside Jig's domain rather than a deferred Jig behavior. It does require System/Light/Dark appearance semantics; the technical and UI solutions own their concrete realization. See [technical solution](../architecture/technical-solution.md). The technical choices satisfy this document and do not redefine it.