# Jig brand and theme system

**Status:** Canonical v1.0.4 brand and application-theme contract, amended 2026-11-17 with the Astryx-first CSS ownership rule and the v1.0.4 product-state color vocabulary.  
**Selected identity:** Option A — precise J guide + alignment pin.  
**Scope:** Logo geometry, brand palette, Light/Dark semantic theming, application integration, asset dimensions and change control.  
**Governing product identity:** [Product identity](../product/product-identity.md).  
**Governing UI:** [UI solution](ui-solution.md).

This document is the single human-readable authority for Jig branding and theming. The executable authorities are:

- `ui/src/theme.css` — canonical raw Jig palette primitives;
- `ui/src/jig-theme.source.ts` — the only authored mapping from those primitives into Astryx semantic roles;
- `ui/src/jig.js`, `ui/src/jig.css` and their declarations — compiler-owned artifacts produced by pinned `@astryxdesign/cli@0.7.13` from that source;
- `ui/src/styles.css` — layout/composition only; it imports the generated Jig theme CSS, consumes semantic Astryx tokens and must not introduce a second color system;
- `ui/src/app.tsx` — the single application `<Theme theme={jigTheme}>` owner, consuming the generated `jigTheme` module.

No feature component owns a private palette.

## 1. Identity

### Product name

**Jig**

### Primary proposition

**Plan the day. Stay on track.**

### Supporting line

**Jig schedules attention, not project execution.**

### Wordmark and icon

The canonical **wordmark is one complete word: Jig**.

Its first letter is the branded **J-shaped guide** with one **amber alignment pin**. The wordmark then adds only the outlined suffix **ig**. The construction is therefore:

**[branded J] + ig = Jig**

Never place the J icon next to a second complete “Jig” word. That duplicates the first letter and is not a valid Jig logo.

The standalone **icon is the J-shaped guide only**, retaining the amber alignment pin in full-colour variants.

The metaphor is functional: a jig guides something into the right position without becoming the work itself. Jig guides attention into the day without becoming the project-management system that owns the underlying work.

The J geometry and the outlined **ig** suffix must not be redrawn per surface. All variants use the same geometry.

## 2. Canonical brand foundations

The identity uses three related tonal scales:

1. **Ink** — structure, typography, dark surfaces and the cool complement to Amber.
2. **Amber** — identity, primary action, keyboard/pointer focus and transient direct-manipulation emphasis. Amber is **not** the generic persistent-selection color.
3. **Paper** — warm Light-mode layering.

White remains an explicit utility color.

### Ink

| Stop | Hex |
| ---: | --- |
| 50 | `#F9FAFD` |
| 100 | `#EFF2F7` |
| 200 | `#DCE1EB` |
| 300 | `#C0C8D6` |
| 400 | `#9BA5B8` |
| 500 | `#788499` |
| 600 | `#5A667E` |
| 700 | `#3E4A62` |
| 800 | `#253046` |
| 900 | `#162034` |
| 950 | **`#0B1426`** |

### Amber

| Stop | Hex |
| ---: | --- |
| 50 | `#FEF3E7` |
| 100 | `#FEE3C5` |
| 200 | `#FBCA93` |
| 300 | `#FAB45F` |
| 400 | `#F9A733` |
| 500 | **`#F59E0B`** |
| 600 | `#D28412` |
| 700 | `#B86C00` |
| 800 | `#8E5200` |
| 900 | `#683B01` |
| 950 | `#442603` |

### Paper

| Stop | Hex |
| ---: | --- |
| 50 | `#FDFCF9` |
| 100 | **`#F7F4EF`** |
| 200 | `#EBE7E1` |
| 300 | `#D8D3CC` |
| 400 | `#BCB7AE` |
| 500 | `#9A948A` |
| 600 | `#7A7469` |
| 700 | `#5B544A` |
| 800 | `#3D372E` |
| 900 | `#25211A` |
| 950 | `#14110C` |

### Brand anchors

- Ink Navy: **`#0B1426`**
- Brand Amber: **`#F59E0B`**
- Warm Paper: **`#F7F4EF`**
- White: **`#FFFFFF`**

Ink and Amber are already near-complementary in hue. Do not add another decorative brand hue merely to make the interface more colorful.

