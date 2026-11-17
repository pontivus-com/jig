# Jig brand and theme system

**Status:** Canonical v1.0.6 brand and application-theme contract v0.16, 2026-11-18. v1.0.5 remains the default Jig palette/identity baseline; v1.0.6 adds the curated multi-theme application catalogue, independent System/Light/Dark appearance, palette-independent Jig product-state semantics and theme-aware in-application wordmark paint.
**Selected identity:** Option A — precise J guide + alignment pin.  
**Scope:** Logo geometry, default Jig brand palette, multi-theme Light/Dark semantic theming, application integration, asset dimensions and change control.  
**Governing product identity:** [Product identity](../product/product-identity.md).  
**Governing UI:** [UI solution](ui-solution.md).

This document is the single human-readable authority for Jig branding and theming. The executable v1.0.6 authorities are:

- `ui/src/theme.css` — canonical raw **default Jig** Ink/Amber/Paper primitives only;
- the typed appearance/theme registry — the single list of the fourteen supported application themes and the independent `System | Light | Dark` appearance mode;
- Jig-authored Astryx theme sources — default Jig, seven Astryx wrappers and six community semantic palette themes, all compiled by pinned `@astryxdesign/cli@0.7.13`;
- one shared Jig product-local token mapping for current day, Task selection/elevation, navigation, drag, priority, repository status and in-application brand paint;
- compiler-owned generated theme modules/styles/declarations — never hand-edited;
- `ui/src/styles.css` — layout/composition only; it consumes active semantic Astryx/Jig tokens and must not introduce a second color system or theme-name branch;
- `ui/src/app.tsx` — the single root Astryx `Theme` owner, consuming exactly one registry theme plus one independent appearance mode.

No feature component owns a private palette. No runtime code fetches or compiles a theme.

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

The **default Jig theme and fixed external brand assets** use three related tonal scales. These values define Jig identity and remain authoritative for the Jig preset, favicon/app icon and theme-independent release/README assets; they are not forced onto another selected application theme:

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

### Functional color families

The **brand palette** and the **functional UI palette** are not the same thing.

Jig's brand foundation remains Ink + Amber + Paper. The application theme additionally inherits the full Astryx semantic/color families required for interface meaning:

- **blue / info** — information and persistent Task selection;
- **teal** — temporal orientation such as exact current day;
- **green / success** — healthy durability, Low priority, positive completion affordances;
- **yellow / warning** — pending/retrying and genuine caution;
- **red / error** — High priority, destructive/error outcomes;
- **gray / Ink neutral** — ordinary structure, Normal priority, active navigation where no status meaning exists;
- **Amber** — brand, primary action, focus and transient direct manipulation.

These functional families are first-class parts of the application theme even though they are not additional Jig brand colors. Do not avoid a required functional hue merely to keep the interface visually limited to Ink/Amber/Paper.

If a future governed UI state cannot be represented unambiguously and accessibly by the existing brand + Astryx functional families, the correct remedy is to add a new canonical theme role/family through this document and the authored theme source. It is **not** acceptable to overload an unrelated existing color.

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
| Desktop current day | temporal teal / cool structure | exact-date-only subtle teal border/header typography; no whole-column fill | Amber, selected-Task blue, status fill |
| Planner selected day | none | no selected-day state or visual treatment exists | any persistent weekday/day-selection highlight |
| Selected Task card | information blue selection | subtle info-blue muted surface plus info-blue border; focus ring remains separately Amber when keyboard-focused | Amber, today teal, priority/status fill as the persistent selection state |
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



## 6.1.1 Functional palette completeness rule

Jig's theme is considered complete only when every governed visual meaning has an explicit semantic role with sufficient contrast in both Light and Dark modes.

The brand palette is **not** a cap on the number of usable UI colors. Ink, Amber and Paper define product identity; functional UI meaning may and should use the broader semantic families supplied by the theme system.

For every new or changed UI state:

1. identify the semantic meaning first;
2. map it to an existing canonical functional family only when that family already represents the same meaning;
3. expose a named Jig product semantic alias for repeated product-specific use;
4. verify Light/Dark contrast and coexistence with focus, selection, priority and status states;
5. if no existing family communicates the meaning clearly and accessibly, add a new canonical functional palette family/token set to the theme authority before implementation.

