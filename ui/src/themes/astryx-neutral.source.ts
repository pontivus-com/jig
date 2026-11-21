import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxNeutralTheme = defineTheme({
  name: "astryx-neutral",
  extends: neutralTheme,
  localTokens: {
    ...jigProductLocalTokens,
  },
});