## 3. Accessibility and functional Amber

Brand Amber `#F59E0B` is the logo pin and the preferred Dark-mode accent. It is intentionally **not** the universal Light-mode interactive fill because it has insufficient separation from white for several UI roles.

Required reference contrasts:

| Pair | Contrast |
| --- | ---: |
| Ink 950 on Paper 100 | 16.76:1 |
| Ink 600 on Paper 100 | 5.26:1 |
| Amber 700 on white | 4.05:1 |
| Amber 700 on Paper 100 | 3.69:1 |
| Ink 950 on Amber 700 | 4.54:1 |
| Brand Amber 500 on Ink 950 | 8.56:1 |
| Ink 300 on Ink 950 | 10.92:1 |

Therefore:

- Light-mode functional accent/focus: **Amber 700 `#B86C00`**
- Light-mode accent text: **Amber 800 `#8E5200`**
- Dark-mode functional accent/focus: **Amber 500 `#F59E0B`**
- Dark-mode accent text: **Amber 300 `#FAB45F`**
- Text on an Amber fill: **Ink 950 `#0B1426`**

Color never replaces labels, icons, focus geometry or state text.

## 4. Light-mode semantic map

| Semantic role | Jig value |
| --- | --- |
| Page/body | Paper 100 |
| Surface/card/popover | White |
| Muted surface | Paper 200 |
| Primary text/icon | Ink 950 |
| Secondary text/icon | Ink 600 |
| Disabled text/icon | Ink 400 |
| Border | low-alpha Ink 950 |
| Emphasized border | Ink 200 |
| Primary accent | Amber 700 |
| Accent text | Amber 800 |
| Accent-muted/transient interaction | Amber 100 |
| Content on accent | Ink 950 |
| Focus ring | Amber 700 |

Light mode should read as warm, quiet and high-clarity. Amber is selective emphasis, not a page fill.

## 5. Dark-mode semantic map

| Semantic role | Jig value |
| --- | --- |
| Page/body | Ink 950 |
| Surface/card | Ink 900 |
| Raised/popover | Ink 800 |
| Primary text/icon | Ink 50 |
| Secondary text/icon | Ink 300 |
| Disabled text/icon | Ink 600 |
| Border | low-alpha White |
| Emphasized border | Ink 700 |
| Primary accent | Amber 500 |
| Accent text | Amber 300 |
| Accent-muted/transient interaction | Amber 500 mixed into Ink 900 |
| Content on accent | Ink 950 |
| Focus ring | Amber 500 |

Dark mode is not a mechanical inversion of Light mode. Layer elevation moves upward through the Ink scale while Amber becomes brighter.

## 6. Status colors

Brand color and semantic status color are separate systems.

Jig inherits Astryx Neutral 0.7.13 status families for:

- info;
- success;
- warning;
- error.

Do not remap warning to brand Amber. A sync warning, save error or success state must remain semantically distinct from ordinary Jig selection/focus.

## 6.1 v1.0.4 product-state color vocabulary

Persistent product state, transient interaction state, priority and operational status are separate semantic planes. They must not all resolve to Amber.

| State | Semantic family | Required treatment | Must not use |
|---|---|---|---|
| Primary action / keyboard focus | Brand Amber | primary control fill/text as governed by Astryx; focus ring uses Amber | status colors |
| Drag source / drop target | Brand Amber | transient outline/drag overlay emphasis only; disappears when drag ends | persistent selected-card fill |
| Desktop current day | Ink / neutral structure | exact-date-only emphasized neutral border/header typography; no whole-column Amber fill | Amber selected-column treatment |
| Desktop selected Planner date | no persistent column color | selection remains Planner state for Add/navigation but does not color an entire desktop column | any “same weekday every week” highlight |
| Narrow/mobile selected date | compact navigation selection | selected date chip may use the ordinary controlled accent treatment because the date strip is the active navigation control; exact today remains independently identifiable | whole-list/column fill |
| Selected Task card | cool Ink/neutral selection | subtle cool neutral surface plus emphasized neutral border; focus ring remains separately Amber when keyboard-focused | Amber fill/border as the persistent selection state |
| Priority High | semantic error | narrow leading error cue; optional restrained error label | Amber/warning |
| Priority Normal | Ink / neutral | narrow quiet neutral cue; no loud badge | Amber |
| Priority Low | semantic success / calm | narrow success-family cue; optional restrained label | info/Amber |
| Completed Task | neutral content + success completion affordance | title/content may be subdued; completion check may use success semantics | success-filled whole row |
| Active History/Settings navigation | neutral selection | quiet neutral surface/border or text weight; no dominant Amber fill | selected-Task color as a full surface |
| Local only | semantic success | restrained success family with explicit `Local only` label | neutral/unknown grey |
| Synced | semantic success | restrained success family with explicit `Synced` label | Local-only label substitution |
| Pending / retrying | semantic warning | warning family | brand Amber |
| Sync/save failure | semantic error | error family | brand Amber |
| Unknown operational status | neutral | secondary/neutral grey | success/warning/error |

