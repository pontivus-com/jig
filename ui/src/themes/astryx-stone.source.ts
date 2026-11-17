import { defineTheme } from "@astryxdesign/core/theme";
import { stoneTheme } from "@astryxdesign/theme-stone/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxStoneTheme = defineTheme({
  name: "astryx-stone",
  extends: stoneTheme,
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-surface)",
  },
});
