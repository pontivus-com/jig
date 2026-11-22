import { defineTheme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const astryxButterTheme = defineTheme({
  name: "astryx-butter",
  extends: butterTheme,
  tokens: jigMotionTokens,
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner: "var(--color-background-surface)",
      task:
        "color-mix(in oklab, var(--color-background-card) 86%, var(--color-text-primary) 14%)",
    }),
  },
});