The visual system therefore reads as **Amber + cool Ink structure + semantic status colors**, not as a collection of unrelated hues. The cool Ink family is Amber's existing brand complement and is the default persistent-selection family.

The generic Astryx accent/selected mechanics may still be used inside contained controls such as buttons, segmented controls and focus rings. Jig-owned **persistent product selections** (Task cards, desktop date structure and active destination chrome) must follow the table above rather than mapping every selected state to `--color-accent` / `--color-accent-muted`.



## 7. Theme implementation contract

### Palette ownership

`ui/src/theme.css` owns every raw `--jig-ink-*`, `--jig-amber-*`, `--jig-paper-*` and `--jig-white` value.

No other application stylesheet may hard-code Jig brand colors.

### Semantic mapping

`ui/src/jig-theme.source.ts` defines the authored Jig theme by extending `@astryxdesign/theme-neutral/built` and maps Jig primitives only into public semantic roles such as:

- `--color-background-*`;
- `--color-text-*`;
- `--color-icon-*`;
- `--color-accent`;
- `--color-accent-muted`;
- `--color-on-accent`;
- `--color-border*`;
- `--focus-outline-color`.

Astryx continues to own spacing, sizing, typography mechanics, component structure, status families and interaction semantics.

### CSS composition and theme build

The custom theme follows Astryx's documented production path:

1. author semantic mapping only in `ui/src/jig-theme.source.ts`;
2. compile it with pinned `@astryxdesign/cli@0.7.13` using `astryx theme build`;
3. commit the generated `ui/src/jig.js`, `ui/src/jig.css` and declaration files;
4. import `jigTheme` only from the generated module at runtime;
5. run `bun run theme:check` in CI, which delegates to `astryx theme build --check` and fails on stale generated artifacts.

Jig must not hand-write Astryx's internal `__built` marker, call internal/private theme machinery, or substitute an application-owned theme compiler. The generated files may contain Astryx internal implementation data because Astryx owns those files; Jig-authored source may not depend on that data.

`ui/src/styles.css` preserves the published stylesheet order:

1. Astryx reset;
2. Astryx core;
3. Jig palette primitives;
4. compiler-generated Jig theme CSS;
5. Jig-owned composition rules.

That ordering establishes the library/theme foundation; it is **not** permission for Jig to create a competing override layer.

Jig CSS follows these rules:

- style only Jig-owned composition and root classes supplied intentionally by Jig;
- consume public Astryx semantic, spacing, radius and typography tokens;
- never target undocumented Astryx descendants, generated StyleX structure or private custom properties;
- never add a Jig high-priority cascade layer, `!important`, or selector escalation to reshape an Astryx component;
- use explicit pixel values only for governed product-level structural budgets; use Astryx tokens/public props for ordinary interior spacing, radii, typography and control sizing;
- keep each layout property under one rule owner and delete superseded declarations rather than cancelling them with later overrides;
- use CSS media queries for pure reflow/density only; when the semantic hierarchy differs between desktop and narrow layouts, React/AppShell composition changes at the one application breakpoint.

There is no per-screen color palette, no Light/Dark duplication in feature CSS and no second styling architecture beside Astryx.

### Theme owner

`ui/src/app.tsx` mounts exactly one root:

```tsx
<Theme theme={jigTheme} mode={themePreference}>
```

System, Light and Dark remain presentation-only Settings choices.

## 8. Logo and icon asset contract

