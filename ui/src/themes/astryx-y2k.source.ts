import { defineTheme } from "@astryxdesign/core/theme";
import { y2kTheme } from "@astryxdesign/theme-y2k/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxY2kTheme = defineTheme({
  name: "astryx-y2k",
  extends: y2kTheme,
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