It is explicitly prohibited to:
- reuse Amber because it is the brand color;
- reuse blue, green, red, teal or neutral merely because the desired role is visually similar;
- encode two unrelated persistent product states with the same background/border treatment;
- introduce raw feature-local hex values to work around a missing semantic role.

### Functional family inventory for v1.0.4

The current v1.0.4 interaction model requires the following complete functional set:

| Family | Required semantic ownership | Availability |
|---|---|---|
| Ink / gray neutral | structure, ordinary borders, Normal priority, inactive/unknown state, neutral navigation | available |
| Amber | brand, primary action, focus, transient drag/direct manipulation | available |
| Blue / info | selected/open Task, informational state | available |
| Teal | current-day temporal orientation | available |
| Green / success | Local only, Synced, Low priority, positive completion affordance | available |
| Yellow / warning | pending, retrying, caution | available |
| Red / error | High priority, validation/save/sync errors, destructive confirmation | available |
| Paper / surface | warm Light-mode body/layering | available |
| Dark Ink surface scale | Dark-mode body/surface/elevation | available |

**v1.0.4 palette completeness verdict:** no additional raw hue family is currently required. The existing Jig brand scales plus Astryx functional families cover every governed v1.0.4 state without semantic reuse. The implementation gap is the absence of explicit Jig product aliases in the authored theme source and the continued use of generic accent roles in legacy feature CSS.

If a later requirement introduces a meaning not represented by this inventory, the theme must be extended at this authority layer rather than compressing the new meaning into one of these existing roles.

## 6.2 Canonical Jig product semantic tokens

The following **Jig-owned product semantic aliases** are part of the theme contract. They are not feature-local variables and they are not a second palette. They are authored in `ui/src/jig-theme.source.ts` from the canonical Ink/Amber/Paper primitives or inherited Astryx status roles, compiled by the normal Astryx theme build, and consumed by Jig-owned composition CSS.

Feature CSS must consume these aliases for the product states below and must not substitute another semantic family because it “looks close enough”.

| Token | Light | Dark | Sole semantic owner |
|---|---|---|---|
| `--jig-state-today-border` | Astryx teal border role | Astryx teal border role | exact current local day structural border |
| `--jig-state-today-text` | Astryx teal text role | Astryx teal text role | exact current local day date text |
| `--jig-state-task-selected-bg` | Astryx info-muted role | Astryx info-muted role | selected Task persistent surface |
| `--jig-state-task-selected-border` | Astryx info border role | Astryx info border role | selected Task persistent border |
| `--jig-state-nav-active-bg` | Ink 100 `#EFF2F7` | Ink 800 `#253046` | active History/Settings destination |
| `--jig-state-nav-active-text` | Ink 900 `#162034` | Ink 50 `#F9FAFD` | active History/Settings label/icon |
| `--jig-state-drag-border` | Amber 700 `#B86C00` | Amber 500 `#F59E0B` | transient drag source/drop target outline |
| `--jig-state-drag-bg` | Amber 50 `#FEF3E7` | Amber 500 mixed 18% into Ink 900 | transient drag target tint only |
| `--jig-priority-high` | Astryx error text role | Astryx error text role | High priority leading cue |
| `--jig-priority-normal` | Ink 500 `#788499` | Ink 400 `#9BA5B8` | Normal priority leading cue |
| `--jig-priority-low` | Astryx success text role | Astryx success text role | Low priority leading cue |
| `--jig-status-healthy-bg` | Astryx success-muted | Astryx success-muted | Local only / Synced background |
| `--jig-status-healthy-border` | Astryx success border | Astryx success border | Local only / Synced border |
| `--jig-status-healthy-text` | Astryx success text | Astryx success text | Local only / Synced text/dot |
| `--jig-state-hover-bg` | low-alpha Ink 950 (5%) | low-alpha White (5%) | ordinary neutral hover on Jig-owned surfaces |
| `--jig-state-pressed-bg` | low-alpha Ink 950 (10%) | low-alpha White (10%) | ordinary neutral pressed state on Jig-owned surfaces |

No other product-state color aliases are permitted without updating this document and the authored theme source.

### 6.2.1 Color precedence

When multiple states coexist, apply color in this precedence order:

1. **error/destructive state**;
2. **drag source/drop target** while dragging;
3. **keyboard focus ring**;
4. **selected Task persistent state**;
5. **today structural state**;
6. **priority leading cue**;
7. ordinary hover/pressed/base surface.

