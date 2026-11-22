import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tokenDefaults } from "@astryxdesign/core/theme";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}


const STYLE_LAYER_PATHS = [
  "ui/src/styles/shared.css",
  "ui/src/styles/desktop.css",
  "ui/src/styles/narrow.css",
  "ui/src/styles/motion.css",
] as const;

function styleSource(): string {
  return STYLE_LAYER_PATHS.map(source).join("\n");
}

const JIG_LAYOUT_TOKENS = new Set([
  "--jig-safe-area-top",
  "--jig-safe-area-bottom",
  "--jig-safe-area-right",
  "--jig-narrow-bottom-content",
  "--jig-narrow-bottom-total",
]);

const GENERATED_THEME_FILES = new Set([
  "jig.css",
  "jig.css.d.ts",
  "jig.js",
  "jig.d.ts",
  "jig.variants.d.ts",
]);

const THEME_IDS = [
  "jig",
  "astryx-neutral",
  "astryx-butter",
  "astryx-chocolate",
  "astryx-matcha",
  "astryx-stone",
  "astryx-y2k",
  "gruvbox",
  "dracula",
  "solarized",
  "nord",
  "catppuccin",
  "tokyo-night",
] as const;

function isGeneratedThemeFile(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("ui/src/themes/")) {
    const name = normalized.slice("ui/src/themes/".length);
    return (
      !name.includes("/") &&
      !name.endsWith(".source.ts") &&
      !name.endsWith("product-tokens.ts") &&
      !name.endsWith("community-theme.ts") &&
      /\.(?:css|css\.d\.ts|d\.ts|variants\.d\.ts)$/.test(name)
    );
  }
  return GENERATED_THEME_FILES.has(normalized.split("/").at(-1) ?? "");
}

const JIG_PRODUCT_TOKENS = new Set([
  "--jig-state-today-border",
  "--jig-state-today-text",
  "--jig-state-task-selected-bg",
  "--jig-state-task-selected-border",
  "--jig-state-nav-active-bg",
  "--jig-state-nav-active-text",
  "--jig-state-drag-border",
  "--jig-state-drag-bg",
  "--jig-priority-high",
  "--jig-priority-normal",
  "--jig-priority-low",
  "--jig-status-healthy-bg",
  "--jig-status-healthy-border",
  "--jig-status-healthy-text",
  "--jig-chrome-surface",
  "--jig-planner-surface",
  "--jig-state-hover-bg",
  "--jig-state-pressed-bg",
  "--jig-task-surface",
  "--jig-task-text",
  "--jig-task-border",
  "--jig-brand-primary",
  "--jig-brand-accent",
]);

function authoredUiSources(
  directory = "ui/src",
): readonly [string, string][] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return authoredUiSources(path);
    }
    if (
      !entry.isFile() ||
      !/\.(?:css|ts|tsx)$/.test(entry.name) ||
      isGeneratedThemeFile(path)
    ) {
      return [];
    }
    return [[path, source(path)] as const];
  });
}

