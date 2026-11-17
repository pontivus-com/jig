import { readFileSync } from "node:fs";
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
    expect(css).not.toContain(".jig-shell");
    expect(css).not.toContain(".jig-sidebar");
    expect(css).not.toContain(".jig-mobile-destination-menu");
    expect(css).not.toContain(".jig-task-menu-panel");
  });

  it("uses Astryx as the application shell and navigation owner", () => {
    const app = source("ui/src/app.tsx");

    expect(app).toContain("<AppShell");
    expect(app).toContain("sideNav={primarySideNav}");
    expect(app).toContain("mobileNav={{");
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

  it("uses public Astryx menu and responsive dialog contracts", () => {
    const taskRow = source("ui/src/task-row.tsx");
    const history = source("ui/src/history.tsx");
    const editor = source("ui/src/task-editor.tsx");

    expect(taskRow).toContain("DropdownMenu");
    expect(taskRow).not.toContain("jig-task-menu-panel");
    expect(history).toContain("DropdownMenu");
    expect(history).not.toContain("jig-task-menu-panel");
    expect(editor).toContain('variant={isNarrow ? "fullscreen" : "standard"}');
    expect(editor).toContain("FieldLabel");
    expect(editor).toContain("isGroupLabel");
  });
});
