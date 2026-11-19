# Jig canonical UI reference set

## v1.1 governing references

The current forward v1.1 visual authority is:

- `jig-v1.1-application-ux-ui-governed-reference.html` — configured desktop/mobile application shell, compact bottom navigation + Planner FAB, temporal hierarchy, Planner density, History and Settings. This supersedes the old compact hamburger primary-navigation pattern.
- `jig-v1.1-mobile-ux-ui-governed-reference.html` — Android/narrow onboarding states and complete Task BottomSheet/Repeat composition.
- `jig-v1.1-desktop-onboarding-task-form-governed-reference.html` — desktop onboarding states and complete Drawer Task-form/Repeat composition.

Use these together with `../ui-solution.md`, `../brand-and-theme.md` and the UX-F0 fidelity audit. Current implementation screenshots are evidence only.

This directory contains the structural reference-design baseline for the current Jig product/functional/UI contracts.

## v1.0.3 governing references

The binding Planner references are:

- `desktop-planner-v1.0.3.svg` — no sidebar; Jig Home at left; the week range is page-centered with Previous/Today/Next directly underneath; Add task, History, Settings and synchronization state are integrated at right; seven fluid Planner tracks; desktop Task detail may overlay from the right without narrowing the board.
- `mobile-planner-v1.0.3.svg` — Jig/sync/hamburger application row; centered week range; Previous/Today/Next directly underneath; seven-date strip; selected-date outstanding list; prominent Add task action.
- `mobile-editor.svg` — retained only for the Task workspace field/content hierarchy; v1.0.3 presentation is BottomSheet from the bottom.
- `desktop-history.svg`, `desktop-settings-sync.svg`, `sync-failure-states.svg` — retained for History, Settings and save/sync-state content, subject to the v1.0.3 global-header/navigation rules.

## Superseded structural references

The older `desktop-week.svg`, `desktop-week-task-drawer.svg`, `desktop-day.svg` and `mobile-day.svg` remain historical design inputs only. They are not authority for navigation or responsive composition after v1.0.3.

They must not be used to reintroduce:

- Day or Week as destinations;
- a persistent desktop sidebar/SideNav;
- an AppShell mobile navigation drawer;
- a standalone Day completed section;
- a date range placed between Previous/Next buttons;
- a separate Move-to-date workspace;
- a right-side mobile Task Drawer;
- explanatory/meta copy such as “selected date view”, “Today is a shortcut”, “Your ordered plan”, or design-implementation notes.

## Governing interaction corrections

- Planner is the implicit/default Home. Jig product mark returns to it.
- History and Settings are the only secondary destinations.
- Previous/Next shift the displayed week and selected date exactly seven days.
- Today selects the current local date and the week containing it.
- Desktop date-column headers are the date selector; narrow/mobile uses the same seven dates in a strip.
- Task click/tap selects and inspects only.
- Desktop drag owns exact same-date/cross-date movement; Edit scheduled date owns non-drag rescheduling.
- Desktop Task workspace uses a non-modal right Drawer that overlays without reflowing the Planner.
- Narrow/mobile uses BottomSheet rising from the bottom.
- Configured narrow/mobile primary navigation is persistent bottom navigation for Planner/History/Settings; the historical hamburger primary-navigation model is superseded for v1.1.
- Configured narrow/mobile Planner Add is one bottom-end FAB above the navigation; healthy sync is visually subordinate in the top application bar.
- Add task initially requests title only and inherits selected/originating date/defaults.
- Completed Tasks leave Planner and live in History.
- Priority may use a restrained leading color accent for scanning, but priority remains non-color-readable and Normal is not visually dominant.
- Save truth and repository synchronization truth remain separate.

These SVGs govern product structure, hierarchy, density and genuine structural dimensions; they do not authorize overriding Astryx. Implementation must use pinned Astryx public shell/control/layout/workspace APIs first, then the smallest Jig-owned composition/CSS required for the Planner header, seven tracks, narrow composition and other product-specific geometry.

System/Light/Dark support remains mandatory through the governed Jig/Astryx theme. Final implementation requires browser interaction/geometry evidence **and explicit reviewed visual-fidelity evidence** against the current v1.1 references; screenshot capture by itself is not certification.
