import { defineTheme } from "@astryxdesign/core/theme";
import { stoneTheme } from "@astryxdesign/theme-stone/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxStoneTheme = defineTheme({
  name: "astryx-stone",
  extends: stoneTheme,
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner: "var(--color-background-surface)",
      task:
        "color-mix(in oklab, var(--color-background-card) 86%, var(--color-text-primary) 14%)",
    }),
  },
});
