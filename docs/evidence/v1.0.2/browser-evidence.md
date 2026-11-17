# Jig v1.0.2 browser fidelity evidence

**Captured from revision:** `25f38d79a9a2aecce04999f0715c0d7edbc4197b`  
**Evidence archive commit:** `f7624eff520f0ecd2b0da7c4966fe78ee1906c4c`  
**Runner:** GitHub Actions / Ubuntu / pinned Bun 1.4.4 / pinned Playwright Chromium  
**Canonical desktop viewport:** 1440 × 900  
**Canonical mobile viewport:** 414 px wide  
**Captured:** 2026-11-17

These screenshots were generated from the real Jig loopback service and browser application after the v1.0.2 UX/UI remediation. The temporary capture workflow and capture-only Playwright spec were removed after review; the permanent browser acceptance suite remains the release gate.

## Reviewed screens

- [Desktop Week — Light](browser/desktop-week-light.jpg)
- [Desktop Week — Dark](browser/desktop-week-dark.jpg)
- [Desktop Day — Light](browser/desktop-day-light.jpg)
- [Desktop History — Light](browser/desktop-history-light.jpg)
- [Desktop Settings — Light](browser/desktop-settings-light.jpg)
- [Mobile Day — Light](browser/mobile-day-light.jpg)
- [Mobile editor — Light](browser/mobile-editor-light.jpg)

## Governing references

The screenshots were reviewed against:

- `docs/design/reference/desktop-week.svg`
- `docs/design/reference/desktop-day.svg`
- `docs/design/reference/desktop-history.svg`
- `docs/design/reference/desktop-settings-sync.svg`
- `docs/design/reference/mobile-day.svg`
- `docs/design/reference/mobile-editor.svg`
- `docs/design/reference/sync-failure-states.svg`

The SVGs govern structure, hierarchy, density and representative visual character. Production color remains governed by the canonical Jig theme, so the production amber accent replaces the older reference-blue selection treatment without changing the layout contract.

## Fidelity result

The final reviewed implementation retains the canonical reference geometry and interaction hierarchy:

- inset 190 px desktop rail and approximately 30 px content separation;
- separate screen heading/status and local toolbar layers;
- seven visible Week columns with compact cards and bottom Add affordances;
- date-first Day composition with 650 px planning list, 30 px gap and 490 px selected-Task inspector;
- low-chrome completion History;
- two-column Settings composition with Planning data, Synchronization, Appearance and Diagnostics;
- compact 414 px mobile Day composition with seven-date strip and persistent Quick Add;
- mobile Task editor with the canonical field order, date-change behavior note, destructive action, and Cancel/Save footer;
- Light/Dark parity using the canonical Jig theme.

Fixture Task content is synthetic and exists only to demonstrate the production UI states. No product behavior was added solely for screenshot reproduction.
