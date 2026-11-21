import { defineTheme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxMatchaTheme = defineTheme({
  name: "astryx-matcha",
  extends: matchaTheme,
  localTokens: {
    ...jigProductLocalTokens,
  },
});
