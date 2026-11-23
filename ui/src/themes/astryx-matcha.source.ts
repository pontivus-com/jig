import { defineTheme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const astryxMatchaTheme = defineTheme({
  name: "astryx-matcha",
  extends: matchaTheme,
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