The master mark uses a 64×64 coordinate system. Its visible geometry is optically centered with approximately 7.5 units of horizontal clear space and 5.5 units of vertical clear space.

The horizontal wordmark uses the canonical J mark as the actual first letter and an outlined **ig** suffix. **No released logo repeats the J, and no released logo depends on a locally installed font.**

| Asset | Canvas / viewBox | Background | Intended use |
| --- | --- | --- | --- |
| `jig-symbol.svg` | 64×64 | transparent | full-color mark on light surfaces |
| `jig-symbol-on-dark.svg` | 64×64 | transparent | full-color mark on dark surfaces |
| `jig-icon.svg` | 64×64 | transparent | canonical icon alias |
| `jig-symbol-mono-dark.svg` | 64×64 | transparent | one-color dark mark |
| `jig-symbol-mono-light.svg` | 64×64 | transparent | one-color light mark |
| `jig-app-icon.svg` | 512×512, viewBox 64×64 | Ink 950 tile | app/product icon master |
| `jig-favicon.svg` | 32×32, viewBox 64×64 | Ink 950 tile | browser favicon |
| `jig-logo.svg` | 112×68 | transparent | horizontal lockup on light surfaces |
| `jig-logo-on-dark.svg` | 112×68 | transparent | horizontal lockup on dark surfaces |
| `jig-logo-mono-dark.svg` | 112×68 | transparent | one-color horizontal dark |
| `jig-logo-mono-light.svg` | 112×68 | transparent | one-color horizontal light |
| `jig-logo-light.svg` | 136×88 | Paper 100 | fixed light plate |
| `jig-logo-dark.svg` | 136×88 | Ink 950 | fixed dark plate |
| `jig-logo-plate-dark.svg` | 192×96 | Ink 950 | README/theme-independent plate |

### Optical cropping

Transparent wordmarks retain the optically cropped 112×68 viewBox. This crop contains the branded J and the outlined **ig** suffix only.

Fixed 136×88 plates add exactly 12 units horizontal and 10 units vertical clear space around that wordmark.

The README plate is 192×96, adding exactly 40 units horizontal and 14 units vertical clear space. It is centered by visible artwork, not by an oversized authoring canvas.

### Application integration

- Header/app shell: use the complete horizontal wordmark, switching between `jig-logo.svg` and `jig-logo-on-dark.svg` with the active theme. Do not compose the standalone J icon beside live “Jig” text.
- Browser/app icon contexts: use the standalone J-only `jig-app-icon.svg` / `jig-favicon.svg`.
- README / unknown viewer theme: use `jig-logo-plate-dark.svg`.
- Light branded surfaces: use `jig-logo.svg` or `jig-logo-light.svg`.
- Dark branded surfaces: use `jig-logo-on-dark.svg` or `jig-logo-dark.svg`.

Do not use the large horizontal lockup inside compact application chrome.

## 9. Usage constraints

Do not:

- recolor the alignment pin with semantic status colors;
- substitute a calendar, clock, checkmark, Kanban or AI-sparkle icon;
- add gradients, metallic effects or shadows to the canonical flat logo;
- create screen-specific brand palettes;
- use Brand Amber for warning merely because warning is also yellow/orange;
- use Brand Amber as the persistent fill/border for selected Task cards or desktop current-day columns;
- use the same visual treatment for current day, Task selection, priority and drag target;
- add a second theme owner or CSS override layer that bypasses `jigTheme`;
- depend on private/undocumented Astryx selectors, internal DOM structure, generated StyleX details or private CSS custom properties;
- use `!important` or specificity escalation to force library components into a different anatomy;
- copy raw palette values into feature styles.

## 10. Verification and change control

Any change to the brand anchors, palette stops, semantic mapping or mark geometry requires the same change set to update:

1. this document;
2. `ui/src/theme.css` when palette primitives change;
3. `ui/src/jig-theme.source.ts` when semantic role mapping changes;
4. regenerated `ui/src/jig.js`, `ui/src/jig.css` and declarations via the pinned Astryx CLI, with `bun run theme:check` green;
5. affected assets under `assets/`;
6. representative Light and Dark browser evidence;
7. browser acceptance proving the root theme remains `jig` and that Light/Dark accents resolve to the intended functional stops.

Layout-only UI changes do not redefine this brand contract.
