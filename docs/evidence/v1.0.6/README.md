# Jig v1.0.6 implementation evidence

**Status:** PASS — the architecture-remediated v1.0.6 presentation/browser implementation satisfies JIG-106-FR-01…07 / JIG-106-SD-01…07 / J106-IMP-01…08 and the repository rules in `AGENTS.md`.  
**Implementation branch:** `fix/v1.0.6-history-settings-width`  
**Implementation PR:** #25  
**Product-code/test candidate:** `79779bcbfc759f5043e7cc1cbd31c8e863ed564f`  
**Permanent Verify run:** `44216569314` — PASS  
**Verify job:** `134507759495`  
**Package version on implementation branch:** `1.0.5`

The v1.0.6 package-version transition is intentionally **not** part of this implementation branch. Version `1.0.6` belongs only to the later governed `release/v1.0.6` metadata transition after implementation merges to `master`.

## Certification result

Permanent Verify run `44216569314` passed on exact product/test candidate `79779bcbfc759f5043e7cc1cbd31c8e863ed564f`:

- exact frozen dependency installation;
- ordinary-PR release-metadata guard;
- release-tool compilation;
- exhaustive Astryx theme artifact drift check;
- strict TypeScript typecheck;
- core/integration/architecture tests — **18 test files / 107 tests passed**;
- production Vite build;
- real-browser Playwright acceptance — **55 tests passed**;
- shell syntax;
- installer and lifecycle smoke.

## Architectural compliance review

The review identified and corrected one material authority violation before release:

- the prior implementation exposed a fourteenth `astryx-gothic` preset and added `@astryxdesign/theme-gothic`;
- JIG-106-FR-02 and `AGENTS.md` instead govern exactly thirteen selectable v1.0.6 themes and explicitly exclude pinned Astryx Gothic 0.7.13 because it is dark-only;
- the non-governed dependency, registry entry, source, generated artifacts, font/theme CSS imports and test expectation were removed;
- the technical/UI/brand/implementation documents were restored to the same functional authority;
- a permanent architecture assertion now rejects Gothic re-entry into the v1.0.6 registry, build manifest, stylesheet imports or package dependency graph.

No functional requirement was rewritten to justify the implementation. The implementation was changed to match its governing requirement.

## JIG-106 requirement closure

| Functional requirement | Certified implementation result |
|---|---|
| JIG-106-FR-01 | History and Settings follow one continuous `min(available width, 50rem)` measure; the 73rem Planner breakpoint never removes the cap; Planner remains full-width and Settings grid reflow remains independent. |
| JIG-106-FR-02 | One typed catalogue exposes exactly **13 complete dual-mode application themes**: Jig; Astryx Neutral, Butter, Chocolate, Matcha, Stone and Y2K; Gruvbox, Dracula, Solarized, Nord, Catppuccin and Tokyo Night. Pinned Astryx Gothic is not selectable. Every authored/wrapper theme is compiled through pinned Astryx 0.7.13 and checked for source/artifact drift. |
| JIG-106-FR-03 | `ThemePreset` and `AppearanceMode = system | light | dark` are independent browser-local presentation state. System is resolved by the single root Astryx Theme and responds live to platform preference changes without mutating Planner/workspace state. Legacy, invalid and persistence-failure behavior is permanently tested. |
| JIG-106-FR-04 | All 13 themes implement the shared Jig/Astryx semantic contract for surfaces, text/icons, borders, interaction, today, Task selection, drag, priority, completion and repository status. Permanent tests certify text/status contrast, Task/canvas separation, actual Settings/menu/workspace/dialog theme scope and combined selected+priority, selected+keyboard-focus and drag+priority ownership. |
| JIG-106-FR-05 | Application chrome uses one canonical inline Jig wordmark geometry whose primary/accent paint resolves from the active theme. Fixed favicon/app/release assets remain theme-independent. |
| JIG-106-FR-06 | Reminder delivery uses browser/OS Notification only when permission is granted, regardless of visibility/focus. Permanent tests cover granted visible/hidden/focus behavior, default/denied/unsupported capability, duplicate suppression and constructor-failure retry-before-marking. No reminder Toast path remains. |
| JIG-106-FR-07 | Theme and System/Light/Dark controls exist only under Settings → Appearance; the Theme Selector is registry-derived with exactly 13 options and no Planner/header/Task/History quick toggle exists. |

## Architecture evidence

The implementation preserves the governed architecture:

- **Functional core / imperative shell:** the PR changes no file under `src/core`, `src/shell` or protocol authority; Task/planning, SQLite, HTTP, repository and Git synchronization semantics are unchanged.
- **One theme owner:** one root Astryx `Theme`; no JavaScript resolved-mode engine and no per-feature theme state.
- **One catalogue/state owner:** one typed appearance module owns ThemePreset, AppearanceMode, registry, guards and local persistence; Settings derives its options from that registry.
- **Semantic DRY:** feature CSS consumes shared product/Astryx semantic roles and does not branch by theme name.
- **Strict typing:** the changed authored UI contains no `any`, double casts, non-null assertions used as compiler workarounds, DTO/ViewModel hierarchy, service/repository stack or second state framework.
- **Astryx boundary:** authored themes use public Astryx theme APIs and pinned CLI-generated artifacts; there is no private Astryx DOM/CSS integration, `!important`, authored `__built` marker or application-owned theme compiler.
- **Interaction ownership:** reusable controls remain Astryx-owned; the changes introduce no raw replacement Button/Link control system.
- **Notification boundary:** browser capability/permission remains externally owned; Jig owns reminder eligibility and a narrow browser Notification invocation only.
- **No release pollution:** `package.json.version` remains 1.0.5 and this evidence does not claim v1.0.6 is published.

## Permanent browser acceptance highlights

The 55-test Chromium suite includes:

- 1440/1168/1167/1024/900/800/600/390 History/Settings geometry with no 73rem width discontinuity;
- all 13 presets in forced Light/Dark and System Light→Dark live switching;
- Task/canvas separation and 4.5:1 text/status checks;
- theme-aware Jig wordmark contrast;
- semantic propagation into Settings, menu portal, Task workspace and destructive dialog;
- selected+priority, selected+keyboard-focus and drag+priority coexistence;
- exact 13-option Settings catalogue and Settings-only placement;
- invalid/legacy/localStorage-failure appearance behavior;
- browser Notification-only reminder delivery across visibility/focus/permission/failure/deduplication cases;
- the published v1.0.5 Planner/drag/responsive/workspace regressions.

## Release boundary

This evidence certifies the implementation candidate only. It is **not** evidence that v1.0.6 has been released. Release publication must follow `docs/releases/README.md` on a dedicated `release/v1.0.6` branch after this implementation merges to `master`.