Priority never replaces card background/border state; it remains a narrow leading cue. Focus never replaces the persistent state; it adds an Amber focus ring. Drag state is transient and may temporarily override the card/column border while preserving priority cue.

## 6.3 Canonical component and interaction color assignment

This table is binding. “Astryx-owned” means use the stated public component variant and let the Jig theme provide its semantic colors; do not override the component with product-state CSS.

| Component / activity | Base | Hover / pressed | Active / selected / outcome | Focus | Disabled | Prohibited substitution |
|---|---|---|---|---|---|---|
| **App page/body** | Paper 100 / Ink 950 | n/a | n/a | n/a | n/a | Amber/status fills |
| **Header / Drawer / BottomSheet / card surface** | White / Ink 900 | neutral overlay where interactive | n/a | n/a | n/a | status colors as general surface |
| **Ordinary structural border** | `--color-border` | n/a | emphasized only where contract says so | n/a | n/a | Amber |
| **Primary button — Add task, Save** | Astryx `primary`: Amber accent + Ink 950 content | Astryx primary hover/pressed | same semantic family | Amber focus ring | Astryx disabled text/surface | success/warning/error |
| **Secondary button — Today, Complete/Reopen, Cancel when rendered secondary** | Astryx `secondary` neutral | Astryx neutral hover/pressed | no persistent Amber state | Amber focus ring | Astryx disabled | selected-Task/today colors |
| **Ghost/icon button — Previous, Next, Jig Home, date-header +, menus, close** | transparent + primary/secondary Ink | neutral hover/pressed | active destination handled separately below | Amber focus ring | Astryx disabled | persistent Amber fill |
| **History/Settings active destination** | ghost control anatomy | neutral hover/pressed | `--jig-state-nav-active-bg` + `--jig-state-nav-active-text`; optional emphasized neutral border | Amber focus ring | n/a | Amber-muted active fill; Task-selection background |
| **Week/date label — ordinary** | surface/muted header + primary/secondary Ink | no click-selection state | n/a | n/a | n/a | accent/selected state |
| **Exact current local day** | ordinary date section | n/a | `--jig-state-today-border` + `--jig-state-today-text`; font weight may increase; no whole-lane colored fill | n/a | n/a | Amber; selected-Task info blue; success/warning/error fill |
| **Non-current date in other weeks** | ordinary date section | n/a | **no day-level state** | n/a | n/a | today or selected-day styling |
| **Task card — ordinary** | card surface + ordinary border | `--jig-state-hover-bg` | n/a | Amber focus ring on interactive body | disabled controls only | accent-muted card fill |
| **Task card — selected/open workspace target** | ordinary card | neutral hover remains subordinate | `--jig-state-task-selected-bg` + `--jig-state-task-selected-border` using the info-blue family | Amber focus ring additionally | n/a | Amber; today teal; priority/status color as card fill |
| **Task drag source** | selected/ordinary card semantics underneath | n/a | `--jig-state-drag-border`; drag overlay shadow; reduced-opacity source is permitted | n/a during pointer drag | n/a | selected-task neutral as sole drag indicator |
| **Date drop target** | ordinary/today structural state underneath | n/a | dashed/solid `--jig-state-drag-border` + `--jig-state-drag-bg` | n/a | n/a | today neutral; success/warning/error |
| **High priority** | no card fill change | n/a | narrow `--jig-priority-high` leading cue + restrained error-family High label if shown | n/a | n/a | Amber/warning |
| **Normal priority** | no card fill change | n/a | narrow `--jig-priority-normal` leading cue; no badge by default | n/a | n/a | Amber |
| **Low priority** | no card fill change | n/a | narrow `--jig-priority-low` leading cue + restrained success-family Low label if shown | n/a | n/a | info/Amber |
| **Completed Task** | ordinary card surface; secondary text permitted | neutral hover | completion checkbox/check may use success; title subdued/line-through | Amber focus ring | n/a | success-filled whole card |
| **Form fields** | Astryx field semantic roles | Astryx field hover/pressed | validation error uses error family; normal value has no product-state color | Amber focus ring | Astryx disabled | Task-selection/today colors |
| **Priority segmented control** | Astryx control anatomy | Astryx hover | selected segment follows control-selection semantics; surrounding Task card still follows product state | Amber focus ring | Astryx disabled | card priority color as full segment system unless Astryx provides it semantically |
| **Delete menu item / confirmed destructive action** | ordinary menu until destructive affordance is represented by Astryx; confirmation uses error/destructive semantics | Astryx | error/destructive family | Amber focus ring until destructive confirmation control owns error semantics | disabled as Astryx | Brand Amber as destructive meaning |
| **Alert/dialog destructive confirmation** | Astryx dialog surface | Astryx | destructive confirm = error family; cancel = neutral/secondary | accessible focus ring | Astryx disabled | warning/Amber |
| **Local only** | `--jig-status-healthy-*` | neutral button hover if clickable | healthy local durability; label remains `Local only` | Amber focus ring if interactive | n/a | grey/unknown |
| **Synced** | `--jig-status-healthy-*` | neutral button hover if clickable | healthy repository-synchronized outcome; label remains `Synced` | Amber focus ring if interactive | n/a | Local-only wording substitution |
| **Pending / retrying** | Astryx warning text/muted/border | neutral button hover if clickable | warning family | Amber focus ring if interactive | n/a | Brand Amber |
| **Sync issue / save failure** | Astryx error text/muted/border | neutral button hover if clickable | error family | Amber focus ring if interactive | n/a | Brand Amber |
| **Unknown operational state** | muted neutral background + secondary text + ordinary border | neutral hover if clickable | no positive/negative implication | Amber focus ring if interactive | n/a | success/warning/error |
| **Informational notice** | Astryx info family | component-owned | info family | component-owned | component-owned | priority Low unless the content is actually status/info |
| **Empty-state copy** | secondary Ink text on ordinary surface | n/a | n/a | n/a | n/a | status/accent color |
| **Links / references** | Astryx link/inherit semantics | Astryx | visited behavior per browser/Astryx | Amber focus ring | n/a | priority/status colors |

