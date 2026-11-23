import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { gruvboxPalette } from "./palettes/gruvbox";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const gruvboxTheme = defineTheme({
  name: "gruvbox",
  extends: neutralTheme,
  tokens: {
    ...communityColorTokens(gruvboxPalette),
    ...jigMotionTokens,
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: gruvboxPalette.body,
      planner: gruvboxPalette.surface,
      task: gruvboxPalette.card,
    }),
  },
});
