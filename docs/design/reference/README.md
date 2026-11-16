# Jig canonical UI reference set

This package is a corrected reference-design baseline derived from the current Jig product definition and planning/UX functional design.

Key corrections encoded in the references:
- `Day` is the view/destination; `Today` is a shortcut.
- `Reference` and `Notes` are separate Task fields.
- Drag handle and action menu are distinct affordances.
- Completion is represented on the selected day; there is no undocumented week-wide completed aggregate.
- Save truth and Git synchronization truth are visually distinct.
- `History` and `Settings / Sync` have explicit visual contracts.
- No task-delete action is introduced.
- Priority is visually secondary and never implies automatic resorting.
- The design is compact, low-chrome, title/date-first, and compatible with the stated Astryx Neutral direction.

These SVGs are structural design references, not claims of pixel-perfect Astryx rendering. Final implementation must still be certified with browser screenshots and interaction tests.