## 6.4 Default Jig Light/Dark resolved product-state palette

The following resolved values are the intended visual result **when the Jig theme preset is selected**. They do not constrain Gruvbox/Dracula/Solarized/Nord/Catppuccin/Tokyo Night or the other Astryx presets to Jig hues. Every preset instead implements the same semantic owners and state precedence defined by JIG-106-SD-04. Status-family values remain inherited from the selected theme and therefore are not duplicated here as universal brand hex literals.

| Product role | Light | Dark |
|---|---|---|
| Today border | Astryx teal border: `#90D7C8` | Astryx teal border: `#4FB1A0` |
| Today text | Astryx teal text: `#00463D` | Astryx teal text: `#90D7C8` |
| Selected Task background | Astryx info-muted: `#B9D7FF` | Astryx info-muted: `#88BCFF3D` |
| Selected Task border | Astryx info border/text role: `#0067CE` | Astryx info border/text role: `#A1CAFF` |
| Active destination background | Ink 100 `#EFF2F7` | Ink 800 `#253046` |
| Active destination text | Ink 900 `#162034` | Ink 50 `#F9FAFD` |
| Drag border / direct manipulation | Amber 700 `#B86C00` | Amber 500 `#F59E0B` |
| Drag target tint | Amber 50 `#FEF3E7` | Amber 500 @ 18% mixed into Ink 900 |
| Normal priority cue | Ink 500 `#788499` | Ink 400 `#9BA5B8` |
| Focus ring | Amber 700 `#B86C00` | Amber 500 `#F59E0B` |

These values deliberately use the wider functional palette: temporal orientation is teal, selected Task is info blue, active destination is neutral Ink, direct manipulation/focus is Amber, High is red/error, Normal is neutral, and Low/healthy status is green/success. No persistent product state may use `--color-accent-muted` simply because it is selected.


## 6.5 Task-surface contrast and responsive parity

The Planner canvas and Task card are separate semantic surfaces. v1.0.5 makes that separation explicit because the published v1.0.4 Dark/narrow presentation allowed Task cards to visually merge into their background.

The feature-level contract remains two Jig-local semantic aliases. The default Jig preset resolves them as follows; other theme wrappers select their governed elevated surface/border roles as specified by JIG-106-SD-04:

