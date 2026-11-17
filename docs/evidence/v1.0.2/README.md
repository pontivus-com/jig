# Jig v1.0.2 browser fidelity evidence

**Captured UI revision:** `0db714205cda9bc6287251939a064478ff50b147`  
**Capture/verification run:** GitHub Actions run #411 (`44001239505`)  
**Runner:** GitHub Actions / Ubuntu / pinned Bun 1.4.4 / pinned Playwright Chromium  
**Desktop viewport:** 1440 × 900  
**Mobile Day viewport:** 414 × 900  
**Mobile editor viewport:** 414 × 980  
**Captured:** 2026-11-17

This directory is the canonical v1.0.2 visual-fidelity evidence set. The screenshots were produced from the real Jig loopback service and production browser application. The temporary capture-only Playwright harness used to create this archive was removed after capture; the permanent architecture and browser-conformance suites remain the release gates.

## Evidence set

- [Desktop Week — Light](browser/desktop-week-light.jpg)
- [Desktop Week — Dark](browser/desktop-week-dark.jpg)
- [Desktop Day — persisted rollover](browser/desktop-day-rollover.jpg)
- [Desktop Day — selected-task inspector](browser/desktop-day-inspector.jpg)
- [Desktop History](browser/desktop-history.jpg)
- [Desktop Settings](browser/desktop-settings.jpg)
- [Mobile Day](browser/mobile-day.jpg)
- [Mobile editor](browser/mobile-editor.jpg)
- [Repository synchronization issue](browser/sync-issue.jpg)
- [Local-save failure](browser/local-save-failure.jpg)

## Governing references

The implementation was reviewed against:

- `docs/design/reference/desktop-week.svg`
- `docs/design/reference/desktop-day.svg`
- `docs/design/reference/desktop-history.svg`
- `docs/design/reference/desktop-settings-sync.svg`
- `docs/design/reference/mobile-day.svg`
- `docs/design/reference/mobile-editor.svg`
- `docs/design/reference/sync-failure-states.svg`
- `docs/design/ui-solution.md`
- `docs/design/brand-and-theme.md`
- `docs/design/ui-ux-conformance-audit-v1.0.md`
- `docs/implementation/ui-ux-conformance-remediation-v1.0.md`

The SVGs govern structure, hierarchy, density and representative visual character. Canonical Jig brand/theme documentation governs production color and supporting copy when the illustrative SVGs differ.

## Fidelity verdict

**PASS — the current implementation conforms to the governed reference design without architecture exceptions.**

Verified structural budgets include:

- desktop application inset: 20 px;
- desktop navigation rail: 190 px, with approximately 30 px rail/content separation;
- Week: seven visible approximately 160 px columns with 8 px gaps at 1440 × 900;
- Day: approximately 650 px planning region + 30 px gap + 490 px inspector;
- Settings: 560 px / 580 px two-column composition;
- mobile shell: x=12, width=390 at 414 px viewport;
- mobile first date: approximately x=26, y=108, width=44, height=56;
- mobile Quick Add: x=318, y=803, width=62, height=52;
- mobile editor frame: x=12, y=12, width=390, height=956.

The review also verified hierarchy and density that geometry alone cannot prove: compact Week cards, low-chrome empty Week columns, active/completed Day density, History date/count hierarchy, Settings panel semantics, mobile Day card rhythm, editor field order, destructive-action placement, and the Cancel/Save footer.

## Intentional design-system variance

Astryx 0.7.13 remains the authoritative owner of published component mechanics. The implementation therefore does **not** override Astryx internals to reproduce incidental SVG pixels.

The principal accepted variance is the mobile editor footer: the SVG depicts approximately 46 px-high action buttons, while Astryx's public `lg` Button size is 36 px. The implementation uses the public Astryx size and preserves the governed footer position, width ratio and hierarchy rather than forcing a private component height.

The production amber selection/accent treatment is also intentional: the canonical Jig theme supersedes the older reference-blue treatment without changing the layout contract.

## Reference-authority corrections made during review

The reference set itself contained stale or contradictory details. These were corrected before judging implementation fidelity:

- obsolete `Just-in-time planning` supporting copy was replaced by canonical `Schedules attention`;
- Settings diagnostics were aligned to the governed shell contract: Jig service, Local database and Portable data health;
- no invented `Run diagnostics` action was added because the shell contract owns no such workflow.

Where the corrected Settings SVG contains illustrative vertical coordinates that cannot be treated simultaneously as literal geometry, `ui-solution.md` topology and the governed 560/580 split take precedence. No compensating CSS was introduced.

## Architecture gate

Visual fidelity is not permitted to waive architectural ownership. The final implementation was checked to retain:

- Astryx `AppShell` as sole shell owner;
- Astryx `SideNav` / `SideNavItem` as navigation owner;
- `useAppShellMobile()` as the sole responsive-layout authority;
- explicit desktop/narrow React composition rather than duplicate DOM plus CSS hiding;
- Astryx `DropdownMenu`, Dialog, List, FieldLabel, SegmentedControl and Button public contracts;
- no `.astryx-*` selectors;
- no private `--_*` variables;
- no `!important`;
- no application `@layer jig` override layer;
- no negative-margin/transform screenshot alignment;
- no reintroduced custom task-menu or mobile-navigation subsystem.

These invariants are enforced by `tests/architecture/ui-ownership.test.ts` and the permanent browser-conformance suite.

## Failure-state evidence

The sync-issue and local-save-failure screenshots use browser interception of the existing HTTP contracts solely to place the production UI into deterministic failure states. No production failure model, persistence behavior or synchronization behavior was added for screenshot reproduction.

The rollover screenshot uses the real application rollover path and verifies that an overdue Task is persisted onto the current date before capture.
