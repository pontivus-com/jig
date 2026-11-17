import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { draculaPalette } from "./palettes/dracula";
import { jigProductLocalTokens } from "./product-tokens";

export const draculaTheme = defineTheme({
  name: "dracula",
  extends: neutralTheme,
  tokens: communityColorTokens(draculaPalette),
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
