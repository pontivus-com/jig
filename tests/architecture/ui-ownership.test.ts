import { readFileSync } from "node:fs";
import { tokenDefaults } from "@astryxdesign/core/theme";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("UI ownership architecture", () => {
  it("keeps Jig CSS outside Astryx private implementation details", () => {
    const css = source("ui/src/styles.css");

    expect(css).not.toMatch(/@layer\s+jig\b/);
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/--_[A-Za-z0-9_-]+/);
    expect(css).not.toMatch(/\.astryx-[A-Za-z0-9_-]+/);
    expect(css).not.toContain("var(--jig-");
    expect(css).not.toContain(".jig-shell");
    expect(css).not.toContain(".jig-sidebar");
    expect(css).not.toContain(".jig-mobile-destination-menu");
    expect(css).not.toContain(".jig-task-menu-panel");
  });

  it("only consumes public Astryx global tokens from Jig CSS", () => {
    const css = source("ui/src/styles.css");
    const usedTokens = new Set(
      [...css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map(
        (match) => match[1],
      ),
    );
    const unknown = [...usedTokens]
      .filter((name) => !(name in tokenDefaults))
      .sort();

    expect(unknown).toEqual([]);
    expect(css).not.toContain("--shadow-elevation-med");
    expect(css).not.toContain("--color-text-danger");
  });

  it("keeps ordinary visual values on Astryx scales", () => {
    const css = source("ui/src/styles.css");

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

    const rawSpacing = css
      .split("\n")
      .map((line) => line.trim())
      .filter((line) =>
        /^(?:gap|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?):.*\b\d+(?:\.\d+)?px\b/.test(
          line,
        ),
      );

    expect(rawSpacing).toEqual([
      "padding: 20px;",
      "margin-inline-end: 30px;",
      "gap: 30px;",
      "gap: var(--spacing-7) 30px;",
      "padding: 0 calc(var(--spacing-3) + var(--spacing-0-5)) calc(5rem + env(safe-area-inset-bottom, 0px));",
    ]);
  });

  it("uses the built Astryx theme path", () => {
    const theme = source("ui/src/theme.ts");
    const vite = source("vite.config.ts");
    const css = source("ui/src/styles.css");

    expect(theme).toContain('@astryxdesign/theme-neutral/built');
    expect(theme).not.toContain('"@astryxdesign/theme-neutral";');
    expect(theme).toContain("jigThemeSource");
    expect(theme).toContain("__built: true");
    expect(vite).toContain("generateThemeCSS");
    expect(vite).toContain("jig-theme.generated.css");
    expect(css).toContain('@import "./jig-theme.generated.css";');
  });

  it("uses Astryx as the application shell and navigation owner", () => {
    const app = source("ui/src/app.tsx");

    expect(app).toContain("<AppShell");
    expect(app).toContain("sideNav={primarySideNav}");
    expect(app).toContain("mobileNav={{");
    expect(app).toContain('breakpoint: "md"');
    expect(app).toContain("useAppShellMobile");
    expect(app).not.toContain("matchMedia");
    expect(app).not.toContain("NARROW_MEDIA");
    expect(app).toContain("<SideNav");
    expect(app).toContain("<SideNavItem");
    expect(app).not.toContain('className="jig-shell"');
    expect(app).not.toContain('className="jig-sidebar"');
    expect(app).not.toContain("<details");
    expect(app).not.toContain("mobileNav={false}");
  });

  it("uses public Astryx menu, layout and responsive dialog contracts", () => {
    const taskRow = source("ui/src/task-row.tsx");
    const history = source("ui/src/history.tsx");
    const settings = source("ui/src/settings.tsx");
    const editor = source("ui/src/task-editor.tsx");
    const week = source("ui/src/week.tsx");
    const day = source("ui/src/day.tsx");

    expect(taskRow).toContain("DropdownMenu");
    expect(taskRow).not.toContain("jig-task-menu-panel");
    expect(history).toContain("DropdownMenu");
    expect(history).not.toContain("jig-task-menu-panel");
    expect(settings).toContain("<Section");
    expect(settings).toContain("<VStack");
    expect(editor).toContain('variant={isNarrow ? "fullscreen" : "standard"}');
    expect(editor).toContain("endContent={");
    expect(editor).toContain("FieldLabel");
    expect(editor).toContain("isGroupLabel");
    expect(week).toContain('elevation="med"');
    expect(day).toContain('elevation="med"');
  });
});
