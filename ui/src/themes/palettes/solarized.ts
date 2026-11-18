import type { CommunityPalette } from "../community-theme";

/**
 * Solarized palette authority:
 * https://github.com/altercation/solarized/blob/d18ee9450251ea1b9a02ebd4d6fce022df9eb5e4/README.md
 * Uses the canonical Light/Dark rebase over the same 16 colors.\n * License: MIT. Copyright (c) 2011 Ethan Schoonover.
 */
export const solarizedPalette = {
  body: ["#fdf6e3", "#002b36"],
  surface: ["#eee8d5", "#073642"],
  card: [
    "color-mix(in srgb, #fdf6e3 55%, #eee8d5)",
    "color-mix(in srgb, #073642 78%, #002b36)",
  ],
  popover: ["#eee8d5", "#073642"],
  muted: ["#eee8d5", "#073642"],
  // Base01 is 4.392:1 on Solarized base2, just below Jig's AA floor.
  // Keep the canonical hue and darken it 4% toward base03 for application text.
  textPrimary: [
    "color-mix(in srgb, #586e75 96%, #002b36)",
    "#93a1a1",
  ],
  textSecondary: ["#657b83", "#839496"],
  textDisabled: ["#93a1a1", "#586e75"],
  accent: ["#cb4b16", "#cb4b16"],
  info: ["#268bd2", "#268bd2"],
  success: ["#859900", "#859900"],
  warning: ["#b58900", "#b58900"],
  error: ["#dc322f", "#dc322f"],
  red: ["#dc322f", "#dc322f"],
  orange: ["#cb4b16", "#cb4b16"],
  yellow: ["#b58900", "#b58900"],
  green: ["#859900", "#859900"],
  teal: ["#2aa198", "#2aa198"],
  cyan: ["#2aa198", "#2aa198"],
  blue: ["#268bd2", "#268bd2"],
  purple: ["#6c71c4", "#6c71c4"],
  pink: ["#d33682", "#d33682"],
  gray: ["#657b83", "#839496"],
} satisfies CommunityPalette;
