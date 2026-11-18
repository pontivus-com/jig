import {
  defineTheme,
  type CoreTokenName,
} from "@astryxdesign/core/theme";
import { gothicTheme } from "@astryxdesign/theme-gothic/built";
import { jigProductLocalTokens } from "./product-tokens";

/**
 * Astryx Gothic 0.7.13 is intentionally dark-only. Jig v1.0.6 requires every
 * selectable application theme to support coherent Light and Dark modes, so
 * this wrapper preserves Gothic's component/typography/icon mechanics and its
 * released Dark values while deriving a restrained Light neutral layer from
 * Gothic's own public semantic anchors.
 */
function gothicDark(name: CoreTokenName): string {
  const value = gothicTheme.tokens[name];
  if (typeof value !== "string") {
    throw new Error(`Expected Gothic token ${name} to be a single dark value`);
  }
  return value;
}

const lightBackground = gothicDark("--color-on-dark");
const lightForeground = gothicDark("--color-on-light");
const darkBackground = gothicDark("--color-background-body");

function lightMix(
  foreground: string,
  amount: number,
  background = lightBackground,
): string {
  return `color-mix(in srgb, ${foreground} ${amount}%, ${background})`;
}

function darkMuted(color: string, amount = 22): string {
  return `color-mix(in srgb, ${color} ${amount}%, ${darkBackground})`;
}

const lightAccent = gothicDark("--color-icon-purple");
const darkAccent = gothicDark("--color-background-purple");

export const astryxGothicTheme = defineTheme({
  name: "astryx-gothic",
  extends: gothicTheme,
  tokens: {
    "--color-background-body": [lightBackground, darkBackground],
    "--color-background-surface": [
      "color-mix(in srgb, white 72%, var(--color-on-dark))",
      gothicDark("--color-background-surface"),
    ],
    "--color-background-card": [
      "white",
      gothicDark("--color-background-card"),
    ],
    "--color-background-popover": [
      "white",
      gothicDark("--color-background-popover"),
    ],
    "--color-background-muted": [
      lightMix(lightForeground, 8),
      gothicDark("--color-background-muted"),
    ],

    "--color-accent": [lightAccent, darkAccent],
    "--color-accent-muted": [
      lightMix(lightAccent, 16),
      darkMuted(darkAccent, 20),
    ],
    "--color-on-accent": [lightBackground, lightForeground],
    "--color-text-accent": [lightAccent, darkAccent],
    "--color-icon-accent": [lightAccent, darkAccent],
    "--focus-outline-color": [lightAccent, darkAccent],

    "--color-neutral": [
      lightMix(lightForeground, 8),
      gothicDark("--color-neutral"),
    ],
    "--color-overlay": [
      "color-mix(in srgb, var(--color-on-light) 52%, transparent)",
      gothicDark("--color-overlay"),
    ],
    "--color-overlay-hover": [
      "color-mix(in srgb, var(--color-on-light) 7%, transparent)",
      gothicDark("--color-overlay-hover"),
    ],
    "--color-overlay-pressed": [
      "color-mix(in srgb, var(--color-on-light) 14%, transparent)",
      gothicDark("--color-overlay-pressed"),
    ],

    "--color-text-primary": [lightForeground, gothicDark("--color-text-primary")],
    "--color-text-secondary": [
      lightMix(lightForeground, 68),
      gothicDark("--color-text-secondary"),
    ],
    "--color-text-disabled": [
      lightMix(lightForeground, 42),
      gothicDark("--color-text-disabled"),
    ],
    "--color-icon-primary": [lightForeground, gothicDark("--color-icon-primary")],
    "--color-icon-secondary": [
      lightMix(lightForeground, 68),
      gothicDark("--color-icon-secondary"),
    ],
    "--color-icon-disabled": [
      lightMix(lightForeground, 42),
      gothicDark("--color-icon-disabled"),
    ],

    "--color-info-muted": [
      lightMix(gothicDark("--color-info"), 18),
      darkMuted(gothicDark("--color-info")),
    ],
    "--color-success-muted": [
      lightMix(gothicDark("--color-success"), 18),
      darkMuted(gothicDark("--color-success")),
    ],
    "--color-warning-muted": [
      lightMix(gothicDark("--color-warning"), 18),
      darkMuted(gothicDark("--color-warning")),
    ],
    "--color-error-muted": [
      lightMix(gothicDark("--color-error"), 18),
      darkMuted(gothicDark("--color-error")),
    ],
    "--color-text-info": [
      gothicDark("--color-icon-blue"),
      gothicDark("--color-info"),
    ],
    "--color-text-success": [
      gothicDark("--color-icon-green"),
      gothicDark("--color-success"),
    ],
    "--color-text-warning": [
      gothicDark("--color-icon-yellow"),
      gothicDark("--color-warning"),
    ],
    "--color-text-error": [
      gothicDark("--color-icon-red"),
      gothicDark("--color-error"),
    ],
    "--color-on-info-muted": [
      gothicDark("--color-icon-blue"),
      gothicDark("--color-info"),
    ],
    "--color-on-success-muted": [
      gothicDark("--color-icon-green"),
      gothicDark("--color-success"),
    ],
    "--color-on-warning-muted": [
      gothicDark("--color-icon-yellow"),
      gothicDark("--color-warning"),
    ],
    "--color-on-error-muted": [
      gothicDark("--color-icon-red"),
      gothicDark("--color-error"),
    ],
    "--color-icon-info": [
      gothicDark("--color-icon-blue"),
      gothicDark("--color-info"),
    ],
    "--color-icon-success": [
      gothicDark("--color-icon-green"),
      gothicDark("--color-success"),
    ],
    "--color-icon-warning": [
      gothicDark("--color-icon-yellow"),
      gothicDark("--color-warning"),
    ],
    "--color-icon-error": [
      gothicDark("--color-icon-red"),
      gothicDark("--color-error"),
    ],
    "--color-border-info": [
      gothicDark("--color-icon-blue"),
      gothicDark("--color-info"),
    ],
    "--color-border-success": [
      gothicDark("--color-icon-green"),
      gothicDark("--color-success"),
    ],
    "--color-border-warning": [
      gothicDark("--color-icon-yellow"),
      gothicDark("--color-warning"),
    ],
    "--color-border-error": [
      gothicDark("--color-icon-red"),
      gothicDark("--color-error"),
    ],

    "--color-border": [
      lightMix(lightForeground, 16),
      gothicDark("--color-border"),
    ],
    "--color-border-emphasized": [
      lightMix(lightForeground, 30),
      gothicDark("--color-border-emphasized"),
    ],
    "--color-skeleton": [
      lightMix(lightForeground, 16),
      gothicDark("--color-skeleton"),
    ],
    "--color-shadow": [
      "color-mix(in srgb, black 14%, transparent)",
      gothicDark("--color-shadow"),
    ],
    "--color-tint-hover": [lightForeground, gothicDark("--color-tint-hover")],
  },
  localTokens: {
    ...jigProductLocalTokens,
    "--jig-task-surface": "var(--color-background-card)",
    "--jig-state-today-border": [
      gothicDark("--color-icon-teal"),
      gothicDark("--color-border-teal"),
    ],
    "--jig-state-today-text": [
      gothicDark("--color-icon-teal"),
      gothicDark("--color-border-teal"),
    ],
  },
});
