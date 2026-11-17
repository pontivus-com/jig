import { defineTheme } from "@astryxdesign/core/theme";
import { chocolateTheme } from "@astryxdesign/theme-chocolate/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxChocolateTheme = defineTheme({
  name: "astryx-chocolate",
  extends: chocolateTheme,
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-card)",
  },
});