| Alias | Light | Dark | Purpose |
|---|---|---|---|
| `--jig-task-surface` | White | Ink 800 | Base outstanding/completed Task-card surface across Planner and History |
| `--jig-task-border` | Ink 200 / emphasized neutral border | Ink 700 / emphasized neutral border | Base Task-card edge separation |

The surrounding Planner canvas remains:

- Light: Paper 100;
- Dark: Ink 950.

Therefore Dark Task cards sit two Ink stops above the canvas rather than using the v1.0.4 Ink 900 surface. This is deliberate legibility/elevation, not decorative chrome.

Rules:

1. Desktop and narrow/mobile consume the same Task-surface aliases. Responsive CSS must not substitute `--color-background-body`, transparent, or a mobile-only surface.
2. Hover may add the ordinary transient overlay, but the un-hovered card must already be visibly distinct.
3. Selected Task continues to use the governed info-blue selected surface/border; keyboard focus adds Amber; drag adds transient Amber; priority remains the narrow leading cue. These states do not redefine the base card surface contract.
4. History Task rows use the same base Task surface family unless an Astryx component public semantic surface already provides the exact same resolved role.
5. Do not introduce raw feature-local colors in `styles.css`.

### v1.0.5 icon and header-brand normalization

The public Astryx icon registry is Jig's one reusable application icon language. Header/navigation, Add, Task metadata/actions and status controls use semantic Astryx icons where available and preserve accessible text/labels. The pinned registry supplies `viewColumns`, `checkDouble`, `wrench`, `menu`, `moreHorizontal`, `clock`, `externalLink`, `copy`, `check`, `arrowUp`, `arrowDown`, status icons and temporal chevrons.

The application header must use the canonical complete horizontal Jig wordmark asset. The standalone J icon is reserved for app/favicon/icon contexts and must not be placed next to a second live “Jig” word in the header.

Narrow/mobile is not an alternate icon system: it uses the same semantic icon meaning, size family and state color as desktop, with only touch sizing/layout changing.

Astryx 0.7.13 has no true semantic names for Add, History, Edit or Delete. Jig therefore owns exactly four namespaced extension keys — `jig:add`, `jig:history`, `jig:edit`, `jig:delete` — as bundled 24×24 inline fallbacks resolved through Astryx `getExtendedIcon`/`Icon`. This extends the Astryx registry; it is not a second icon system or dependency. No custom Jig glyph is introduced where an appropriate built-in Astryx semantic name exists.


## 7. Theme implementation contract

### 7.1 Theme catalogue and ownership

v1.0.6 supports exactly fourteen application themes:

- **Jig:** Jig;
- **Astryx:** Neutral, Butter, Chocolate, Gothic, Matcha, Stone, Y2K;
- **Community:** Gruvbox, Dracula, Solarized, Nord, Catppuccin, Tokyo Night.

The exact pairings/provenance and complete semantic color requirements are binding in JIG-106-SD-02 and JIG-106-SD-04. Community palette literals live only in governed theme-authoring palette sources; feature styles never copy them. The default Jig primitives remain in `ui/src/theme.css`.

Theme family and appearance mode are independent browser-local presentation values. The root application mounts exactly one Astryx owner:

```tsx
<Theme theme={themeRegistry[themePreset].theme} mode={appearanceMode}>
```

`AppearanceMode` is exactly `system | light | dark`. Astryx owns System resolution through its published `Theme` behavior and CSS `light-dark()` semantics. Jig does not maintain a second resolved-mode state or `matchMedia` color engine.

### 7.2 Semantic mapping

Every supported theme supplies the complete Astryx color-semantic inventory needed by Jig/Astryx plus the shared Jig product-local aliases defined by JIG-106-SD-04.

The shared Jig aliases encode **meaning**, not the default Jig hue:

- exact current day;
- selected Task;
- active navigation;
- drag/drop;
- High/Normal/Low priority;
- healthy repository state;
- hover/pressed;
- Task surface/border;
- in-application brand primary/accent.

Published Astryx themes retain their complete component/typography/icon behavior and add the Jig product aliases. Community themes keep Astryx Neutral mechanics while supplying a complete community color-semantic mapping. No feature component branches on theme ID.

### 7.3 CSS composition and theme build

Every Jig-authored theme follows Astryx's documented production path:

