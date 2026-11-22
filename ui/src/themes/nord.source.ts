import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { nordPalette } from "./palettes/nord";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const nordTheme = defineTheme({
  name: "nord",
  extends: neutralTheme,
  tokens: {
    ...communityColorTokens(nordPalette),
    ...jigMotionTokens,
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: nordPalette.body,
      planner: nordPalette.surface,
      task: nordPalette.card,
    }),
  },
});
