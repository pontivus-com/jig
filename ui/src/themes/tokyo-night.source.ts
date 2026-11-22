import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { tokyoNightPalette } from "./palettes/tokyo-night";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const tokyoNightTheme = defineTheme({
  name: "tokyo-night",
  extends: neutralTheme,
  tokens: {
    ...communityColorTokens(tokyoNightPalette),
    ...jigMotionTokens,
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: tokyoNightPalette.body,
      planner: tokyoNightPalette.surface,
      task:
        "color-mix(in oklab, var(--color-background-card) 99%, var(--color-text-primary) 1%)",
    }),
  },
});
