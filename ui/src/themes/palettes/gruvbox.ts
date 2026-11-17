import type { CommunityPalette } from "../community-theme";

/**
 * Gruvbox palette authority:
 * https://github.com/morhetz/gruvbox/blob/66246fba24fd49eeb50dd833094d272f0bbab640/colors/gruvbox.vim
 * v1.0.6 deliberately uses the upstream medium Light/Dark contrast pair.\n * License: MIT/X11. Author: Pavel Pertsev and contributors.
 */
export const gruvboxPalette = {
  body: ["#fbf1c7", "#282828"],
  surface: ["#f9f5d7", "#3c3836"],
  card: ["#f2e5bc", "#504945"],
  popover: ["#f9f5d7", "#3c3836"],
  muted: ["#ebdbb2", "#3c3836"],
  textPrimary: ["#282828", "#ebdbb2"],
  textSecondary: ["#665c54", "#bdae93"],
  textDisabled: ["#928374", "#7c6f64"],
  accent: ["#af3a03", "#fe8019"],
  info: ["#076678", "#83a598"],
  success: ["#79740e", "#b8bb26"],
  warning: ["#b57614", "#fabd2f"],
  error: ["#9d0006", "#fb4934"],
  red: ["#9d0006", "#fb4934"],
  orange: ["#af3a03", "#fe8019"],
  yellow: ["#b57614", "#fabd2f"],
  green: ["#79740e", "#b8bb26"],
  teal: ["#427b58", "#8ec07c"],
  cyan: ["#427b58", "#8ec07c"],
  blue: ["#076678", "#83a598"],
  purple: ["#8f3f71", "#d3869b"],
  pink: ["#8f3f71", "#d3869b"],
  gray: ["#665c54", "#bdae93"],
} satisfies CommunityPalette;
