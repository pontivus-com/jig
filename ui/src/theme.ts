import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const JIG_BRAND_COLORS = {
  ink: "#0B1426",
  inkSurface: "#111C2F",
  inkRaised: "#162238",
  canvas: "#F7F4EF",
  surface: "#FFFFFF",
  mutedSurface: "#EEEAE3",
  amber: "#F59E0B",
  amberLightInteractive: "#B86C00",
  amberLightText: "#8E5200",
  amberDarkText: "#FFD166",
  amberMutedLight: "#F7E4C3",
  amberMutedDark: "#49320E",
  textSecondaryLight: "#526071",
  textSecondaryDark: "#B7C1CE",
  textDisabledLight: "#8791A0",
  textDisabledDark: "#6F7A88",
  borderEmphasizedLight: "#CDD3DB",
  borderEmphasizedDark: "#3B4656",
} as const;

export const jigTheme = defineTheme({
  name: "jig",
  extends: neutralTheme,
  tokens: {
    "--color-background-body": [
      JIG_BRAND_COLORS.canvas,
      JIG_BRAND_COLORS.ink,
    ],
    "--color-background-surface": [
      JIG_BRAND_COLORS.surface,
      JIG_BRAND_COLORS.inkSurface,
    ],
    "--color-background-card": [
      JIG_BRAND_COLORS.surface,
      JIG_BRAND_COLORS.inkSurface,
    ],
    "--color-background-popover": [
      JIG_BRAND_COLORS.surface,
      JIG_BRAND_COLORS.inkRaised,
    ],
    "--color-background-muted": [
      JIG_BRAND_COLORS.mutedSurface,
      JIG_BRAND_COLORS.inkSurface,
    ],

    // The canonical brand amber remains #F59E0B. Light mode uses the darker
    // functional stop so fills/focus rings retain non-text contrast on white.
    "--color-accent": [
      JIG_BRAND_COLORS.amberLightInteractive,
      JIG_BRAND_COLORS.amber,
    ],
    "--color-accent-muted": [
      JIG_BRAND_COLORS.amberMutedLight,
      JIG_BRAND_COLORS.amberMutedDark,
    ],
    "--color-text-accent": [
      JIG_BRAND_COLORS.amberLightText,
      JIG_BRAND_COLORS.amberDarkText,
    ],
    "--color-icon-accent": [
      JIG_BRAND_COLORS.amberLightInteractive,
      JIG_BRAND_COLORS.amber,
    ],
    "--color-on-accent": [
      JIG_BRAND_COLORS.ink,
      JIG_BRAND_COLORS.ink,
    ],
    "--focus-outline-color": [
      JIG_BRAND_COLORS.amberLightInteractive,
      JIG_BRAND_COLORS.amber,
    ],

    "--color-text-primary": [JIG_BRAND_COLORS.ink, "#F8FAFC"],
    "--color-text-secondary": [
      JIG_BRAND_COLORS.textSecondaryLight,
      JIG_BRAND_COLORS.textSecondaryDark,
    ],
    "--color-text-disabled": [
      JIG_BRAND_COLORS.textDisabledLight,
      JIG_BRAND_COLORS.textDisabledDark,
    ],
    "--color-icon-primary": [JIG_BRAND_COLORS.ink, "#F8FAFC"],
    "--color-icon-secondary": [
      "#5F6B7A",
      JIG_BRAND_COLORS.textSecondaryDark,
    ],
    "--color-icon-disabled": [
      JIG_BRAND_COLORS.textDisabledLight,
      JIG_BRAND_COLORS.textDisabledDark,
    ],

    "--color-neutral": ["#0B14260F", "#FFFFFF1A"],
    "--color-overlay": ["#0B142680", "#000000CC"],
    "--color-overlay-hover": ["#0B14260D", "#FFFFFF0D"],
    "--color-overlay-pressed": ["#0B14261A", "#FFFFFF1A"],
    "--color-border": ["#0B142614", "#FFFFFF1A"],
    "--color-border-emphasized": [
      JIG_BRAND_COLORS.borderEmphasizedLight,
      JIG_BRAND_COLORS.borderEmphasizedDark,
    ],
    "--color-shadow": ["#0B14261A", "#0000004D"],
    "--color-tint-hover": [JIG_BRAND_COLORS.ink, "#FFFFFF"],

    "--shadow-inset-hover":
      "inset 0px 0px 0px 2px light-dark(#B86C004D, #F59E0B4D)",
    "--shadow-inset-selected":
      "inset 0px 0px 0px 2px light-dark(#B86C0080, #F59E0B80)",
  },
});
