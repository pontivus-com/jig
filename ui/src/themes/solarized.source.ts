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
    ...jigProductLocalTokens({
      chrome: solarizedPalette.body,
      planner: solarizedPalette.surface,
      task: [
        "color-mix(in oklab, var(--color-background-card) 88%, var(--color-text-primary) 12%)",
        "color-mix(in oklab, var(--color-background-card) 94%, var(--color-text-primary) 6%)",
      ],
    }),
  },
});
