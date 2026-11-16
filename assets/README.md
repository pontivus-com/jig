# Jig brand assets

The canonical visual specification is [`docs/design/brand-and-theme.md`](../docs/design/brand-and-theme.md). This directory contains its approved Option A assets only.

## Geometry authority

All mark variants use the same 64×64 J-guide geometry and alignment-pin position. All horizontal lockups use the same outlined wordmark geometry. Released SVGs contain no live font dependency.

Do not redraw either geometry from memory.

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
| `jig-logo.svg` | 144×76 | transparent horizontal lockup for light surfaces |
| `jig-logo-on-dark.svg` | 144×76 | transparent horizontal lockup for dark surfaces |
| `jig-logo-mono-dark.svg` | 144×76 | one-color horizontal dark |
| `jig-logo-mono-light.svg` | 144×76 | one-color horizontal light |
| `jig-logo-light.svg` | 168×96 | fixed Paper light plate |
| `jig-logo-dark.svg` | 168×96 | fixed Ink dark plate |
| `jig-logo-plate-dark.svg` | 224×104 | README/theme-independent plate |

## Crop and alignment

The transparent 144×76 horizontal lockup is the optical crop. Do not preserve a larger authoring canvas.

The 168×96 plates add exactly 12 units of horizontal and 10 units of vertical clear space around that lockup.

The README plate adds exactly 40 units horizontal and 14 units vertical clear space and is centered by visible artwork.

The square mark is optically centered rather than mathematically forcing the curved J into a symmetric bounding box.

## Application use

- Compact application chrome: `jig-app-icon.svg` plus live product text.
- Browser favicon: `jig-favicon.svg`.
- README: `jig-logo-plate-dark.svg`.
- Light branded surface: `jig-logo.svg` or `jig-logo-light.svg`.
- Dark branded surface: `jig-logo-on-dark.svg` or `jig-logo-dark.svg`.

See the governing brand/theme document for palette, semantic theming and prohibited uses.