describe("UI ownership architecture", () => {
  it("keeps Jig-authored UI outside Astryx private implementation details", () => {
    for (const [path, content] of authoredUiSources()) {
      expect(content, path).not.toContain("!important");
      expect(content, path).not.toMatch(/--_[A-Za-z0-9_-]+/);
      expect(content, path).not.toMatch(/\.astryx-[A-Za-z0-9_-]+/);
      expect(content, path).not.toMatch(
        /@astryxdesign\/(?:core|theme-[^/"']+)\/(?:src|dist|internal)\b/,
      );
      expect(content, path).not.toContain("__built");
      expect(content, path).not.toContain("generateThemeCSS");
      if (path.endsWith(".tsx")) {
        expect(content, path).not.toMatch(/<(?:button|a)\b/);
      }
    }

    const css = styleSource();
    expect(css).not.toMatch(/@layer\s+jig\b/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    expect(css).not.toContain(".jig-sidebar");
    expect(css).not.toContain(".jig-week-column-selected");
    expect(css).not.toContain(".jig-week-add-task");
    expect(css).toContain(".jig-task-drag-handle");
    expect(css).toContain(".jig-task-prospective-footprint");
    expect(css).not.toContain(".jig-task-drop-indicator");
    expect(css).not.toContain(".jig-task-insertion-slot");
    expect(css).not.toContain("dashed var(--jig-state-drag-border)");
    expect(css).not.toContain(".jig-mobile-quick-add");
    expect(css).not.toContain(".jig-planner-selected-date-heading");
    expect(css).not.toContain(".jig-task-inspector");
  });

  it("authors exact v1.1.2 surface roles in every theme source", () => {
    const productTokens = source("ui/src/themes/product-tokens.ts");
    expect(productTokens).toContain("export interface JigSurfaceRoles");
    expect(productTokens).toContain(
      "export function jigProductLocalTokens(",
    );
    expect(productTokens).toContain(
      '"--jig-chrome-surface": surfaceRoles.chrome',
    );
    expect(productTokens).toContain(
      '"--jig-planner-surface": surfaceRoles.planner',
    );
    expect(productTokens).toContain(
      '"--jig-task-surface": surfaceRoles.task',
    );

    const expectedRoles = new Map<string, readonly string[]>([
      [
        "ui/src/jig-theme.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 94%, var(--color-text-primary) 6%)"',
        ],
      ],
      [
        "ui/src/themes/astryx-neutral.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 84%, var(--color-text-primary) 16%)"',
        ],
      ],
      [
        "ui/src/themes/astryx-butter.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 86%, var(--color-text-primary) 14%)"',
        ],
      ],
      [
        "ui/src/themes/astryx-chocolate.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          '"color-mix(in oklab, var(--color-background-surface) 65%, var(--color-background-muted) 35%)"',
          'task: "var(--color-background-card)"',
        ],
      ],
      [
        "ui/src/themes/astryx-matcha.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 86%, var(--color-text-primary) 14%)"',
        ],
      ],
      [
        "ui/src/themes/astryx-stone.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 86%, var(--color-text-primary) 14%)"',
        ],
      ],
      [
        "ui/src/themes/astryx-y2k.source.ts",
        [
          'chrome: "var(--color-background-body)"',
          'planner: "var(--color-background-surface)"',
          '"color-mix(in oklab, var(--color-background-card) 84%, var(--color-text-primary) 16%)"',
        ],
      ],
      [
        "ui/src/themes/gruvbox.source.ts",
        [
          "chrome: gruvboxPalette.body",
          "planner: gruvboxPalette.surface",
          "task: gruvboxPalette.card",
        ],
      ],
      [
        "ui/src/themes/dracula.source.ts",
        [
          "chrome: draculaPalette.body",
          "planner: draculaPalette.surface",
          '"color-mix(in oklab, var(--color-background-card) 97%, var(--color-text-primary) 3%)"',
        ],
      ],
      [
        "ui/src/themes/solarized.source.ts",
        [
          "chrome: solarizedPalette.body",
          "planner: solarizedPalette.surface",
          '"color-mix(in oklab, var(--color-background-card) 88%, var(--color-text-primary) 12%)"',
          '"color-mix(in oklab, var(--color-background-card) 91%, var(--color-text-primary) 9%)"',
        ],
      ],
      [
        "ui/src/themes/nord.source.ts",
        [
          "chrome: nordPalette.body",
          "planner: nordPalette.surface",
          "task: nordPalette.card",
        ],
      ],
      [
        "ui/src/themes/catppuccin.source.ts",
        [
          "chrome: catppuccinPalette.body",
          "planner: catppuccinPalette.surface",
          "task: catppuccinPalette.card",
        ],
      ],
      [
        "ui/src/themes/tokyo-night.source.ts",
        [
          "chrome: tokyoNightPalette.body",
          "planner: tokyoNightPalette.surface",
          '"color-mix(in oklab, var(--color-background-card) 99%, var(--color-text-primary) 1%)"',
        ],
      ],
    ]);

    for (const [themePath, expected] of expectedRoles) {
      const themeSource = source(themePath);
      expect(themeSource, themePath).toContain("jigProductLocalTokens({");
      for (const expression of expected) {
        expect(themeSource, `${themePath}: ${expression}`).toContain(
          expression,
        );
      }
    }
  });

  it("applies the governed public motion scale to every authored theme", () => {
    const motion = source("ui/src/themes/motion-tokens.ts");
    const expected = [
      ["--duration-fast-min", "190ms"],
      ["--duration-fast", "250ms"],
      ["--duration-fast-max", "330ms"],
      ["--duration-medium-min", "450ms"],
      ["--duration-medium", "600ms"],
      ["--duration-medium-max", "800ms"],
      ["--duration-slow-min", "1050ms"],
      ["--duration-slow", "1400ms"],
      ["--duration-slow-max", "1870ms"],
    ] as const;

    for (const [token, value] of expected) {
      expect(motion).toContain(`"${token}": "${value}"`);
    }

    const authoredThemeSources = [
      "ui/src/jig-theme.source.ts",
      "ui/src/themes/astryx-neutral.source.ts",
      "ui/src/themes/astryx-butter.source.ts",
      "ui/src/themes/astryx-chocolate.source.ts",
      "ui/src/themes/astryx-matcha.source.ts",
      "ui/src/themes/astryx-stone.source.ts",
      "ui/src/themes/astryx-y2k.source.ts",
      "ui/src/themes/gruvbox.source.ts",
      "ui/src/themes/dracula.source.ts",
      "ui/src/themes/solarized.source.ts",
      "ui/src/themes/nord.source.ts",
      "ui/src/themes/catppuccin.source.ts",
      "ui/src/themes/tokyo-night.source.ts",
    ] as const;

    for (const themePath of authoredThemeSources) {
      expect(source(themePath), themePath).toContain("jigMotionTokens");
    }

    const generatedThemeCss = [
      "ui/src/jig.css",
      ...authoredThemeSources.slice(1).map((themePath) =>
        themePath.replace(/\.source\.ts$/, ".css"),
      ),
    ];
    for (const cssPath of generatedThemeCss) {
      const css = source(cssPath);
      for (const [token, value] of expected) {
        expect(css, `${cssPath}: ${token}`).toContain(
          `${token}: ${value};`,
        );
      }
    }
  });

  it("consumes only Astryx public tokens plus governed Jig product aliases", () => {
    const css = styleSource();
    const usedTokens = new Set(
      [...css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].flatMap(
        (match) => (match[1] === undefined ? [] : [match[1]]),
      ),
    );
    const unknown = [...usedTokens]
      .filter(
        (name) =>
          !(name in tokenDefaults) &&
          !JIG_PRODUCT_TOKENS.has(name) &&
          !JIG_LAYOUT_TOKENS.has(name),
      )
      .sort();

    expect(unknown).toEqual([]);

    const common = source("ui/src/themes/product-tokens.ts");
    for (const token of JIG_PRODUCT_TOKENS) {
      expect(common).toContain(`"${token}"`);
    }
    expect(common).not.toContain('"--jig-lane-surface"');
    expect(common).toContain(
      '"--jig-task-text": "light-dark(var(--color-on-light), var(--color-on-dark))"',
    );
    expect(common).toContain(
      '"--jig-chrome-surface": surfaceRoles.chrome',
    );
    expect(common).toContain(
      '"--jig-planner-surface": surfaceRoles.planner',
    );
    expect(common).toContain(
      '"--jig-task-surface": surfaceRoles.task',
    );

    expect(css).toMatch(
      /\.jig-app-header\s*\{[^}]*background:\s*var\(--jig-chrome-surface\)/s,
    );
    expect(css).toMatch(
      /\.jig-mobile-bottom-navigation\s*\{[^}]*background:\s*var\(--jig-chrome-surface\)/s,
    );
    expect(css).not.toMatch(
      /\.jig-week-column\s*\{[^}]*\bbackground:/s,
    );
    expect(css).toMatch(
      /\.jig-task-card\s*\{[^}]*background:\s*var\(--jig-task-surface/s,
    );
  });

  it("keeps ordinary visual values on Astryx scales", () => {
    const css = styleSource();

    expect(css).not.toMatch(/font-size:\s*(?:\d|\.)/);
    expect(css).not.toMatch(/font-weight:\s*\d/);
    expect(css).not.toMatch(/transition:[^}]*\b\d+(?:\.\d+)?ms\b/);

    const literalRadii = [...css.matchAll(/border-radius:\s*([^;]+);/g)]
      .map((match) => match[1]?.trim())
      .filter(
        (value): value is string =>
          value !== undefined &&
          value !== "0" &&
          !value.startsWith("var(") &&
          !value.startsWith("calc("),
      );
    expect(literalRadii).toEqual([]);
  });

  it("uses one exhaustive Astryx theme registry and CLI-generated theme set", () => {
    const app = source("ui/src/app.tsx");
    const appearance = source("ui/src/appearance.ts");
    const manifest = source("scripts/build-themes.ts");
    const styles = styleSource();
    const verifyWorkflow = source(".github/workflows/verify.yml");

    expect(app).toContain("<Theme theme={themeFor(themePreset)} mode={appearanceMode}>");
    expect((app.match(/<Theme\b/g) ?? [])).toHaveLength(1);
    expect(app).not.toContain("matchMedia(");
    expect(appearance).toContain("export const THEME_DEFINITIONS = [");
    expect(appearance).toContain('export type AppearanceMode = "system" | "light" | "dark"');
    expect(
      [...appearance.matchAll(/\bid: "([^"]+)"/g)].map((match) => match[1]),
    ).toEqual([...THEME_IDS]);
    expect(appearance).not.toContain("astryx-gothic");
    expect(manifest).not.toContain("astryx-gothic");
    expect(styles).not.toContain("astryx-gothic");
    expect(source("package.json")).not.toContain("@astryxdesign/theme-gothic");

    for (const id of THEME_IDS) {
      expect(appearance).toContain(`id: "${id}"`);
      const sourcePath =
        id === "jig"
          ? "ui/src/jig-theme.source.ts"
          : `ui/src/themes/${id}.source.ts`;
      const builtPath =
        id === "jig"
          ? "ui/src/jig.js"
          : `ui/src/themes/${id}.js`;
      const cssPath =
        id === "jig"
          ? "ui/src/jig.css"
          : `ui/src/themes/${id}.css`;

      expect(manifest).toContain(sourcePath);
      expect(source(builtPath)).toContain("@generated by `astryx theme build`");
      expect(source(cssPath)).toContain("data-astryx-theme");
      expect(styles).toContain(
        id === "jig"
          ? '@import "../jig.css";'
          : `@import "../themes/${id}.css";`,
      );
    }

    expect(verifyWorkflow).toContain("bun run theme:check");
  });

  it("uses one AppShell owner and one typed destination definition across layouts", () => {
    const app = source("ui/src/app.tsx");
    const shell = source("ui/src/presentation/shared/application-shell.tsx");
    const header = source("ui/src/planner-header.tsx");
    const destinations = source("ui/src/destinations.ts");
    const desktop = source(
      "ui/src/presentation/desktop/configured-application.tsx",
    );
    const desktopHeader = source(
      "ui/src/presentation/desktop/header.tsx",
    );
    const narrow = source(
      "ui/src/presentation/narrow/configured-application.tsx",
    );
    const narrowHeader = source(
      "ui/src/presentation/narrow/header.tsx",
    );
    const narrowNavigation = source(
      "ui/src/presentation/narrow/bottom-navigation.tsx",
    );
    const layoutMode = source("ui/src/use-layout-mode.ts");

    expect(shell).toContain("<AppShell");
    expect((shell.match(/<AppShell\b/g) ?? [])).toHaveLength(1);
    expect(shell).toContain("function ApplicationShell");
    expect(shell).toContain("mobileNav={false}");
    expect(shell).not.toContain("<SideNav");
    expect(app).toContain("<OnboardingHeader layoutMode={layoutMode} />");
    expect(app).toContain("initialDestinationNavigation");
    expect(app).toContain("installNativeBackButtonListener");
    expect(app).toContain("<DesktopConfiguredApplication");
    expect(app).toContain("<NarrowConfiguredApplication");
    expect(desktop).toContain('data-jig-configured-presentation="desktop"');
    expect(narrow).toContain('data-jig-configured-presentation="narrow"');

    expect(destinations).toContain("export const DESTINATIONS = [");
    expect(destinations).toContain('id: "planner"');
    expect(destinations).toContain('label: "Planner"');
    expect(destinations).toContain('id: "history"');
    expect(destinations).toContain('label: "History"');
    expect(destinations).toContain('id: "settings"');
    expect(destinations).toContain('label: "Settings"');
    expect(destinations).toContain(
      'export type Destination = (typeof DESTINATIONS)[number]["id"]',
    );
    const navigation = source("ui/src/navigation.ts");
    expect(navigation).toContain('import type { Destination } from "./destinations"');
    expect(navigation).not.toMatch(/export type Destination\s*=/);
    expect(destinations).toContain("IconName");
    expect(destinations).toContain("NamespacedIconName");
    expect(header).toContain('from "./destinations"');
    expect(header).not.toContain("LayoutMode");
    expect(header).not.toContain("layoutMode");
    expect(header).not.toContain("DesktopConfiguredHeader");
    expect(header).not.toContain("NarrowConfiguredHeader");
    expect(desktop).toContain("<DesktopConfiguredHeader");
    expect(narrow).toContain("<NarrowConfiguredHeader");
    expect(narrow).toContain("<NarrowBottomNavigation");
    expect(desktopHeader).toContain("export function DesktopConfiguredHeader");
    expect(desktopHeader).toContain("<DestinationNav");
    expect(narrowHeader).toContain("export function NarrowConfiguredHeader");
    expect(narrowHeader).toContain("compactStatusControl");
    expect(narrowNavigation).toContain("export function NarrowBottomNavigation");
    expect(narrowNavigation).toContain('className="jig-mobile-bottom-navigation"');
    expect(narrowNavigation).toContain('className="jig-mobile-add-fab"');
    expect(narrowNavigation).toContain("DESTINATIONS.map((item)");
    expect(narrowNavigation).toContain('aria-label="Primary"');
    expect(header).not.toContain("<Popover");
    expect(header).not.toContain("<SideNav");

    expect(layoutMode).toContain(
      'DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 73rem)"',
    );
  });

  it("uses the canonical wordmark and governed semantic icon system", () => {
    const header = source("ui/src/planner-header.tsx");
    const destinations = source("ui/src/destinations.ts");
    const desktopHeader = source("ui/src/presentation/desktop/header.tsx");
    const narrowNavigation = source("ui/src/presentation/narrow/bottom-navigation.tsx");
    const plannerDate = source(
      "ui/src/presentation/shared/planner-date-section.tsx",
    );
    const taskRow = source("ui/src/task-row.tsx");
    const icons = source("ui/src/jig-icons.tsx");

    const logo = source("ui/src/jig-logo.tsx");
    expect(header).toContain('import { JigLogo } from "./jig-logo"');
    expect(header).toContain("<JigLogo />");
    expect(header).not.toContain("assets/jig-logo");
    expect(header).not.toContain("jig-symbol");
    expect(header).not.toContain("<strong>Jig</strong>");
    expect(logo).toContain('stroke="var(--jig-brand-primary)"');
    expect(logo).toContain('fill="var(--jig-brand-accent)"');
    expect(logo).toContain('fill="var(--jig-brand-primary)"');

    expect(destinations).toContain('icon: "viewColumns"');
    expect(destinations).toContain('icon: "wrench"');
    expect(destinations).toContain("JIG_ICON_KEYS.history");
    expect(desktopHeader).toContain('<JigIcon name="add"');
    expect(narrowNavigation).toContain('<JigIcon name="add"');
    expect(plannerDate).toContain('<JigIcon name="add"');
    expect(taskRow).toContain('<JigIcon name="edit"');
    expect(taskRow).toContain('<JigIcon name="delete"');
    expect(taskRow).toContain('icon="externalLink"');
    expect(taskRow).toContain('icon="copy"');
    expect(taskRow).toContain('icon="moreHorizontal"');
    expect(taskRow).toContain('icon="clock"');
    expect(taskRow).toContain('<JigIcon name="drag"');

    expect(icons).toContain("satisfies Record<JigIconName, NamespacedIconName>");
    expect(icons).not.toContain("as IconName");

    for (const content of [header, plannerDate, taskRow]) {
      expect(content).not.toContain('aria-hidden="true">+</span>');
      expect(content).not.toContain("•••");
      expect(content).not.toContain("≡");
    }
  });

  it("keeps AppShell as the configured scroll owner and CSS ownership explicit", () => {
    const entry = source("ui/src/styles.css");
    const shared = source("ui/src/styles/shared.css");
    const desktop = source("ui/src/styles/desktop.css");
    const narrow = source("ui/src/styles/narrow.css");
    const motion = source("ui/src/styles/motion.css");
    const css = styleSource();

    expect(entry).toBe(
      [
        '@import "./styles/shared.css";',
        '@import "./styles/desktop.css";',
        '@import "./styles/narrow.css";',
        '@import "./styles/motion.css";',
        "",
      ].join("\n"),
    );

    expect(shared).toContain(".jig-app-shell {");
    expect(shared).toContain(".jig-configured-body {");
    expect(shared).toContain("min-block-size: 100%;");
    expect(shared).toContain("flex: 1 1 auto;");
    expect(shared).toMatch(
      /\.jig-content-frame\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto;[^}]*flex-direction:\s*column;/s,
    );
    expect(shared).toMatch(
      /\.jig-content-configured-planner\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
    expect(shared).toMatch(
      /\.jig-content-configured-planner \.jig-planner-surface\s*\{[^}]*flex:\s*1 0 auto;/s,
    );
    expect(shared).not.toMatch(
      /\.jig-content-frame\s*\{[^}]*(?:overflow|height:\s*100%)/s,
    );

    expect(desktop).toContain(".jig-configured-desktop .jig-app-header-desktop");
    expect(narrow).toContain(".jig-configured-narrow .jig-app-header-narrow");
    expect(narrow).toContain("height: 52px;");
    expect(narrow).toContain("--jig-narrow-bottom-content: 64px;");
    expect(narrow).toContain("width: 56px;");
    expect(narrow).toContain("height: 56px;");
    expect(narrow).toContain("min-width: 48px;");
    expect(narrow).toContain("min-height: 48px;");
    expect(narrow).not.toContain("@media (max-width:");
    expect(desktop).not.toContain("@media (max-width:");
    expect(shared).not.toContain(
      "grid-template-columns: repeat(7, minmax(10rem, 1fr))",
    );
    expect(desktop).toContain(".jig-planner-board-desktop");
    expect(desktop).toContain(
      "grid-template-columns: repeat(7, minmax(10rem, 1fr))",
    );
    expect(narrow).toContain(".jig-planner-board-narrow");
    expect(narrow).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );

    expect(motion).toContain("@keyframes jig-destination-content-enter");
    expect(motion).toContain("@media (prefers-reduced-motion: reduce)");
    expect(shared).not.toContain("@keyframes ");
    expect(desktop).not.toContain("@keyframes ");
    expect(narrow).not.toContain("@keyframes ");
    expect(shared).not.toMatch(/\btransition\s*:/);
    expect(desktop).not.toMatch(/\btransition\s*:/);
    expect(narrow).not.toMatch(/\btransition\s*:/);

    expect(css).not.toContain("height: 3.5rem;");
    expect(css).not.toContain("@media (max-width: 75.999rem)");
    expect(css).not.toContain(".jig-planner-narrow");
    expect(css).not.toContain("max-width: 1170px");
    expect(css).not.toContain("calc(5rem + env(safe-area-inset-bottom");
  });

  it("keeps secondary desktop screens constrained without constraining Planner", () => {
    const css = styleSource();

    expect(css).toContain(".jig-history-view,");
    expect(css).toContain(".jig-settings-view {");
    expect(css).toContain("max-width: 50rem;");
    expect(css).toContain("margin-inline: auto;");
    expect(css).toContain("padding-inline: var(--spacing-1);");
    expect(css).toContain(".jig-settings-sections {");
    expect(css).not.toContain(".jig-settings-grid {");
    expect(css).not.toContain("grid-template-columns: 560px minmax(0, 580px);");
    expect(css).not.toMatch(
      /\.jig-history-view,\s*\n\s*\.jig-settings-view\s*\{[^}]*max-width:\s*none/s,
    );
  });

  it("keeps History and Settings heading ownership in the application header", () => {
    const header = source("ui/src/planner-header.tsx");
    const destinations = source("ui/src/destinations.ts");
    const history = source("ui/src/history.tsx");
    const settings = source("ui/src/settings.tsx");
    const css = styleSource();

    expect(header).toContain("function DestinationHeading");
    expect(destinations).toContain("Completed work grouped by actual completion date");
    expect(destinations).toContain("Repository, synchronization, appearance and diagnostics");
    expect(header).toContain('<h1 className="jig-header-destination-title">');
    expect(header).toContain('className="jig-header-destination-subtitle"');
    expect(history).not.toContain("jig-reference-heading");
    expect(settings).not.toContain("jig-reference-heading");
    expect(history).not.toContain("<h1>History</h1>");
    expect(settings).not.toContain("<h1>Settings</h1>");
    expect(css).toContain(".jig-header-destination-heading {");
    expect(css).toContain(".jig-header-destination-subtitle {");
    expect(css).not.toContain(".jig-reference-heading {");
    expect(settings).toContain("planningDataHomePresentation");
    expect(settings).toContain("<dt>Local Git</dt>");
    expect(settings).toContain("<dt>Remote Git</dt>");
    expect(settings).toContain('label="Sync now"');
  });

  it("keeps onboarding orchestration shared and presentation/capability ownership explicit", () => {
    const app = source("ui/src/app.tsx");
    const setup = source("ui/src/setup.tsx");
    const setupHttp = source("ui/src/setup-http.ts");
    const nativeSetup = source("ui/src/native/github-setup.ts");
    const deviceFlow = source("ui/src/github-device-flow.tsx");
    const desktopSetup = source("ui/src/presentation/desktop/setup.tsx");
    const narrowSetup = source("ui/src/presentation/narrow/setup.tsx");
    const sharedCss = source("ui/src/styles/shared.css");
    const desktopCss = source("ui/src/styles/desktop.css");
    const narrowCss = source("ui/src/styles/narrow.css");

    expect(app).toContain("<OnboardingHeader layoutMode={layoutMode} />");
    expect(app).toContain("providerContinuationRevision={setupProviderContinuationRevision}");
    expect(setup).not.toContain("<main");
    expect((setup.match(/layoutMode === "desktop"/g) ?? [])).toHaveLength(1);
    expect(setup).not.toContain('layoutMode === "narrow"');
    expect(setup).toContain("<DesktopSetupPresentation");
    expect(setup).toContain("<NarrowSetupPresentation");

    expect(setup).toContain("status.github_available ?");
    expect(setup).toContain("status.local_repository_available ?");
    expect(setup).toContain("showLocalRepository &&");
    expect(setup).toContain("status.local_repository_available");
    expect(setup).not.toContain("Capacitor");
    expect(setup).not.toContain("isNativePlatform");

    expect(setupHttp).toContain("usesNativeSetupProviderContinuation");
    expect(nativeSetup).toContain("local_repository_available: false");
    expect(setup).toContain("BROWSER_PROVIDER_RETRY_MS");
    expect(setup).toContain('window.addEventListener("focus", observeNow)');
    expect(setup).toContain('document.addEventListener("visibilitychange", onVisible)');
    expect(setup).toContain("providerContinuationRevision");

    expect(desktopSetup).toContain('data-jig-setup-presentation="desktop"');
    expect(desktopSetup).toContain("jig-setup-layout-desktop");
    expect(narrowSetup).toContain('data-jig-setup-presentation="narrow"');
    expect(narrowSetup).toContain("jig-setup-layout-narrow");
    for (const presenter of [desktopSetup, narrowSetup]) {
      expect(presenter).not.toContain("SetupStatus");
      expect(presenter).not.toContain("setup-http");
      expect(presenter).not.toContain("LayoutMode");
    }

    expect(sharedCss).not.toContain("@media (max-width: 72.999rem)");
    expect(sharedCss).not.toContain(".jig-setup-layout-desktop");
    expect(sharedCss).not.toContain(".jig-setup-layout-narrow");
    expect(desktopCss).toContain(".jig-setup-layout-desktop");
    expect(desktopCss).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(22rem, 30rem)",
    );
    expect(narrowCss).toContain(".jig-setup-layout-narrow");
    expect(narrowCss).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );

    expect(setup).toContain('label="Connect GitHub repository"');
    expect(setup).toContain('label="Use an existing local repository"');
    expect(setup).not.toContain("Refresh access");
    expect(setup).not.toContain("Grant repository access");
    expect(setup).not.toContain("Manage GitHub access");
    expect(deviceFlow).toContain('label="Open GitHub"');
    expect(deviceFlow).toContain('"Copy code"');
    expect(deviceFlow).not.toContain("setTimeout");
    expect(deviceFlow).not.toContain("onRefresh");
  });

  it("keeps active-date scheduling policy in the planning core", () => {
    const planning = source("src/core/planning.ts");
    const drag = source("ui/src/drag.tsx");
    const plannerDate = source(
      "ui/src/presentation/shared/planner-date-section.tsx",
    );
    const editor = source("ui/src/task-editor.tsx");

    expect(planning).toContain("export function isActiveScheduleDate(");
    expect(drag).toContain("isActiveScheduleDate");
    expect(plannerDate).toContain("isFutureAddDate");
    expect(editor).toContain("assertActiveScheduleDate");
    expect(drag).not.toMatch(/date\s*<\s*todayCivilDate\(\)/);
    expect(plannerDate).not.toMatch(/date\s*<\s*todayCivilDate\(\)/);
  });

  it("keeps v1.1 mobile form and onboarding composition on governed public owners", () => {
    const taskEditor = source("ui/src/task-editor.tsx");
    const setup = source("ui/src/setup.tsx");
    const app = source("ui/src/app.tsx");
    const styles = styleSource();

    expect(taskEditor).toContain("ToggleButton");
    expect(taskEditor).toContain('className="jig-repeat-weekday"');
    expect(taskEditor).not.toContain("<CheckboxInput");
    expect(taskEditor).toContain(
      'controlClassName="jig-mobile-touch-control"',
    );
    expect(taskEditor).toContain('presentation="adaptive"');
    expect(taskEditor).toContain("jig-mobile-selector-option");
    expect(taskEditor).toContain('style={{ minHeight: "48px" }}');
    expect(source("ui/src/settings.tsx")).toContain(
      'style={{ minHeight: "48px" }}',
    );
    const taskRow = source("ui/src/task-row.tsx");
    expect(taskRow).toContain("TaskCompletionControl");
    expect(taskRow).toContain('className="jig-task-completion-target"');
    expect(taskRow).toContain("<CheckboxInput");
    expect(taskRow).toContain("inputRef.current?.click()");
    expect(source("ui/src/settings.tsx")).toContain(
      'presentation="adaptive"',
    );
    expect(styles).toContain(".jig-mobile-touch-control {");
    expect(styles).toContain("min-width: 48px;");
    expect(styles).toContain("min-height: 48px;");

    const workspace = source("ui/src/task-workspace.tsx");
    const desktopWorkspace = source(
      "ui/src/presentation/desktop/task-workspace.tsx",
    );
    const narrowWorkspace = source(
      "ui/src/presentation/narrow/task-workspace.tsx",
    );
    expect(workspace).toContain("TASK_WORKSPACE_FORM_ID");
    expect(workspace).toContain("TaskWorkspaceContent");
    expect(workspace).toContain("TaskWorkspaceActions");
    expect(workspace).toContain("showActions={false}");
    expect(workspace).not.toContain("<Drawer");
    expect(workspace).not.toContain("<BottomSheet");
    expect(workspace).not.toContain("<LayoutFooter");
    expect(desktopWorkspace).toContain("<Drawer");
    expect(desktopWorkspace).toContain("<LayoutFooter");
    expect(desktopWorkspace).toContain("<TaskWorkspaceActions");
    expect(narrowWorkspace).toContain("<BottomSheet");
    expect(narrowWorkspace).toContain("<LayoutFooter");
    expect(narrowWorkspace).toContain("<TaskWorkspaceActions");
    expect(desktopWorkspace).not.toContain("<BottomSheet");
    expect(narrowWorkspace).not.toContain("<Drawer");
    const desktopWorkspaceCss = source("ui/src/styles/desktop.css");
    const narrowWorkspaceCss = source("ui/src/styles/narrow.css");
    expect(desktopWorkspaceCss).toContain(
      ".jig-task-workspace-actions-desktop",
    );
    expect(desktopWorkspaceCss).toContain(
      ".jig-task-workspace-lifecycle-actions",
    );
    expect(narrowWorkspaceCss).toContain(
      ".jig-task-workspace-actions-narrow",
    );
    expect(narrowWorkspaceCss).toContain(
      "grid-template-columns: minmax(0, 2fr) minmax(0, 3fr)",
    );
    expect(narrowWorkspaceCss).toContain("min-height: 48px");
    const editorActionsStart = styles.indexOf(".jig-editor-actions {");
    const editorActionsEnd = styles.indexOf("}", editorActionsStart);
    expect(editorActionsStart).toBeGreaterThanOrEqual(0);
    expect(
      styles.slice(editorActionsStart, editorActionsEnd + 1),
    ).not.toContain("position: sticky;");

    expect(setup).toContain('readonly layoutMode: LayoutMode;');
    expect((setup.match(/layoutMode === "desktop"/g) ?? [])).toHaveLength(1);
    expect(setup).not.toContain('layoutMode === "narrow"');
    expect(setup).toContain("function SetupBenefits");
    expect(setup).toContain("Plan your week. Keep the data yours.");
    expect(setup).not.toContain("Same plan. Different devices.");
    expect(setup).not.toContain("Choose one repository.");
    expect(app).toContain(
      "providerContinuationRevision={setupProviderContinuationRevision}",
    );

    for (const section of ["Task", "Schedule", "Details", "Notes"]) {
      expect(taskEditor).toContain(`<h3>${section}</h3>`);
    }
  });

  it("keeps appearance controls in Settings and reminder delivery browser-native", () => {
    const app = source("ui/src/app.tsx");
    const settings = source("ui/src/settings.tsx");
    const header = source("ui/src/planner-header.tsx");
    const reminder = source("ui/src/reminder.tsx");
    const browserNotifications = source("ui/src/browser-notifications.ts");

    expect(settings).toContain("<Selector");
    expect(settings).toContain('label="Theme"');
    expect(settings).toContain('label="Appearance"');
    expect(settings).toContain('value="system"');
    expect(settings).toContain('value="light"');
    expect(settings).toContain('value="dark"');
    expect(header).not.toContain("ThemePreset");
    expect(header).not.toContain("AppearanceMode");
    expect(app).toContain("onThemePresetChange={changeThemePreset}");
    expect(app).toContain("onAppearanceModeChange={changeAppearanceMode}");

    expect(reminder).toContain('displayBrowserNotification("Jig reminder"');
    expect(reminder).toContain("export function useReminderClock(): Date");
    expect(reminder).toContain('document.visibilityState === "visible"');
    expect(reminder).not.toContain("new Notification(");
    expect(reminder).not.toContain("useToast");
    expect(reminder).not.toContain("showToast");
    expect(reminder).not.toContain("jig-reminder-toast-content");
    expect(browserNotifications).toContain("registration.showNotification(title, options)");
    expect(browserNotifications).toContain("navigator.serviceWorker");
    expect(browserNotifications).toContain(".register(SERVICE_WORKER_URL)");
  });

  it("keeps Planner and Task workspace state singular", () => {
    const app = source("ui/src/app.tsx");
    const desktopPlanner = source("ui/src/presentation/desktop/planner.tsx");
    const narrowPlanner = source("ui/src/presentation/narrow/planner.tsx");
    const plannerDate = source(
      "ui/src/presentation/shared/planner-date-section.tsx",
    );
    const list = source("ui/src/planner-list.tsx");
    const workspace = source("ui/src/task-workspace.tsx");
    const editor = source("ui/src/task-editor.tsx");
    const taskRow = source("ui/src/task-row.tsx");
    const drag = source("ui/src/drag.tsx");
    const history = source("ui/src/history.tsx");

    expect(app).toContain("interface PlannerState");
    expect(app).toContain("readonly displayedHorizonStart: string");
    expect(app).toContain("plannerHorizonDates");
    expect(app).toContain("movePlannerHorizon");
    expect(app).not.toContain("startOfWeekMonday");
    expect(app).not.toContain("weekDates");
    expect(app).not.toContain("selectedDate");
    expect(app).not.toContain("selectDate");
    expect(app).not.toContain('mode: "view"');
    expect(app).not.toContain('mode: "edit"');

    expect(workspace).toContain("export type TaskWorkspaceState");
    expect(workspace).toContain('readonly mode: "task"');
    expect(workspace).toContain('readonly mode: "create"');
    expect(workspace).not.toContain('readonly mode: "view"');
    expect(
      source("ui/src/presentation/desktop/task-workspace.tsx"),
    ).not.toContain("TaskWorkspaceState");
    expect(
      source("ui/src/presentation/narrow/task-workspace.tsx"),
    ).not.toContain("TaskWorkspaceState");

    expect(existsSync("ui/src/planner.tsx")).toBe(false);
    expect(existsSync("ui/src/week.tsx")).toBe(false);
    expect(app).toContain("<TaskDragProvider");
    expect(desktopPlanner).not.toContain("<TaskDragProvider");
    expect(desktopPlanner).toContain("<PlannerDateSection");
    expect(desktopPlanner).toContain("jig-planner-board-desktop");
    expect(narrowPlanner).not.toContain("<TaskDragProvider");
    expect(narrowPlanner).toContain("<PlannerDateSection");
    expect(narrowPlanner).toContain("jig-planner-board-narrow");
    expect(narrowPlanner).toContain("scrollIntoView");
    expect(desktopPlanner).not.toContain("scrollIntoView");
    expect(plannerDate).toContain("<DateDropZone");
    expect(plannerDate).toContain("<PlannerTaskList");
    expect(plannerDate).toContain("isFutureAddDate");
    expect(plannerDate).not.toContain("layoutMode");
    expect(desktopPlanner).not.toContain("layoutMode");
    expect(narrowPlanner).not.toContain("layoutMode");

    // J112-IMP-11 supersedes the historical insertion-slot/raw-draggable
    // mechanics. This architecture test protects the singular Task-sequence
    // owner and approved dnd-kit boundary without treating the old mechanics
    // as desired behavior.
    expect(list).toContain("function plannerTaskPresentationItems");
    expect(list).toContain("outstandingForDate(tasks, date)");
    expect(list).toContain("function projectedPlannerItems");
    expect(list).toContain("<TaskProspectiveFootprint");
    expect(list).toContain("<SortableTaskRow");
    expect(list).toContain("useTaskDragState()");
    expect(list).not.toContain("TaskInsertionSlot");

    expect(drag).toContain('from "@dnd-kit/react/sortable"');
    expect(drag).toContain("useSortable({");
    expect(drag).not.toContain("useDraggable");
    expect(drag).not.toContain("TaskInsertionSlot");
    expect(drag).not.toContain('"jig-insertion-slot"');
    expect(drag).toContain("event.preventDefault()");
    expect(drag).toContain("TaskProspectivePlacement");
    expect(drag).toContain("TaskProspectiveFootprint");
    expect(drag).toContain("getBoundingClientRect().height");
    expect(drag).toContain("prospectiveRef.current");
    expect(drag).toContain("new PointerActivationConstraints.Distance({");
    expect(drag).toContain("value: 6");
    expect(drag).toContain("new PointerActivationConstraints.Delay({");
    expect(drag).toContain("value: 250");
    expect(drag).toContain("tolerance: 8");
    expect(drag).toContain("activatorElements(source)");
    expect(drag).toContain("source.handle");
    expect(drag).toContain("canonical_index: canonicalIndex");
    expect(drag).toContain("target.data?.canonical_index");
    expect(taskRow).toContain("<TaskCardPresentation");
    expect(taskRow).not.toContain("jig-task-drag-overlay-checkbox");

    expect(editor).not.toContain("optionalText");
    expect(editor).not.toContain("normalizeOptionalText");

    expect(taskRow).toContain("export function TaskActionMenu");
    expect(taskRow).toContain("taskActionMenuItems");
    expect(history).toContain("<TaskActionMenu");
    expect(taskRow).toContain('icon="moreHorizontal"');
    expect(taskRow).toContain('icon="clock"');
    expect(taskRow).toContain('className="jig-task-drag-handle"');
    expect(taskRow).toContain('<JigIcon name="drag"');

    expect(drag).toContain('from "@dnd-kit/react"');
    expect(drag).toContain('from "@dnd-kit/dom"');
    expect(drag).not.toContain("@hello-pangea/dnd");

    expect(existsSync("ui/src/date-strip.tsx")).toBe(false);
    expect(existsSync("ui/src/task-inspector.tsx")).toBe(false);
  });

  it("contains no deprecated Jig-owned adjacent-week pager implementation", () => {
    expect(existsSync("ui/src/week-pager.tsx")).toBe(false);
    expect(existsSync("ui/src/week-swipe.ts")).toBe(false);

    const forbiddenRuntimeFragments = [
      "WeekPager",
      "WeekPagingRequest",
      "weekPagingRequest",
      "WeekPagingDirection",
      "jig-week-pager",
      "jig-week-slide",
      "data-jig-week-page",
      "scrollend",
      ".scrollLeft",
      "scroll-snap-type",
      "scroll-snap-align",
      'mode="passive"',
      'mode: "passive"',
      "PassiveWeek",
      "PassivePlanner",
      "PassiveTask",
      "PlannerTaskPreviewList",
      "TaskCardPassivePreview",
      "jig-week-preview",
      "usePanGesture",
    ] as const;

    for (const [path, content] of authoredUiSources()) {
      for (const fragment of forbiddenRuntimeFragments) {
        expect(content, `${path} must not retain deprecated pager fragment: ${fragment}`)
          .not.toContain(fragment);
      }
    }

    for (const entry of readdirSync("tests/browser", { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) {
        continue;
      }
      const testPath = join("tests/browser", entry.name);
      const content = source(testPath);
      expect(content, testPath).not.toContain(".jig-week-pager");
      expect(content, testPath).not.toContain(".jig-week-slide");
      expect(content, testPath).not.toContain("data-jig-week-page");
      expect(content, testPath).not.toContain("WeekPager");
      expect(content, testPath).not.toContain('new Event("scrollend")');
      expect(content, testPath).not.toContain("pager.scrollLeft");
    }
  });

  it("keeps feedback semantics shared and placement presentation-owned", () => {
    const feedback = source(
      "ui/src/presentation/shared/feedback-content.tsx",
    );
    const desktop = source(
      "ui/src/presentation/desktop/feedback-region.tsx",
    );
    const narrow = source(
      "ui/src/presentation/narrow/feedback-region.tsx",
    );
    const app = source("ui/src/app.tsx");
    const settings = source("ui/src/settings.tsx");
    const setup = source("ui/src/setup.tsx");

    expect(existsSync("ui/src/attention-banner.tsx")).toBe(false);
    expect(feedback).toContain('from "@astryxdesign/core"');
    expect(feedback).toContain("<Icon");
    expect(feedback).not.toContain("<Banner");
    expect(feedback).not.toContain("stylex");
    expect(feedback).toContain("AttentionFeedbackContent");
    expect(feedback).toContain("SuccessFeedbackContent");
    expect(feedback).toContain('icon={icon}');
    expect(feedback).toContain('event.animationName === "jig-success-confirmation-exit"');
    expect(feedback).toContain(
      'window.matchMedia("(prefers-reduced-motion: reduce)").matches',
    );
    expect(feedback).not.toContain("setTimeout(onDismiss");
    expect(feedback).not.toContain("175");

    expect(desktop).toContain("DesktopFeedbackRegion");
    expect(narrow).toContain("NarrowFeedbackRegion");
    const desktopCss = source("ui/src/styles/desktop.css");
    const narrowCss = source("ui/src/styles/narrow.css");
    const sharedCss = source("ui/src/styles/shared.css");

    expect(desktopCss).toContain(".jig-feedback-transient-desktop");
    expect(desktopCss).toContain(".jig-configured-desktop .jig-configured-body");
    expect(desktopCss).toContain("position: relative");
    expect(desktopCss).toContain("position: absolute");
    expect(desktopCss).toContain("inset-block-start: var(--spacing-3)");
    expect(desktopCss).toContain("inset-inline-end: var(--spacing-3)");
    expect(desktopCss).toContain("max-inline-size: 24rem");
    expect(desktopCss).toContain(
      "inline-size: min(50rem, calc(100% - 2 * var(--spacing-3)))",
    );
    expect(narrowCss).toContain(".jig-feedback-transient-narrow");
    expect(narrowCss).toContain("position: fixed");
    expect(narrowCss).toContain(
      "64px + env(safe-area-inset-bottom, 0px) + var(--spacing-3)",
    );
    expect(narrowCss).toContain("max-inline-size: 32rem");
    expect(narrowCss).toContain(
      "margin: var(--spacing-2) var(--spacing-3) 0",
    );
    expect(sharedCss).not.toMatch(
      /\.jig-feedback-transient-(?:desktop|narrow)/,
    );

    expect(desktop).not.toContain("AttentionFeedbackContent");
    expect(narrow).not.toContain("AttentionFeedbackContent");
    expect(app).toContain("<AttentionFeedbackContent");
    expect(app).toContain("<SuccessFeedbackContent");
    expect(settings).not.toContain("<AttentionFeedbackContent");
    expect(settings).not.toContain("operationError");
    expect(setup).toContain("<AttentionFeedbackContent");
    expect(app).not.toContain("<Banner");
    expect(settings).not.toContain("<Banner");
    expect(setup).not.toContain("<Banner");
  });
});
