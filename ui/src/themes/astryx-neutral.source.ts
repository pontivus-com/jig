import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxNeutralTheme = defineTheme({
  name: "astryx-neutral",
  extends: neutralTheme,
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner: "var(--color-background-surface)",
      task:
        "color-mix(in oklab, var(--color-background-card) 84%, var(--color-text-primary) 16%)",
    }),
  },
});
