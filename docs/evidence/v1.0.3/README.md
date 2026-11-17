# Jig v1.0.3 implementation evidence — single Planner

**Status:** Automated implementation certification **PASS**; reviewed screenshot capture remains open. Permanent verification passed for implementation candidate `a7a42f26695513ac13a658879b1b36f40cd56352` in GitHub Actions `Verify v1 implementation` run `44032488998`. Final reviewed screenshot capture is required before this evidence set is marked visually complete.

The earlier v1.0.3 master-detail screenshots certified a superseded Day/Week/SideNav design. They have been removed from the active evidence tree on this branch and remain available only through Git history. They are **not** acceptance evidence for the binding single-Planner design.

## Governing contracts

- [Planning workbench functional design](../../requirements/planning-workbench.md)
- [Technical solution](../../architecture/technical-solution.md)
- [UI solution](../../design/ui-solution.md)
- [v1.0.3 single Planner implementation plan](../../implementation/v1.0.3-single-planner-implementation-plan.md)
- [Desktop Planner structural reference](../../design/reference/desktop-planner-v1.0.3.svg)
- [Mobile Planner structural reference](../../design/reference/mobile-planner-v1.0.3.svg)

## Automated certification

**Result:** **PASS** on implementation candidate `a7a42f26695513ac13a658879b1b36f40cd56352`, workflow run `44032488998`.

The permanent workflow passed theme verification, typecheck, core/integration tests, production build, real-browser acceptance, shell syntax, and installer/lifecycle smoke.

Permanent gates are:

- `tests/architecture/ui-ownership.test.ts`;
- `tests/browser/ui-conformance.spec.ts`;
- `tests/browser/core-flow.spec.ts`;
- `tests/browser/interactions.spec.ts`;
- `tests/browser/day-boundary.spec.ts`;
- core/integration persistence, rollover, Git synchronization, installer and reminder suites.

The implementation branch must pass:

```bash
bun run theme:check
bun run typecheck
bun run test
bun run build
bun run test:browser
```

The browser contract specifically certifies:

- Planner is the default/home destination;
- no desktop SideNav and no AppShell mobile navigation drawer;
- History and Settings are the only secondary destinations;
- desktop week range is page-centered with Previous/Today/Next directly beneath it;
- Previous/Next preserve selected weekday while moving exactly seven civil days;
- Today restores current local date/current week;
- seven desktop tracks remain at least 160px and consume the available canvas without board scrolling;
- Task click/tap inspects and never moves;
- desktop Task view/create/edit uses a non-blocking right Drawer without narrowing the Planner board;
- narrow/mobile uses the same Planner state and a BottomSheet Task workspace;
- the mobile hamburger is an anchored popover containing only History and Settings;
- responsive Drawer/BottomSheet reflow preserves displayed week, selected date, Task workspace mode and unsaved draft;
- desktop drag owns exact direct movement and Move up/down remains the non-drag same-day alternative;
- Edit scheduled date owns explicit non-drag cross-date rescheduling;
- no separate Move-to-date surface exists;
- completing a Task removes it from Planner and keeps it inspectable/reopenable in History;
- local-midnight rollover and Planner selection continuity remain deterministic;
- permanent Delete confirmation remains the only blocking Task dialog;
- priority uses restrained theme-derived scanning cues without becoming the ordering authority;
- System/Light/Dark, local-save truth and repository-sync truth preserve their existing semantics.

## Required reviewed screenshot set

The final screenshot archive must be captured from the exact implementation candidate after all permanent gates pass.

| Required file | Viewport / state | Contract to review |
| --- | --- | --- |
| `browser/desktop-planner-light.jpg` | 1440×900, Light | centered week navigator, no sidebar, seven fluid tracks, global actions |
| `browser/desktop-planner-dark.jpg` | 1440×900, Dark | same hierarchy and state distinction in Dark |
| `browser/desktop-planner-task-drawer.jpg` | 1440×900 | right Drawer overlays without board reflow |
| `browser/desktop-planner-edit.jpg` | 1440×900 | Edit remains in the same right workspace |
| `browser/desktop-history.jpg` | 1440×900 | History active, same global header, completed Task master-detail |
| `browser/desktop-settings.jpg` | 1440×900 | Settings active, no Planner temporal controls |
| `browser/mobile-planner.jpg` | 390×844 | application band, centered week controls, seven-date strip, selected-date list |
| `browser/mobile-task-bottom-sheet.jpg` | 390×844 | Task workspace rises from bottom |
| `browser/sync-issue.jpg` | representative | synchronization issue remains operational, not Task-domain state |
| `browser/local-save-failure.jpg` | representative | failed local save is explicit and never claimed successful |

For every capture record:

- implementation commit SHA;
- viewport;
- appearance mode;
- fixture/scenario;
- governing reference;
- any intentional deviation caused by the real pinned Astryx component anatomy.

## Visual review criteria

Visual review is a **PASS** only when:

1. the centered week/date interaction reads as one temporal centerpiece;
2. left product identity and right actions do not pull the centerpiece off the page center;
3. the desktop board materially uses available width;
4. selected date, today, Task selection and drag target remain distinct without color-only meaning;
5. Task priority cues aid scanning without becoming dominant status badges;
6. the Drawer/BottomSheet feel contextual rather than modal/navigation replacements;
7. narrow/mobile does not recreate the removed sidebar/drawer navigation;
8. no meta copy such as “Week of”, “Attention”, “Your ordered plan”, “selected date view”, or implementation commentary appears;
9. Light and Dark preserve the same hierarchy and accessible state distinctions.

Until the reviewed screenshot set is captured, this README must not claim final visual certification. Automated gates remain the authoritative behavioral/architectural implementation evidence.
