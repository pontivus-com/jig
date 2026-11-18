import type { CommunityPalette } from "../community-theme";

/**
 * Catppuccin palette authority:
 * https://github.com/catppuccin/palette/blob/2a5d25cb0b00033bb049d11ab12c8bed478bf4e8/palette.json
 * palette.json version 1.8.0. Light = Latte; Dark = Mocha.\n * License: MIT. Copyright (c) 2021 Catppuccin.
 */
export const catppuccinPalette = {
  body: ["#eff1f5", "#1e1e2e"],
  surface: ["#e6e9ef", "#313244"],
  card: ["#dce0e8", "#45475a"],
  popover: ["#e6e9ef", "#313244"],
  muted: ["#ccd0da", "#313244"],
  textPrimary: ["#4c4f69", "#cdd6f4"],
  textSecondary: ["#6c6f85", "#bac2de"],
  textDisabled: ["#9ca0b0", "#6c7086"],
  accent: ["#8839ef", "#cba6f7"],
  info: ["#1e66f5", "#89b4fa"],
  // Latte success/warning are too bright as strong application status fills.
  // Blend only those Light semantic-role inputs toward Latte text so content
  // clears Jig's 4.5:1 status-fill floor; named Green/Yellow remain canonical.
  success: [
    "color-mix(in srgb, #40a02b 70%, #4c4f69)",
    "#a6e3a1",
  ],
  warning: [
    "color-mix(in srgb, #df8e1d 55%, #4c4f69)",
    "#f9e2af",
  ],
  error: ["#d20f39", "#f38ba8"],
  red: ["#d20f39", "#f38ba8"],
  orange: ["#fe640b", "#fab387"],
  yellow: ["#df8e1d", "#f9e2af"],
  green: ["#40a02b", "#a6e3a1"],
  teal: ["#179299", "#94e2d5"],
  cyan: ["#04a5e5", "#89dceb"],
  blue: ["#1e66f5", "#89b4fa"],
  purple: ["#8839ef", "#cba6f7"],
  pink: ["#ea76cb", "#f5c2e7"],
  gray: ["#6c6f85", "#bac2de"],
} satisfies CommunityPalette;
