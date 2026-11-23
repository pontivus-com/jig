import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { jigProductLocalTokens } from "./themes/product-tokens";
import { jigMotionTokens } from "./themes/motion-tokens";

/**
 * Jig's Astryx semantic theme source.
 *
 * Raw palette values live only in theme.css. This file is authoring input for
 * Astryx `theme build`; application runtime code consumes only the generated
 * built theme module and stylesheet.
 */
export const jigTheme = defineTheme({
  name: "jig",
  extends: neutralTheme,
  tokens: {
    ...jigMotionTokens,
    "--color-background-body": [
      "var(--jig-paper-100)",
      "var(--jig-ink-950)",
    ],
    "--color-background-surface": [
      "var(--jig-white)",
      "var(--jig-ink-900)",
    ],
    "--color-background-card": [
      "var(--jig-paper-50)",
      "var(--jig-ink-800)",
    ],
    "--color-background-popover": [
      "var(--jig-white)",
      "var(--jig-ink-800)",
    ],
    "--color-background-muted": [
      "var(--jig-paper-200)",
      "var(--jig-ink-900)",
    ],

    // Brand amber is #F59E0B. Light UI uses the darker 700 stop for
    // non-text contrast on white/paper; dark UI can use canonical amber.
    "--color-accent": [
      "var(--jig-amber-700)",
      "var(--jig-amber-500)",
    ],
    "--color-accent-muted": [
      "var(--jig-amber-100)",
      "color-mix(in oklab, var(--jig-amber-500) 22%, var(--jig-ink-900))",
    ],
    "--color-text-accent": [
      "var(--jig-amber-800)",
      "var(--jig-amber-300)",
    ],
    "--color-icon-accent": [
      "var(--jig-amber-700)",
      "var(--jig-amber-500)",
    ],
    "--color-on-accent": [
      "var(--jig-ink-950)",
      "var(--jig-ink-950)",
    ],
    "--focus-outline-color": [
      "var(--jig-amber-700)",
      "var(--jig-amber-500)",
    ],

    "--color-text-primary": [
      "var(--jig-ink-950)",
      "var(--jig-ink-50)",
    ],
    "--color-text-secondary": [
      "var(--jig-ink-600)",
      "var(--jig-ink-300)",
    ],
    "--color-text-disabled": [
      "var(--jig-ink-400)",
      "var(--jig-ink-600)",
    ],
    "--color-icon-primary": [
      "var(--jig-ink-950)",
      "var(--jig-ink-50)",
    ],
    "--color-icon-secondary": [
      "var(--jig-ink-600)",
      "var(--jig-ink-300)",
    ],
    "--color-icon-disabled": [
      "var(--jig-ink-400)",
      "var(--jig-ink-600)",
    ],

    "--color-neutral": [
      "color-mix(in srgb, var(--jig-ink-950) 6%, transparent)",
      "color-mix(in srgb, var(--jig-white) 10%, transparent)",
    ],
    "--color-overlay": [
      "color-mix(in srgb, var(--jig-ink-950) 50%, transparent)",
      "color-mix(in srgb, black 80%, transparent)",
    ],
    "--color-overlay-hover": [
      "color-mix(in srgb, var(--jig-ink-950) 5%, transparent)",
      "color-mix(in srgb, var(--jig-white) 5%, transparent)",
    ],
    "--color-overlay-pressed": [
      "color-mix(in srgb, var(--jig-ink-950) 10%, transparent)",
      "color-mix(in srgb, var(--jig-white) 10%, transparent)",
    ],
    "--color-border": [
      "color-mix(in srgb, var(--jig-ink-950) 8%, transparent)",
      "color-mix(in srgb, var(--jig-white) 10%, transparent)",
    ],
    "--color-border-emphasized": [
      "var(--jig-ink-200)",
      "var(--jig-ink-700)",
    ],
    "--color-shadow": [
      "color-mix(in srgb, var(--jig-ink-950) 12%, transparent)",
      "color-mix(in srgb, black 36%, transparent)",
    ],
    "--color-tint-hover": [
      "var(--jig-ink-950)",
      "var(--jig-white)",
    ],

    "--shadow-inset-hover":
      "inset 0 0 0 2px light-dark(color-mix(in srgb, var(--jig-amber-700) 32%, transparent), color-mix(in srgb, var(--jig-amber-500) 32%, transparent))",
    "--shadow-inset-selected":
      "inset 0 0 0 2px light-dark(color-mix(in srgb, var(--jig-amber-700) 55%, transparent), color-mix(in srgb, var(--jig-amber-500) 55%, transparent))",
  },
  localTokens: {
    ...jigProductLocalTokens({
      chrome: "var(--color-background-body)",
      planner: "var(--color-background-surface)",
      task:
        "color-mix(in oklab, var(--color-background-card) 94%, var(--color-text-primary) 6%)",
    }),
  },
});
