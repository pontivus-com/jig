import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { communityColorTokens } from "./community-theme";
import { draculaPalette } from "./palettes/dracula";
import { jigProductLocalTokens } from "./product-tokens";
import { jigMotionTokens } from "./motion-tokens";

export const draculaTheme = defineTheme({
  name: "dracula",
  extends: neutralTheme,
  tokens: {
    ...communityColorTokens(draculaPalette),
    ...jigMotionTokens,
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: draculaPalette.body,
      planner: draculaPalette.surface,
      task:
        "color-mix(in oklab, var(--color-background-card) 97%, var(--color-text-primary) 3%)",
    }),
  },
});
