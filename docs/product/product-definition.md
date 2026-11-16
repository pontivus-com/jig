# Jig — product definition

**Status:** Candidate initial product baseline, v0.2 (2026-11-16). Proposed for adoption in the Jig repository.  
**Concern:** Product purpose, value, boundaries and MVP target.  
**Product identity:** Jig / Pontivus Jig. Product descriptor: just-in-time daily planner. The name evokes a brief nudge that helps the user get on track.

## 1. Problem

A person working across products, projects and other obligations needs to know what is intended for each day, which item should receive attention next, and what is finished. Project-specific systems hold detailed specifications and execution state, but do not provide a simple, flexible cross-project daily plan. A full project-management workflow is excessive for this job.

The day is often planned the preceding evening or early morning. Circumstances change during the day; the plan must be immediately editable rather than governed by an approval or workflow process.

## 2. Product job

**Jig schedules attention, not project execution.**

Jig gives one person an ordered calendar of lightweight work intentions, optional priority and reminders, immediate rearrangement, and a reliable view of what remains and what was completed. Unfinished earlier-day items remain in view on subsequent days until the user completes, explicitly reschedules, or deletes them; Jig does not silently rewrite the date the user originally intended.

A Jig task represents *something to attend to on a date*, not a complete project requirement, issue, work package or implementation plan. It may point to the authoritative work in another project or system. The details and execution lifecycle continue to live there.

Illustrative item: **Thursday — Legal app: TTA workflow remediation**. Jig owns the date, ordering, reminder and completion of the planning item; the Legal project or an Order WorkItem owns the actual definition and resolution.

## 3. Audience and operating conditions

- Initial user: one person managing granular commitments across several work contexts and personal activities.
- Initial installation and main use: Linux desktop browser backed by a minimal local user service, launched with `jig` or kept running by the user's service manager.
- Design from the beginning: responsive, mobile-first information hierarchy and touch-aware interaction model.
- Independent phone installation and phone-side repository synchronization are future delivery needs. Desktop MVP includes automatic desktop repository synchronization and must not make the canonical data or interaction design incompatible with a later phone runtime.
- Local/offline work is fundamental; no third-party online service is needed for ordinary planning. The user explicitly chooses an existing personal/organization Git repository as Jig's planning-data home. Its canonical records and operational SQLite database live under a dedicated Jig directory inside that repository, never in Jig's public source repository.

## 4. MVP outcomes

An operator must be able to:

1. plan tomorrow, today, or any selected date by adding lightweight items;
2. review an entire week and the selected day's attention list, including unfinished earlier-day items carried forward without changing their original scheduled date;
3. change the order of items at any point using drag-and-drop;
4. move work to another date without losing it;
5. optionally mark importance and set a reminder, without estimating duration;
6. complete, reopen or permanently delete work and review completed versus unfinished items;
7. follow an optional reference to the actual project or work system;
8. retain all planning state under the selected personal Git repository and synchronize portable task data automatically when a Git remote is available;
9. install and configure Jig in a single guided script, including repository selection and a background service;
10. launch or reopen Jig through a simple `jig` desktop command, with fast idle-to-use interaction and a low background resource footprint.

## 5. Product principles

- **Date first:** every MVP task belongs to a calendar date.
- **Order is intent:** the operator's explicit ordering is authoritative over any priority-based suggestion.
- **Minimal input:** task title and date are sufficient to create a task. Everything else is optional/defaulted.
- **Unrestricted adaptation:** no approvals, fixed WIP rules, forced focus states, or automatic reordering of an established plan.
- **No duplicated authority:** the planning card refers outward; it does not try to reproduce Order, SPAN, Legal or other project artifacts.
- **History without ceremony:** completed work remains inspectable; unfinished work carries forward visibly until completed, explicitly rescheduled or deleted.
- **Simple deletion:** confirmed deletion removes the task from Jig rather than creating another lifecycle state. Recovery of previously exported states is delegated to Git history instead of an application trash, soft-delete or undo subsystem.
- **Portable ownership:** a user-selected Git repository contains Jig's local database and Git-tracked logical task records in an isolated Jig area; the software's source repository contains no personal task data.
- **Repository boundary:** Jig owns planning information and canonical snapshots, not Git topology. Repository history, branches, merges, conflicts and reconciliation are handled by Git tooling outside the Jig domain; Jig only reports whether repository synchronization succeeded, is pending, is unavailable, or has an operational issue.
- **Low-friction lifecycle:** one installer configures the repository, local executable and Linux user service; saves and normal Git synchronization are automatic rather than a repeated user chore.
- **Non-invasive coexistence:** Jig does not stage, commit, overwrite, merge or publish unrelated content in the selected repository.

## 6. Deliberate exclusions

Jig v1 is not a project manager, issue tracker, team board, time tracker, Pomodoro timer, task-execution agent, autonomous prioritizer, collaboration platform, Order lifecycle client, or Git history/conflict manager. It does not need Gantt charts, task dependencies, nested subtasks, mandatory time allocations, a full unscheduled backlog, a custom workflow builder, background/mobile push delivery, or direct Order integration.

A calendar *date* and optional reminder time are not a time-blocked calendar appointment.

## 7. Product acceptance criteria

A typical day must be managed through fast, low-friction actions: capture, arrange, carry forward unfinished work visibly, reschedule, finish, reopen, delete and review. The visible plan must always correspond to the saved plan. Reopening the app must preserve work order and completion. Missing external project details must never block creating or completing a Jig item.

No quantitative productivity/time-saving claim is established by this design baseline.

## 8. Downstream ownership

The [Planning and UX functional design](../requirements/planning-workbench.md) owns the exact user-visible behaviors. The [Technical solution design](../architecture/technical-solution.md) specifies the minimal runtime, storage and UI realization; it cannot add product features or weaken the functional contract.