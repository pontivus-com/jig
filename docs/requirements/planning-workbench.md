# Jig — planning and UX functional design

**Status:** Candidate v0.1, prepared 2026-11-16; UX mockups accepted as a functional starting point, not a signed visual specification.  
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
| JIG-FR-09 | Unfinished past work | Past-date unfinished tasks remain visible as outstanding and can be moved when desired; no silent auto-rollover or deletion. |
| JIG-FR-10 | In-app reminders | While Jig is open, a due task reminder displays an unobtrusive toast; a system/browser notification is optional when supported and permitted. There is no background notification delivery contract. |
| JIG-FR-11 | Access original context | Open/copy a provided reference without duplicating project execution or source content into Jig. |
| JIG-FR-12 | Report honest outcomes | On persistence failure, the UI does not claim that the change was saved; the operator can understand and recover from the failure. |
| JIG-FR-13 | Preserve common meaning across devices | Desktop and eventual mobile use the same tasks, dates, priority semantics, completion meaning and actions. Responsive change alone must not mutate or discard work. |
| JIG-FR-14 | Retain local data | App restart retains tasks, their date/order, reminders and completion history; backup/sync requirements are detailed at technical design time. |

### Initial placement rule

For newly scheduled items, insert **after the last existing outstanding item of equal or higher priority**, or at the beginning if there is none. This gives the expected High → Normal → Low default order when a day has not been manually mixed, while preserving every existing item’s relative position. An already manually mixed day is not forcibly sorted by priority. A task dropped at an explicit position is placed *exactly* where dropped, regardless of its priority. Moving to a date via a date selector uses suggested insertion; dragging to a target position uses that precise position.

This keeps priority useful on capture without introducing a hidden automatic scheduler.

### Completion placement

The selected date's completed area shows items scheduled for that date which are now done. The history view can group items by actual completion date. These are different queries over the same underlying completion fact. Reopening places the task back into the outstanding list on its scheduled date; any needed ordering adjustment is explicit.

## 4. Desktop spatial UX — MVP

**Week:** one calendar week of date buckets, with previous/next week controls, jump to today, quick-add scoped to a bucket, compact title-first task rows/cards, clear drag affordances, priority/context/reminder metadata only when it adds value, and an obvious drop target for cross-day movement. Dates with substantial lists must remain navigable without making the entire page unusable. No additional generic “Board” view is needed: the week planner already uses Kanban interaction.

**Day:** selected date, its ordered outstanding list, a compact completed section, and an on-demand task inspector/editor. A task's detail surface shows its own minimal fields, optional reference, completion and rescheduling controls; it does not display the owning project's workflow.

**History:** simple dated access to completed items, not a productivity dashboard. Filter by context/project only if useful; metrics are secondary and not MVP acceptance requirements.

**Quick add:** the default interaction asks only for title and uses the originating date. Secondary fields remain optional and can be edited afterward.

**Actions:** desktop pointer drag-and-drop is the primary ordering mechanism. Provide keyboard-accessible alternatives (move before/after or move to date) and visible focus. Completion uses one explicit control. Small touch targets or hover-only essential actions are not acceptable even in the desktop-first MVP.

**Visual hierarchy:** dates and work-item titles dominate; the current/selected date is clear; priority is visually modest, with high priority exceptional rather than every Normal value becoming a strong badge; reminder *time* must be recognizable as an alert and not a time block.

## 5. Mobile-first responsive design — later delivery

Define narrow layout and input behavior now, without requiring an independently installable mobile app in desktop v1.

- Day-oriented narrow layout: compact horizontal week strip + one day's ordered list, rather than seven unreadable columns.
- Touch-sized controls; drag-and-drop ordering can be implemented later, with move-to-date as a reliable non-drag fallback.
- Task editor uses a bounded mobile sheet or full-screen treatment with explicit Save/Cancel and preserved edits when navigation changes.
- The same work item does not become a separate mobile data or lifecycle shape.
- No full background/scheduled mobile notification requirement.

The earlier mockups used the working name Day and were made to validate relationships and task workflows; their product naming is superseded by Jig. Their colors, card shadows, navigation duplicates, and illustrative URLs/dates are **not** normative visual design or live data.

## 6. Feedback and notification interaction

- A successful mutation visibly updates the list and its date/count, in the same interaction.
- Failed saving or a conflicted sync is visible and actionable; a disappearing toast is not sufficient for losing a user edit.
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

## 8. Non-decisions

This functional specification does **not** select SQLite, file formats, a Git merge policy, a drag-and-drop library, exact breakpoints, deployment wrappers, the final theme, or the implementation component graph. See [technical solution](../architecture/technical-solution.md). The technical choices satisfy this document and do not redefine it.