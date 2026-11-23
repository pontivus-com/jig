import { defineTheme } from "@astryxdesign/core/theme";
import { stoneTheme } from "@astryxdesign/theme-stone/built";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const astryxStoneTheme = defineTheme({
  name: "astryx-stone",
  extends: stoneTheme,
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
