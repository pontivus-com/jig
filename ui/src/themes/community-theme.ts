import type {
  CoreTokenName,
  TokenValue,
} from "@astryxdesign/core/theme";

export type ColorPair = [light: string, dark: string];

export interface CommunityPalette {
  readonly body: ColorPair;
  readonly surface: ColorPair;
  readonly card: ColorPair;
  readonly popover: ColorPair;
  readonly muted: ColorPair;
  readonly textPrimary: ColorPair;
  readonly textSecondary: ColorPair;
  readonly textDisabled: ColorPair;
  readonly accent: ColorPair;
  readonly info: ColorPair;
  readonly success: ColorPair;
  readonly warning: ColorPair;
  readonly error: ColorPair;
  readonly red: ColorPair;
  readonly orange: ColorPair;
  readonly yellow: ColorPair;
  readonly green: ColorPair;
  readonly teal: ColorPair;
  readonly cyan: ColorPair;
  readonly blue: ColorPair;
  readonly purple: ColorPair;
  readonly pink: ColorPair;
  readonly gray: ColorPair;
}

function mix(color: string, base: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${amount}%, ${base})`;
}

function pairMap(
  pair: ColorPair,
  mapper: (color: string, index: 0 | 1) => string,
): ColorPair {
  return [mapper(pair[0], 0), mapper(pair[1], 1)];
}

function tinted(pair: ColorPair, body: ColorPair, amount = 18): ColorPair {
  return pairMap(pair, (color, index) => mix(color, body[index], amount));
}

function readable(
  pair: ColorPair,
  textPrimary: ColorPair,
  amount = 68,
): ColorPair {
  return pairMap(pair, (color, index) => mix(color, textPrimary[index], amount));
}

function borderPair(pair: ColorPair, textPrimary: ColorPair): ColorPair {
  return readable(pair, textPrimary, 76);
}

function insetShadow(pair: ColorPair, opacity: number): ColorPair {
  return pairMap(
    pair,
    (color) =>
      `inset 0 0 0 2px color-mix(in srgb, ${color} ${opacity}%, transparent)`,
  );
}

export function communityColorTokens(
  palette: CommunityPalette,
): Partial<Record<CoreTokenName, TokenValue>> {
  const accent = readable(palette.accent, palette.textPrimary, 76);
  const info = readable(palette.info, palette.textPrimary, 72);
  const success = readable(palette.success, palette.textPrimary, 72);
  const warning = readable(palette.warning, palette.textPrimary, 72);
  const error = readable(palette.error, palette.textPrimary, 72);

  const families = {
    red: readable(palette.red, palette.textPrimary),
    orange: readable(palette.orange, palette.textPrimary),
    yellow: readable(palette.yellow, palette.textPrimary),
    green: readable(palette.green, palette.textPrimary),
    teal: readable(palette.teal, palette.textPrimary),
    cyan: readable(palette.cyan, palette.textPrimary),
    blue: readable(palette.blue, palette.textPrimary),
    purple: readable(palette.purple, palette.textPrimary),
    pink: readable(palette.pink, palette.textPrimary),
    gray: readable(palette.gray, palette.textPrimary),
  };

  return {
    "--color-background-body": palette.body,
    "--color-background-surface": palette.surface,
    "--color-background-card": palette.card,
    "--color-background-popover": palette.popover,
    "--color-background-muted": palette.muted,
    "--color-background-inverted": palette.textPrimary,
    "--color-background-error-inverted": error,

    "--color-accent": accent,
    "--color-accent-muted": tinted(palette.accent, palette.body, 18),
    "--color-on-accent": palette.body,
    "--color-neutral": pairMap(
      palette.textPrimary,
      (color, index) => mix(color, palette.body[index], index === 0 ? 8 : 14),
    ),

    "--color-overlay": pairMap(
      palette.textPrimary,
      (color) => `color-mix(in srgb, ${color} 55%, transparent)`,
    ),
    "--color-overlay-hover": pairMap(
      palette.textPrimary,
      (color) => `color-mix(in srgb, ${color} 7%, transparent)`,
    ),
    "--color-overlay-pressed": pairMap(
      palette.textPrimary,
      (color) => `color-mix(in srgb, ${color} 14%, transparent)`,
    ),

    "--color-text-primary": palette.textPrimary,
    "--color-text-secondary": palette.textSecondary,
    "--color-text-disabled": palette.textDisabled,
    "--color-text-accent": accent,
    "--color-on-dark": "#ffffff",
    "--color-on-light": "#111111",

    "--color-icon-primary": palette.textPrimary,
    "--color-icon-secondary": palette.textSecondary,
    "--color-icon-disabled": palette.textDisabled,
    "--color-icon-accent": accent,

    "--color-info": info,
    "--color-info-muted": tinted(palette.info, palette.body, 20),
    "--color-on-info": palette.body,
    "--color-text-info": readable(palette.info, palette.textPrimary),
    "--color-on-info-muted": readable(palette.info, palette.textPrimary),

    "--color-success": success,
    "--color-success-muted": tinted(palette.success, palette.body, 20),
    "--color-on-success": palette.body,
    "--color-text-success": readable(palette.success, palette.textPrimary),
    "--color-on-success-muted": readable(palette.success, palette.textPrimary),

    "--color-warning": warning,
    "--color-warning-muted": tinted(palette.warning, palette.body, 20),
    "--color-on-warning": palette.body,
    "--color-text-warning": readable(palette.warning, palette.textPrimary),
    "--color-on-warning-muted": readable(palette.warning, palette.textPrimary),

    "--color-error": error,
    "--color-error-muted": tinted(palette.error, palette.body, 20),
    "--color-on-error": palette.body,
    "--color-text-error": readable(palette.error, palette.textPrimary),
    "--color-on-error-muted": readable(palette.error, palette.textPrimary),

    "--color-border": pairMap(
      palette.textPrimary,
      (color, index) => mix(color, palette.body[index], 16),
    ),
    "--color-border-emphasized": pairMap(
      palette.textPrimary,
      (color, index) => mix(color, palette.body[index], 32),
    ),
    "--color-skeleton": pairMap(
      palette.textPrimary,
      (color, index) => mix(color, palette.body[index], 18),
    ),
    "--color-track": pairMap(
      palette.textPrimary,
      (color, index) => mix(color, palette.body[index], 24),
    ),
    "--color-shadow": [
      "color-mix(in srgb, #000000 14%, transparent)",
      "color-mix(in srgb, #000000 42%, transparent)",
    ],
    "--color-tint-hover": palette.textPrimary,

    "--color-background-red": tinted(palette.red, palette.body, 20),
    "--color-border-red": borderPair(palette.red, palette.textPrimary),
    "--color-icon-red": families.red,
    "--color-text-red": families.red,

    "--color-background-orange": tinted(palette.orange, palette.body, 20),
    "--color-border-orange": borderPair(palette.orange, palette.textPrimary),
    "--color-icon-orange": families.orange,
    "--color-text-orange": families.orange,

    "--color-background-yellow": tinted(palette.yellow, palette.body, 20),
    "--color-border-yellow": borderPair(palette.yellow, palette.textPrimary),
    "--color-icon-yellow": families.yellow,
    "--color-text-yellow": families.yellow,

    "--color-background-green": tinted(palette.green, palette.body, 20),
    "--color-border-green": borderPair(palette.green, palette.textPrimary),
    "--color-icon-green": families.green,
    "--color-text-green": families.green,

    "--color-background-teal": tinted(palette.teal, palette.body, 20),
    "--color-border-teal": borderPair(palette.teal, palette.textPrimary),
    "--color-icon-teal": families.teal,
    "--color-text-teal": families.teal,

    "--color-background-cyan": tinted(palette.cyan, palette.body, 20),
    "--color-border-cyan": borderPair(palette.cyan, palette.textPrimary),
    "--color-icon-cyan": families.cyan,
    "--color-text-cyan": families.cyan,

    "--color-background-blue": tinted(palette.blue, palette.body, 20),
    "--color-border-blue": borderPair(palette.blue, palette.textPrimary),
    "--color-icon-blue": families.blue,
    "--color-text-blue": families.blue,

    "--color-background-purple": tinted(palette.purple, palette.body, 20),
    "--color-border-purple": borderPair(palette.purple, palette.textPrimary),
    "--color-icon-purple": families.purple,
    "--color-text-purple": families.purple,

    "--color-background-pink": tinted(palette.pink, palette.body, 20),
    "--color-border-pink": borderPair(palette.pink, palette.textPrimary),
    "--color-icon-pink": families.pink,
    "--color-text-pink": families.pink,

    "--color-background-gray": tinted(palette.gray, palette.body, 20),
    "--color-border-gray": borderPair(palette.gray, palette.textPrimary),
    "--color-icon-gray": families.gray,
    "--color-text-gray": families.gray,

    "--focus-outline-color": accent,
    "--shadow-inset-hover": insetShadow(accent, 32),
    "--shadow-inset-selected": insetShadow(accent, 55),
    "--shadow-inset-success": insetShadow(success, 30),
    "--shadow-inset-warning": insetShadow(warning, 30),
    "--shadow-inset-error": insetShadow(error, 30),
  };
}
