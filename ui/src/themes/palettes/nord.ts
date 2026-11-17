import type { CommunityPalette } from "../community-theme";

/**
 * Nord authority: official Nord Colors and Palettes documentation,
 * reviewed at v0.23.0 on 2026-11-18. Uses nord0..nord15 only.\n * License: MIT. Copyright (c) 2016-present Sven Greb.
 */
export const nordPalette = {
  body: ["#eceff4", "#2e3440"],
  surface: ["#e5e9f0", "#3b4252"],
  card: ["#d8dee9", "#434c5e"],
  popover: ["#e5e9f0", "#3b4252"],
  muted: ["#d8dee9", "#434c5e"],
  textPrimary: ["#2e3440", "#eceff4"],
  textSecondary: ["#4c566a", "#d8dee9"],
  textDisabled: ["#7b8496", "#7f899b"],
  accent: ["#5e81ac", "#88c0d0"],
  info: ["#5e81ac", "#81a1c1"],
  success: ["#6a8f5c", "#a3be8c"],
  warning: ["#9a741d", "#ebcb8b"],
  error: ["#a54851", "#bf616a"],
  red: ["#a54851", "#bf616a"],
  orange: ["#a86447", "#d08770"],
  yellow: ["#9a741d", "#ebcb8b"],
  green: ["#6a8f5c", "#a3be8c"],
  teal: ["#4e827f", "#8fbcbb"],
  cyan: ["#4e827f", "#88c0d0"],
  blue: ["#5e81ac", "#81a1c1"],
  purple: ["#8a5f86", "#b48ead"],
  pink: ["#8a5f86", "#b48ead"],
  gray: ["#4c566a", "#d8dee9"],
} satisfies CommunityPalette;
