import type { DefinedTheme } from "@astryxdesign/core/theme";
import { jigTheme } from "./jig.js";
import { astryxNeutralTheme } from "./themes/astryx-neutral.js";
import { astryxButterTheme } from "./themes/astryx-butter.js";
import { astryxChocolateTheme } from "./themes/astryx-chocolate.js";
import { astryxGothicTheme } from "./themes/astryx-gothic.js";
import { astryxMatchaTheme } from "./themes/astryx-matcha.js";
import { astryxStoneTheme } from "./themes/astryx-stone.js";
import { astryxY2kTheme } from "./themes/astryx-y2k.js";
import { gruvboxTheme } from "./themes/gruvbox.js";
import { draculaTheme } from "./themes/dracula.js";
import { solarizedTheme } from "./themes/solarized.js";
import { nordTheme } from "./themes/nord.js";
import { catppuccinTheme } from "./themes/catppuccin.js";
import { tokyoNightTheme } from "./themes/tokyo-night.js";

export type AppearanceMode = "system" | "light" | "dark";
export type ThemeGroup = "Jig" | "Astryx" | "Community";

export const THEME_DEFINITIONS = [
  { id: "jig", label: "Jig", group: "Jig", theme: jigTheme },
  {
    id: "astryx-neutral",
    label: "Neutral",
    group: "Astryx",
    theme: astryxNeutralTheme,
  },
  {
    id: "astryx-butter",
    label: "Butter",
    group: "Astryx",
    theme: astryxButterTheme,
  },
  {
    id: "astryx-chocolate",
    label: "Chocolate",
    group: "Astryx",
    theme: astryxChocolateTheme,
  },
  {
    id: "astryx-gothic",
    label: "Gothic",
    group: "Astryx",
    theme: astryxGothicTheme,
  },
  {
    id: "astryx-matcha",
    label: "Matcha",
    group: "Astryx",
    theme: astryxMatchaTheme,
  },
  {
    id: "astryx-stone",
    label: "Stone",
    group: "Astryx",
    theme: astryxStoneTheme,
  },
  {
    id: "astryx-y2k",
    label: "Y2K",
    group: "Astryx",
    theme: astryxY2kTheme,
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    group: "Community",
    theme: gruvboxTheme,
  },
  {
    id: "dracula",
    label: "Dracula",
    group: "Community",
    theme: draculaTheme,
  },
  {
    id: "solarized",
    label: "Solarized",
    group: "Community",
    theme: solarizedTheme,
  },
  {
    id: "nord",
    label: "Nord",
    group: "Community",
    theme: nordTheme,
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    group: "Community",
    theme: catppuccinTheme,
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    group: "Community",
    theme: tokyoNightTheme,
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly group: ThemeGroup;
  readonly theme: DefinedTheme;
}[];

export type ThemePreset = (typeof THEME_DEFINITIONS)[number]["id"];

export const THEME_GROUPS = ["Jig", "Astryx", "Community"] as const satisfies
  readonly ThemeGroup[];

const THEME_FAMILY_STORAGE_KEY = "jig-theme-family";
const APPEARANCE_MODE_STORAGE_KEY = "jig-appearance-mode";
const LEGACY_APPEARANCE_STORAGE_KEY = "jig-theme";

export function isThemePreset(value: unknown): value is ThemePreset {
  return THEME_DEFINITIONS.some((definition) => definition.id === value);
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

export function themeFor(preset: ThemePreset): DefinedTheme {
  for (const definition of THEME_DEFINITIONS) {
    if (definition.id === preset) {
      return definition.theme;
    }
  }
  throw new Error(`Unknown Jig theme preset: ${preset}`);
}

export function readThemePreset(): ThemePreset {
  try {
    const value = window.localStorage.getItem(THEME_FAMILY_STORAGE_KEY);
    return isThemePreset(value) ? value : "jig";
  } catch {
    return "jig";
  }
}

export function readAppearanceMode(): AppearanceMode {
  try {
    const current = window.localStorage.getItem(APPEARANCE_MODE_STORAGE_KEY);
    if (isAppearanceMode(current)) {
      return current;
    }
    const legacy = window.localStorage.getItem(LEGACY_APPEARANCE_STORAGE_KEY);
    return isAppearanceMode(legacy) ? legacy : "system";
  } catch {
    return "system";
  }
}

export function writeThemePreset(value: ThemePreset): void {
  try {
    window.localStorage.setItem(THEME_FAMILY_STORAGE_KEY, value);
  } catch {
    // Browser-local appearance persistence is best effort.
  }
}

export function writeAppearanceMode(value: AppearanceMode): void {
  try {
    window.localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, value);
    window.localStorage.removeItem(LEGACY_APPEARANCE_STORAGE_KEY);
  } catch {
    // Browser-local appearance persistence is best effort.
  }
}
