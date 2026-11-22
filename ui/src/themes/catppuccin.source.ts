import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { catppuccinPalette } from "./palettes/catppuccin";
import { jigProductLocalTokens } from "./product-tokens";

export const catppuccinTheme = defineTheme({
  name: "catppuccin",
  extends: neutralTheme,
  tokens: communityColorTokens(catppuccinPalette),
  localTokens: {
    ...jigProductLocalTokens({
      chrome: catppuccinPalette.body,
      planner: catppuccinPalette.surface,
      task: catppuccinPalette.card,
    }),
  },
});
