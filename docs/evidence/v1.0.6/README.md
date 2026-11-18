# Jig v1.0.6 implementation evidence

**Status:** PASS — the complete v1.0.6 presentation/browser implementation satisfies JIG-106-FR-01…07 / JIG-106-SD-01…07 / J106-IMP-01…08.  
**Implementation branch:** `fix/v1.0.6-history-settings-width`  
**Implementation PR:** #25  
**Product-code/test candidate:** `9d02fad799348b17a3e65297b36b1be23a40df06`  
**Permanent Verify run:** `44213103554` — PASS  
**Verify job:** `134496116337`  
**Package version on implementation branch:** `1.0.5`

The v1.0.6 package-version transition is intentionally **not** part of this implementation branch. Version `1.0.6` belongs only to the later governed `release/v1.0.6` metadata transition after implementation merges to `master`.

## Certification result

Permanent Verify run `44213103554` passed on exact product/test candidate `9d02fad799348b17a3e65297b36b1be23a40df06`:

- exact frozen dependency installation;
- PR release-metadata guard;
- release-tool compilation;
- exhaustive Astryx theme artifact drift check;
- strict TypeScript typecheck;
- core/integration/architecture tests — **18 test files / 107 tests passed**;
- production Vite build;
- real-browser Playwright acceptance — **55 tests passed**;
- shell syntax;
- installer and lifecycle smoke.

## JIG-106 requirement closure

| Functional requirement | Certified implementation result |
|---|---|
| JIG-106-FR-01 | History and Settings follow one continuous `min(available width, 50rem)` measure; the 73rem Planner breakpoint never removes the cap; Planner remains full-width and Settings grid reflow remains independent. |
| JIG-106-FR-02 | One typed catalogue exposes **14 complete application themes**: Jig; Astryx Neutral, Butter, Chocolate, Gothic, Matcha, Stone and Y2K; Gruvbox, Dracula, Solarized, Nord, Catppuccin and Tokyo Night. Every authored/wrapper theme is compiled through pinned Astryx 0.7.13 and checked for source/artifact drift. |
| JIG-106-FR-03 | `ThemePreset` and `AppearanceMode = system | light | dark` are independent browser-local presentation state. System is resolved by the single root Astryx Theme and responds live to platform preference changes without remounting or mutating Planner/workspace state. Legacy, invalid and persistence-failure behavior is permanently tested. |
| JIG-106-FR-04 | All 14 themes implement the shared Jig/Astryx semantic contract for surfaces, text/icons, borders, interaction, today, Task selection, drag, priority, completion and repository status. Permanent tests certify text/status contrast, Task/canvas separation, actual Settings/menu/workspace/dialog theme scope and combined selected+priority, selected+keyboard-focus and drag+priority ownership. |
| JIG-106-FR-05 | Application chrome uses one canonical inline Jig wordmark geometry whose primary/accent paint resolves from the active theme. Fixed favicon/app/release assets remain theme-independent. |
| JIG-106-FR-06 | Reminder delivery uses browser/OS Notification only when permission is granted, regardless of visibility/focus. Permanent tests cover granted visible/hidden/focus behavior, default/denied/unsupported capability, duplicate suppression and constructor-failure retry-before-marking. No reminder Toast path remains. |
| JIG-106-FR-07 | Theme and System/Light/Dark controls exist only under Settings → Appearance; the Theme Selector is registry-derived with exactly 14 options and no Planner/header/Task/History quick toggle exists. |

## Theme certification

The permanent browser matrix exercises every shipped Theme preset in forced Light and Dark and in System under both platform preferences. It changes the platform preference while the same System-mode application remains mounted.

### Astryx Gothic

Pinned `@astryxdesign/theme-gothic@0.7.13` explicitly defines its upstream application theme as dark-only. The governed Jig catalogue nevertheless requires Gothic and FR-03 requires every selectable theme to provide coherent Light and Dark.

The certified `astryx-gothic` wrapper therefore:

- extends the pinned Gothic built theme through public Astryx `defineTheme()`;
- retains upstream Gothic typography, motion, component overrides, icons and Dark semantic colors;
- supplies a bounded Light application-color layer from Gothic's published semantic/palette anchors;
- keeps one compiled Astryx theme object and the ordinary independent `System | Light | Dark` mode;
- does **not** introduce runtime inversion, feature-level Gothic branches, a second theme engine or private Astryx integration.

Gothic Light/Dark/System passed the same Task/canvas, text, status, brand and live-System browser checks as every other preset.

### Community palettes

Community palettes are adapted only where an upstream color cannot satisfy the governed application semantic role:

- **Solarized:** Light strong status inputs are shaded toward `base03`; Dark information/error strong roles are lifted toward `base1` to satisfy content contrast while preserving Solarized hue families.
- **Nord:** Light success and Dark error status inputs receive minimal application-role adjustments to clear the 4.5:1 strong-fill floor; named Nord Green/Red families remain separate.
- **Catppuccin Latte:** success/warning strong-role inputs are blended toward Latte text; named Green/Yellow remain canonical.
- **Tokyo Night Day:** information/success/warning strong-role inputs are shaded toward the Night/body anchor; named Blue/Green/Yellow remain canonical.

These adaptations are theme-authoring semantics, not feature-level palette overrides. Community source provenance/licensing is recorded in `THIRD_PARTY_NOTICES.md`.

## Architecture evidence

The implementation preserves the governed architecture:

- **Functional core / imperative shell:** the PR changes no file under `src/core`, `src/shell` or the protocol authority; Task/planning, SQLite, HTTP, repository and Git synchronization semantics are unchanged.
- **One theme owner:** one root Astryx `Theme`; no JavaScript resolved-mode engine and no per-feature theme state.
- **One catalogue/state owner:** one typed appearance module owns ThemePreset, AppearanceMode, registry, guards and local persistence.
- **Semantic DRY:** feature CSS consumes shared product/Astryx semantic roles and does not branch by theme name.
- **Strict typing:** no DTO/ViewModel hierarchy, service/repository stack or second state framework was introduced.
- **Astryx boundary:** authored themes use public Astryx theme APIs and pinned CLI-generated artifacts; no private Astryx DOM/CSS integration or hand-authored compiler marker exists.
- **Notification boundary:** browser capability/permission remains externally owned; Jig owns eligibility and a narrow browser Notification invocation only.
- **No release pollution:** `package.json.version` remains 1.0.5 and this evidence does not claim v1.0.6 is published.

## Permanent browser acceptance highlights

The 55-test Chromium suite includes:

- 1440/1168/1167/1024/900/800/600/390 History/Settings geometry with no 73rem width discontinuity;
- all 14 presets in forced Light/Dark and System Light→Dark live switching;
- Task/canvas separation and 4.5:1 text/status checks;
- theme-aware Jig wordmark contrast;
- semantic propagation into Settings, menu portal, Task workspace and destructive dialog;
- selected+priority, selected+keyboard-focus and drag+priority coexistence;
- exact 14-option Settings catalogue and Settings-only placement;
- invalid/legacy/localStorage-failure appearance behavior;
- browser Notification-only reminder delivery across visibility/focus/permission/failure/deduplication cases;
- the published v1.0.5 Planner/drag/responsive/workspace regressions.

## Release boundary

This evidence certifies the implementation candidate only. It is **not** evidence that v1.0.6 has been released. Release publication must still follow `docs/releases/README.md` on a dedicated `release/v1.0.6` branch after this implementation merges to `master`.
