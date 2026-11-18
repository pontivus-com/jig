import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { tokyoNightPalette } from "./palettes/tokyo-night";
import { jigProductLocalTokens } from "./product-tokens";

export const tokyoNightTheme = defineTheme({
  name: "tokyo-night",
  extends: neutralTheme,
  tokens: communityColorTokens(tokyoNightPalette),
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
