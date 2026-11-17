# Jig canonical UI reference set

This package is a corrected reference-design baseline derived from the current Jig product definition and planning/UX functional design.

Key corrections encoded in the references:
- Desktop primary navigation is compact and ordered **Day → Week → History → Settings**, with Astryx-owned semantic iconography.
- Week uses the available planning canvas with seven fluid day tracks (160px product minimum) rather than a fixed 1168px maximum.
- Clicking a Task never changes destination; it selects the Task and exposes the shared contextual Task workspace.
- Desktop Day docks that workspace on the right; Week and narrow/mobile use the public Astryx non-modal right Drawer so the underlying planning surface remains in context.
- Quick Add, per-day Add task, Edit and Move to date reuse the same Task workspace. Task creation/editing is not a centered modal; permanent Delete confirmation is the only blocking Task dialog.
- `Day` is the view/destination; `Today` is a shortcut.
- Earlier unfinished Tasks are persistently rolled into the current local date by changing their canonical `scheduled_date`; Day and Week therefore show the same moved Task in the current bucket with no derived carry-over label.
- `Reference` and `Notes` are separate Task fields.
- Drag handle and action menu are distinct affordances.
- Completion is represented on the selected day; there is no undocumented week-wide completed aggregate.
- Save truth and repository synchronization truth are visually distinct; repository failures appear only as a generic sync issue, never as a Jig-level Git divergence/conflict workflow.
- `History` and `Settings / Sync` have explicit visual contracts.
- Existing Tasks expose confirmed permanent deletion; Jig has no trash/soft-delete/undo layer and relies on Git history for recovery when a prior exported version exists.
- History is the governed lightweight completion record; the reference does not add context-filter or sort-control workflows that are absent from the product/functional/UI contracts.
- Failure-state surfaces do not add a standalone `Copy diagnostics` workflow; troubleshooting detail remains within the governed diagnostics/status boundary.
- Priority is visually secondary and never implies automatic resorting.
- The design is compact, low-chrome, title/date-first, and compatible with the stated Astryx Neutral direction.

These SVGs are structural design references rendered in light mode, not claims of pixel-perfect Astryx rendering or a light-only product. They govern product structure, hierarchy, density and genuine structural dimensions; they do not authorize overriding the UI library. Implementation must first use the pinned Astryx public shell/navigation/layout/component APIs, then add the smallest Jig-owned composition/CSS needed for product-specific geometry. Private Astryx selectors/custom properties, compensating cascade overrides and CSS reconstruction of the wrong semantic DOM are non-conforming even when a screenshot looks close.

System/Light/Dark support is mandatory through Astryx Neutral semantic theming; duplicate dark-mode mockups are intentionally unnecessary. Final implementation must still be certified with browser screenshots and interaction tests in both Light and Dark.
