# Jig brand assets

The canonical visual specification is [`docs/design/brand-and-theme.md`](../docs/design/brand-and-theme.md). This directory contains its approved Option A assets only.

## Geometry authority

All icon variants use the same 64×64 J-guide geometry and alignment-pin position.

Every horizontal wordmark uses that J as the **first letter of Jig** and adds only the outlined **ig** suffix. A J icon beside a second full “Jig” word is invalid.

Released SVGs contain no live font dependency. Do not redraw the J or the ig suffix from memory.

## Asset matrix

| Asset | Dimensions | Use |
| --- | ---: | --- |
| `jig-symbol.svg` | 64×64 | full-color mark on light surfaces |
| `jig-symbol-on-dark.svg` | 64×64 | full-color mark on dark surfaces |
| `jig-icon.svg` | 64×64 | canonical symbol alias |
| `jig-symbol-mono-dark.svg` | 64×64 | one-color dark symbol |
| `jig-symbol-mono-light.svg` | 64×64 | one-color light symbol |
| `jig-app-icon.svg` | 512×512, 64×64 viewBox | app/product icon master |
| `jig-favicon.svg` | 32×32, 64×64 viewBox | browser favicon |
| `jig-logo.svg` | 112×68 | transparent horizontal lockup for light surfaces |
| `jig-logo-on-dark.svg` | 112×68 | transparent horizontal lockup for dark surfaces |
| `jig-logo-mono-dark.svg` | 112×68 | one-color horizontal dark |
| `jig-logo-mono-light.svg` | 112×68 | one-color horizontal light |
| `jig-logo-light.svg` | 136×88 | fixed Paper light plate |
| `jig-logo-dark.svg` | 136×88 | fixed Ink dark plate |
| `jig-logo-plate-dark.svg` | 192×96 | README/theme-independent plate |

## Crop and alignment

The transparent 112×68 wordmark is the optical crop of **[J mark] + ig**. It contains no duplicate J.

The 136×88 plates add exactly 12 units of horizontal and 10 units of vertical clear space around that wordmark.

The 192×96 README plate adds exactly 40 units horizontal and 14 units vertical clear space and is centered by visible artwork.

The square mark is optically centered rather than mathematically forcing the curved J into a symmetric bounding box.

## Application use

- Application header: complete `jig-logo.svg` / `jig-logo-on-dark.svg` wordmark according to active theme.
- App-icon contexts: standalone J-only `jig-app-icon.svg`.
- Browser favicon: standalone J-only `jig-favicon.svg`.
- README: `jig-logo-plate-dark.svg`.
- Light branded surface: `jig-logo.svg` or `jig-logo-light.svg`.
- Dark branded surface: `jig-logo-on-dark.svg` or `jig-logo-dark.svg`.

See the governing brand/theme document for palette, semantic theming and prohibited uses.
