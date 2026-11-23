import { defineTheme } from "@astryxdesign/core/theme";
import { chocolateTheme } from "@astryxdesign/theme-chocolate/built";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const astryxChocolateTheme = defineTheme({
  name: "astryx-chocolate",
  extends: chocolateTheme,
  tokens: jigMotionTokens,
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner:
        "color-mix(in oklab, var(--color-background-surface) 65%, var(--color-background-muted) 35%)",
      task: "var(--color-background-card)",
    }),
  },
});
