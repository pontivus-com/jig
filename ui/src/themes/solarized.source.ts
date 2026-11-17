import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { solarizedPalette } from "./palettes/solarized";
import { jigProductLocalTokens } from "./product-tokens";

export const solarizedTheme = defineTheme({
  name: "solarized",
  extends: neutralTheme,
  tokens: communityColorTokens(solarizedPalette),
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
