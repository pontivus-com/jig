import type { CommunityPalette } from "../community-theme";

/**
 * Dracula application palette authority:
 * https://github.com/dracula/draculatheme.com/blob/34a22aa05be158b5524a7355c8e39f548a877e8a/content/spec.mdx
 * Light = Alucard Classic; Dark = Dracula Classic.
 */
export const draculaPalette = {
  body: ["#fffbeb", "#282a36"],
  surface: ["#efeddc", "#343746"],
  card: ["#ece9df", "#424450"],
  popover: ["#efeddc", "#343746"],
  muted: ["#dedccf", "#44475a"],
  textPrimary: ["#1f1f1f", "#f8f8f2"],
  textSecondary: [
    "#6c664b",
    "color-mix(in srgb, #f8f8f2 72%, #282a36)",
  ],
  textDisabled: ["#8f8976", "#6272a4"],
  accent: ["#644ac9", "#bd93f9"],
  info: ["#036a96", "#8be9fd"],
  success: ["#14710a", "#50fa7b"],
  warning: ["#846e15", "#f1fa8c"],
  error: ["#cb3a2a", "#ff5555"],
  red: ["#cb3a2a", "#ff5555"],
  orange: ["#a34d14", "#ffb86c"],
  yellow: ["#846e15", "#f1fa8c"],
  green: ["#14710a", "#50fa7b"],
  teal: ["#036a96", "#8be9fd"],
  cyan: ["#036a96", "#8be9fd"],
  blue: ["#315ea8", "#8be9fd"],
  purple: ["#644ac9", "#bd93f9"],
  pink: ["#a3144d", "#ff79c6"],
  gray: ["#6c664b", "color-mix(in srgb, #f8f8f2 72%, #282a36)"],
} satisfies CommunityPalette;