1. author through public `defineTheme`/published theme inheritance;
2. compile with pinned `@astryxdesign/cli@0.7.13` using `astryx theme build`;
3. commit generated modules/styles/declarations;
4. import only built theme objects at runtime;
5. run one exhaustive theme-check command that checks all authored v1.0.6 sources and fails on stale generated artifacts.

Jig must not hand-write Astryx's internal `__built` marker, call private theme machinery, dynamically inject unbuilt themes, or substitute an application-owned compiler.

`ui/src/styles.css` preserves this foundation order:

1. Astryx reset;
2. Astryx core;
3. default Jig palette primitives needed by the Jig preset;
4. generated CSS for all supported Jig-owned/wrapper themes;
5. Jig-owned composition rules.

Inactive generated themes are scoped by Astryx's theme attribute and do not paint the application.

Feature/composition CSS:

- styles only Jig-owned composition/root classes;
- consumes public Astryx tokens and shared Jig product aliases;
- contains no theme palette literals or theme-name selectors/branches;
- never targets private Astryx descendants/custom properties;
- uses no `!important`, high-priority cascade layer or specificity escalation;
- keeps each layout/style meaning under one semantic owner.

### 7.4 Appearance placement and persistence

Theme and System/Light/Dark controls exist only in **Settings → Appearance**. The Theme selector is derived from the one registry; the appearance segmented control owns exactly System, Light and Dark.

Both preferences are presentation state only. They do not mutate Task, displayed week, workspace draft, completion, SQLite, HTTP, repository records or synchronization state. A live System platform-preference change repaints the currently selected family without changing the family choice.

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

- **Application header/app shell:** render one canonical inline SVG/React wordmark geometry copied from the approved lockup. Its guide/wordmark foreground consumes `--jig-brand-primary`; its alignment pin consumes `--jig-brand-accent`. Desktop and narrow use this same semantic component. Do not switch fixed Light/Dark image files in application chrome and do not compose the standalone J icon beside live “Jig” text.
- **Browser/app icon contexts:** use the standalone J-only `jig-app-icon.svg` / `jig-favicon.svg`; these fixed Ink-tile assets are intentionally theme-independent.
- **README / unknown viewer theme:** use `jig-logo-plate-dark.svg`.
- **External/light branded surfaces:** `jig-logo.svg` or `jig-logo-light.svg` remain valid fixed Jig-palette assets.
- **External/dark branded surfaces:** `jig-logo-on-dark.svg` or `jig-logo-dark.svg` remain valid fixed Jig-palette assets.

Application wordmark geometry remains compact within the governed header dimensions; external lockup assets are not runtime application-theme color authorities.

## 9. Usage constraints

Do not:

- recolor the alignment pin with semantic status colors;
- substitute a calendar, clock, checkmark, Kanban or AI-sparkle icon;
- add gradients, metallic effects or shadows to the canonical flat logo;
- create screen-specific brand palettes;
- use Brand Amber for warning merely because warning is also yellow/orange;
- use Brand Amber as the persistent fill/border for selected Task cards or desktop current-day columns;
- use the same visual treatment for current day, Task selection, priority and drag target;
- add a second root theme owner, resolved-mode engine or CSS override layer that bypasses the active registry theme;
- depend on private/undocumented Astryx selectors, internal DOM structure, generated StyleX details or private CSS custom properties;
- use `!important` or specificity escalation to force library components into a different anatomy;
- copy raw palette values into feature styles.

## 10. Verification and change control

Any change to brand anchors, theme palette sources, semantic mapping or mark geometry requires the corresponding authority and generated evidence to move together:

1. this document and the JIG-106 technical contract when semantic ownership changes;
2. `ui/src/theme.css` when default Jig primitives change;
3. the affected Jig/Astryx-wrapper/community theme source and shared product-token mapping;
4. regenerated compiler-owned theme artifacts through pinned Astryx CLI, with the exhaustive `bun run theme:check` green;
5. `THIRD_PARTY_NOTICES.md` when copied community palette provenance/license material changes;
6. affected external assets under `assets/` when their fixed artwork changes;
7. browser acceptance for all fourteen presets in Light/Dark and System-Light/System-Dark, including live System preference change, semantic state coexistence, Task/canvas separation and in-application wordmark contrast;
8. architecture checks proving one root Theme owner and no feature-level raw palette/theme-name branching.

Layout-only UI changes do not redefine this brand contract.
