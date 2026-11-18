import type { CommunityPalette } from "../community-theme";

/**
 * Tokyo Night reviewed generated palette authority:
 * Day: extras/lua/tokyonight_day.lua
 * Night: extras/lua/tokyonight_night.lua
 * Upstream source lineage: storm.lua + night.lua + official day inversion.\n * Reviewed blobs are recorded in THIRD_PARTY_NOTICES.md. License: Apache-2.0.
 */
export const tokyoNightPalette = {
  body: ["#e1e2e7", "#1a1b26"],
  surface: ["#d0d5e3", "#24283b"],
  card: ["#c4c8da", "#292e42"],
  popover: ["#d0d5e3", "#16161e"],
  muted: ["#c4c8da", "#292e42"],
  // Official Day fg is 3.988:1 on bg_dark. Preserve its hue while
  // darkening 12% toward the Night/body anchor to satisfy Jig's AA floor.
  textPrimary: [
    "color-mix(in srgb, #3760bf 88%, #1a1b26)",
    "#c0caf5",
  ],
  textSecondary: ["#6172b0", "#a9b1d6"],
  textDisabled: ["#848cb5", "#565f89"],
  accent: ["#9854f1", "#bb9af7"],
  info: ["#2e7de9", "#7aa2f7"],
  success: ["#587539", "#9ece6a"],
  warning: ["#8c6c3e", "#e0af68"],
  error: ["#c64343", "#f7768e"],
  red: ["#c64343", "#f7768e"],
  orange: ["#b15c00", "#ff9e64"],
  yellow: ["#8c6c3e", "#e0af68"],
  green: ["#587539", "#9ece6a"],
  teal: ["#118c74", "#1abc9c"],
  cyan: ["#007197", "#7dcfff"],
  blue: ["#2e7de9", "#7aa2f7"],
  purple: ["#7847bd", "#9d7cd8"],
  pink: ["#9854f1", "#bb9af7"],
  gray: ["#6172b0", "#a9b1d6"],
} satisfies CommunityPalette;
