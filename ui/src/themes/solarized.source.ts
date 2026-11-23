import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { solarizedPalette } from "./palettes/solarized";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const solarizedTheme = defineTheme({
  name: "solarized",
  extends: neutralTheme,
  tokens: {
    ...communityColorTokens(solarizedPalette),
    ...jigMotionTokens,
  },
  onLight: {
    tokens: {
      "--color-text-primary": solarizedPalette.textPrimary[0],
      "--color-icon-primary": solarizedPalette.textPrimary[0],
    },
  },
  onDark: {
    tokens: {
      "--color-text-primary": solarizedPalette.textPrimary[1],
      "--color-icon-primary": solarizedPalette.textPrimary[1],
    },
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: solarizedPalette.body,
      planner: solarizedPalette.surface,
      task: [
        "color-mix(in oklab, var(--color-background-card) 88%, var(--color-text-primary) 12%)",
        "color-mix(in oklab, var(--color-background-card) 91%, var(--color-text-primary) 9%)",
      ],
    }),
  },
});
