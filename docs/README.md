# Jig documentation

**Status:** Initial product baseline, 2026-11-16. The functional scope has been reviewed conversationally; technical architecture and production implementation remain undecided.

Jig is a lightweight, local-first, just-in-time daily planner. A Jig item is a dated intention or reminder, not the authoritative definition of the work it references. Jig helps the user get on track without making the plan rigid.

## Reading order and concern ownership

1. [Product definition](product/product-definition.md) — **product intent:** problem, job, scope, exclusions and MVP outcomes.
2. [Planning and UX functional design](requirements/planning-workbench.md) — **functional behavior:** week/day views, task data, priorities, drag-and-drop, reminders, completion, responsiveness and acceptance scenarios.
3. [Technical direction and Order UX reuse](architecture/technical-direction.md) — **technical decision agenda:** UI foundation reuse, local persistence, Git sync, portability, notifications and unresolved options.

The product definition governs intent; the functional design specifies observable behavior; technical design must implement both without redefining them. This is a small documentation baseline, not an invitation to copy Order's governance, lifecycle or architecture wholesale.

## Design validation status

The earlier mockups, originally labeled **Day**, were accepted as a functional UX starting point. Their layout illustrates date buckets, drag-and-drop ordering, a compact task editor and mobile-first recomposition. The app's established name is **Jig**. Mockup colors, branding, navigation duplication, illustrative dates and URLs are not canonical.

The visual foundation to validate is Order's current Astryx-based compact UI. Jig should reuse compatible public foundations and interaction patterns; the calendar-Kanban board itself is Jig-specific.

## Outstanding technical decisions

- Canonical local persistence and Git transfer/synchronization representation.
- Conflict resolution for edits from independently running devices.
- Desktop runtime/packaging and backup/recovery semantics.
- Evidence for actual reusability of Order's UI foundation and the minimum drag-and-drop implementation.
- Mobile runtime and Git support when independent phone installation becomes an implementation requirement.

Until those are resolved, [technical direction](architecture/technical-direction.md) is a constraint and evaluation document, not an implementation-ready architecture. Keep personal planning data separate from this public source repository.
