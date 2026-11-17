import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { nordPalette } from "./palettes/nord";
import { jigProductLocalTokens } from "./product-tokens";

export const nordTheme = defineTheme({
  name: "nord",
  extends: neutralTheme,
  tokens: communityColorTokens(nordPalette),
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
