# Jig documentation

**Status:** Initial product and decision-complete desktop technical baseline, 2026-11-16. Implementation is not yet built or certified.

Jig is a lightweight, local-first, just-in-time daily planner. A Jig item is a dated intention or reminder, not the authoritative definition of the work it references. Jig helps the user get on track without making the plan rigid.

## Reading order and concern ownership

1. [Product definition](product/product-definition.md) — **product intent:** problem, job, scope, exclusions and MVP outcomes.
2. [Planning and UX functional design](requirements/planning-workbench.md) — **functional behavior:** week/day views, task data, priorities, drag-and-drop, reminders, completion, responsiveness and acceptance scenarios.
3. [Technical solution design](architecture/technical-solution.md) — **technical realization:** exact dependencies, UI ownership, functional core, SQLite task authority, Git snapshot/fast-forward contract, notifications, local security and verification.

The product definition governs intent; the functional design specifies observable behavior; technical design must implement both without redefining them. This is a small documentation baseline, not an invitation to copy Order's governance, lifecycle or architecture wholesale.

## Design validation status

The earlier mockups, originally labeled **Day**, were accepted as a functional UX starting point. Their layout illustrates date buckets, drag-and-drop ordering, a compact task editor and mobile-first recomposition. The app's established name is **Jig**. Mockup colors, branding, navigation duplication, illustrative dates and URLs are not canonical.

The visual foundation to validate is Order's current Astryx-based compact UI. Jig should reuse compatible public foundations and interaction patterns; the calendar-Kanban board itself is Jig-specific.

## Design closure and verification boundary

The [technical solution](architecture/technical-solution.md) selects Bun, React, Astryx, dnd-kit, SQLite, and a private Git task-snapshot format, with safe sequential fast-forward synchronization. It explicitly defers independent phone installation and automatic merging of concurrent device edits. Those capabilities must not be claimed by the desktop MVP.

Next, derive a minimal implementation plan, then verify the exact dependency integration, task operations, crash recovery, Git transfer, and responsive/browser acceptance matrix. Keep personal planning data separate from this public source repository.
