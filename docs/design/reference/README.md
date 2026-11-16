# Jig canonical UI reference set

This package is a corrected reference-design baseline derived from the current Jig product definition and planning/UX functional design.

Key corrections encoded in the references:
- `Day` is the view/destination; `Today` is a shortcut.
- Earlier unfinished Tasks remain visible on later Day views with a subtle, scan-visible `Carried over · <origin date>` treatment while retaining their original scheduled date.
- `Reference` and `Notes` are separate Task fields.
- Drag handle and action menu are distinct affordances.
- Completion is represented on the selected day; there is no undocumented week-wide completed aggregate.
- Save truth and Git synchronization truth are visually distinct.
- `History` and `Settings / Sync` have explicit visual contracts.
- Existing Tasks expose confirmed permanent deletion; Jig has no trash/soft-delete/undo layer and relies on Git history for recovery when a prior exported version exists.
- Priority is visually secondary and never implies automatic resorting.
- The design is compact, low-chrome, title/date-first, and compatible with the stated Astryx Neutral direction.

These SVGs are structural design references rendered in light mode, not claims of pixel-perfect Astryx rendering or a light-only product. System/Light/Dark support is mandatory through Astryx Neutral semantic theming; duplicate dark-mode mockups are intentionally unnecessary. Final implementation must still be certified with browser screenshots and interaction tests in both Light and Dark.
