import { defineTheme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxButterTheme = defineTheme({
  name: "astryx-butter",
  extends: butterTheme,
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
