import { defineTheme } from "@astryxdesign/core/theme";
import { y2kTheme } from "@astryxdesign/theme-y2k/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxY2kTheme = defineTheme({
  name: "astryx-y2k",
  extends: y2kTheme,
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner: "var(--color-background-surface)",
      task:
        "color-mix(in oklab, var(--color-background-card) 84%, var(--color-text-primary) 16%)",
    }),
  },
});
