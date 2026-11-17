import { defineTheme } from "@astryxdesign/core/theme";
import { gothicTheme } from "@astryxdesign/theme-gothic/built";
import { jigProductLocalTokens } from "./product-tokens";

export const astryxGothicTheme = defineTheme({
  name: "astryx-gothic",
  extends: gothicTheme,
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-card)",
  },
});
