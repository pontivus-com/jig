import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tokenDefaults } from "@astryxdesign/core/theme";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

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
  "--jig-state-hover-bg",
  "--jig-state-pressed-bg",
  "--jig-task-surface",
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

    const css = source("ui/src/styles.css");
    expect(css).not.toMatch(/@layer\s+jig\b/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    expect(css).not.toContain(".jig-sidebar");
    expect(css).not.toContain(".jig-week-column-selected");
    expect(css).not.toContain(".jig-week-add-task");
    expect(css).toContain(".jig-task-drag-handle");
    expect(css).toContain(".jig-task-drop-indicator");
    expect(css).not.toContain("dashed var(--jig-state-drag-border)");
    expect(css).not.toContain(".jig-mobile-quick-add");
    expect(css).not.toContain(".jig-planner-selected-date-heading");
    expect(css).not.toContain(".jig-task-inspector");
  });

  it("consumes only Astryx public tokens plus governed Jig product aliases", () => {
    const css = source("ui/src/styles.css");
    const usedTokens = new Set(
      [...css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].flatMap(
        (match) => (match[1] === undefined ? [] : [match[1]]),
      ),
    );
    const unknown = [...usedTokens]
      .filter(
        (name) =>
          !(name in tokenDefaults) &&
          !JIG_PRODUCT_TOKENS.has(name),
      )
      .sort();

    expect(unknown).toEqual([]);

    const common = source("ui/src/themes/product-tokens.ts");
    for (const token of JIG_PRODUCT_TOKENS) {
      expect(common).toContain(`"${token}"`);
    }
    expect(common).not.toContain('"--jig-lane-surface"');
    expect(common).toContain(
      '"--jig-chrome-surface": "var(--color-background-body)"',
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
  });

  it("uses one exhaustive Astryx theme registry and CLI-generated theme set", () => {
    const app = source("ui/src/app.tsx");
    const appearance = source("ui/src/appearance.ts");
    const manifest = source("scripts/build-themes.ts");
    const styles = source("ui/src/styles.css");
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
          ? '@import "./jig.css";'
          : `@import "./themes/${id}.css";`,
      );
    }

    expect(verifyWorkflow).toContain("bun run theme:check");
  });

  it("uses one AppShell and one typed destination definition across layouts", () => {
    const app = source("ui/src/app.tsx");
    const header = source("ui/src/planner-header.tsx");
    const layoutMode = source("ui/src/use-layout-mode.ts");

    expect(app).toContain("<AppShell");
    expect((app.match(/<AppShell\b/g) ?? [])).toHaveLength(1);
    expect(app).toContain("function ApplicationShell");
    expect(app).toContain("<ApplicationShell topNav={<OnboardingHeader />}>");
    expect(app).toContain("mobileNav={false}");
    expect(app).not.toContain("<SideNav");
    expect(app).toContain("initialDestinationNavigation");
    expect(app).toContain("installNativeBackButtonListener");

    expect(header).toContain("const DESTINATIONS = [");
    expect(header).toContain('id: "planner"');
    expect(header).toContain('label: "Planner"');
    expect(header).toContain('id: "history"');
    expect(header).toContain('label: "History"');
    expect(header).toContain('id: "settings"');
    expect(header).toContain('label: "Settings"');
    expect(header).toContain('import type { Destination } from "./navigation"');
    expect(header).not.toContain("export type Destination =");
    expect(header).toContain("IconName");
    expect(header).toContain("NamespacedIconName");
    expect(header).toContain("function NarrowHeader");
    expect(header).toContain("export function CompactApplicationNavigation");
    expect(header).toContain('className="jig-mobile-bottom-navigation"');
    expect(header).toContain('className="jig-mobile-add-fab"');
    expect(header).toContain("DESTINATIONS.map((item)");
    expect(header).toContain('aria-label="Primary"');
    expect(header).not.toContain("function NarrowDestinationMenu");
    expect(header).not.toContain("<Popover");
    expect(header).not.toContain("<SideNav");

    expect(layoutMode).toContain(
      'DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 73rem)"',
    );
  });

  it("uses the canonical wordmark and governed semantic icon system", () => {
    const header = source("ui/src/planner-header.tsx");
    const week = source("ui/src/week.tsx");
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

    expect(header).toContain('icon: "viewColumns"');
    expect(header).toContain('icon: "wrench"');
    expect(header).toContain("JIG_ICON_KEYS.history");
    expect(header).toContain('<JigIcon name="add"');
    expect(week).toContain('<JigIcon name="add"');
    expect(taskRow).toContain('<JigIcon name="edit"');
    expect(taskRow).toContain('<JigIcon name="delete"');
    expect(taskRow).toContain('icon="externalLink"');
    expect(taskRow).toContain('icon="copy"');
    expect(taskRow).toContain('icon="moreHorizontal"');
    expect(taskRow).toContain('icon="clock"');
    expect(taskRow).toContain('<JigIcon name="drag"');

    expect(icons).toContain("satisfies Record<JigIconName, NamespacedIconName>");
    expect(icons).not.toContain("as IconName");

    for (const content of [header, week, taskRow]) {
      expect(content).not.toContain('aria-hidden="true">+</span>');
      expect(content).not.toContain("•••");
      expect(content).not.toContain("≡");
    }
  });

  it("keeps the application frame full-bleed and header geometry governed", () => {
    const css = source("ui/src/styles.css");

    expect(css).toContain(".jig-app-shell {");
    expect(css).toContain("padding: 0;");
    expect(css).toContain("height: 2.75rem;");
    expect(css).toContain(".jig-app-header-narrow {");
    expect(css).toContain("position: sticky;");
    expect(css).toContain("padding: 0;");
    expect(css).toContain(".jig-header-mobile-application-row {");
    expect(css).toContain(".jig-header-mobile-temporal-row {");
    expect(css).toContain("min-height: 56px;");
    expect(css).not.toContain("height: 3.5rem;");
    expect(css).toContain("@media (max-width: 72.999rem)");
    expect(css).not.toContain("@media (max-width: 75.999rem)");
    expect(css).not.toContain(".jig-planner-narrow");
    expect(css).not.toContain("max-width: 1170px");
    expect(css).not.toContain("calc(5rem + env(safe-area-inset-bottom");
  });

  it("keeps secondary desktop screens constrained without constraining Planner", () => {
    const css = source("ui/src/styles.css");

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
    const history = source("ui/src/history.tsx");
    const settings = source("ui/src/settings.tsx");
    const css = source("ui/src/styles.css");

    expect(header).toContain("function DestinationHeading");
    expect(header).toContain("Completed work grouped by actual completion date");
    expect(header).toContain("Repository, synchronization, appearance and diagnostics");
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

  it("keeps onboarding inside Jig and protocol controls out of presentation", () => {
    const app = source("ui/src/app.tsx");
    const setup = source("ui/src/setup.tsx");
    const deviceFlow = source("ui/src/github-device-flow.tsx");

    expect(app).toContain("<OnboardingHeader />");
    expect(app).toContain("<SetupView status={setupStatus} layoutMode={layoutMode} />");
    expect(setup).not.toContain("<main");
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

  it("keeps v1.1 mobile form and onboarding composition on governed public owners", () => {
    const taskEditor = source("ui/src/task-editor.tsx");
    const setup = source("ui/src/setup.tsx");
    const app = source("ui/src/app.tsx");
    const styles = source("ui/src/styles.css");

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
    expect(workspace).toContain("LayoutFooter");
    expect(workspace).toContain('showEditorActions={false}');
    expect(workspace).toContain('form="jig-task-bottom-sheet-form"');
    expect(workspace).toContain(
      'editorFormId="jig-task-bottom-sheet-form"',
    );
    const editorActionsStart = styles.indexOf(".jig-editor-actions {");
    const editorActionsEnd = styles.indexOf("}", editorActionsStart);
    expect(editorActionsStart).toBeGreaterThanOrEqual(0);
    expect(
      styles.slice(editorActionsStart, editorActionsEnd + 1),
    ).not.toContain("position: sticky;");

    expect(setup).toContain('readonly layoutMode: LayoutMode;');
    expect(setup).toContain('layoutMode === "narrow"');
    expect(setup).toContain("function SetupBenefits");
    expect(setup).toContain("Plan your week. Keep the data yours.");
    expect(setup).not.toContain("Same plan. Different devices.");
    expect(setup).not.toContain("Choose one repository.");
    expect(app).toContain(
      "<SetupView status={setupStatus} layoutMode={layoutMode} />",
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
    const planner = source("ui/src/planner.tsx");
    const week = source("ui/src/week.tsx");
    const list = source("ui/src/planner-list.tsx");
    const workspace = source("ui/src/task-workspace.tsx");
    const editor = source("ui/src/task-editor.tsx");
    const taskRow = source("ui/src/task-row.tsx");
    const drag = source("ui/src/drag.tsx");
    const history = source("ui/src/history.tsx");

    expect(app).toContain("interface PlannerState");
    expect(app).toContain("readonly displayedWeekStart: string");
    expect(app).not.toContain("selectedDate");
    expect(app).not.toContain("selectDate");
    expect(app).not.toContain('mode: "view"');
    expect(app).not.toContain('mode: "edit"');

    expect(workspace).toContain("export type TaskWorkspaceState");
    expect(workspace).toContain('readonly mode: "task"');
    expect(workspace).toContain('readonly mode: "create"');
    expect(workspace).not.toContain('readonly mode: "view"');

    expect(planner).toContain("<WeekView");
    expect(planner).not.toContain("layoutMode");
    expect(planner).not.toContain("enableDrag");
    expect(planner).not.toContain("DateStrip");

    expect(week).toContain("<TaskDragProvider");
    expect(week).toContain("<DateDropZone");
    expect(week).toContain('"jig-week-board"');
    expect(week).toContain("<PlannerTaskList");
    expect(week).not.toContain("enableDrag");
    expect(week).not.toContain("jig-planner-narrow");
    expect(week).not.toContain("SortableTaskRow");

    expect(list).toContain("<DraggableTaskRow");
    expect(list).not.toContain("<SortableTaskRow");
    expect(list).not.toContain("isSortable");
    expect(list).toContain("<TaskInsertionSlot");
    expect(list).not.toContain("@dnd-kit/");

    expect(editor).not.toContain("optionalText");
    expect(editor).not.toContain("normalizeOptionalText");

    expect(taskRow).toContain("export function TaskActionMenu");
    expect(taskRow).toContain("taskActionMenuItems");
    expect(history).toContain("<TaskActionMenu");
    expect(taskRow).toContain('icon="moreHorizontal"');
    expect(taskRow).toContain('icon="clock"');
    expect(taskRow).toContain('className="jig-task-drag-handle"');
    expect(taskRow).toContain('<JigIcon name="drag"');
    expect(taskRow).not.toContain("@dnd-kit/");
    expect(taskRow).not.toContain("PointerSensor");

    expect(drag).toContain('from "@dnd-kit/react"');
    expect(drag).toContain('from "@dnd-kit/dom"');
    expect(drag).toContain("useDraggable");
    expect(drag).toContain("draggable.handleRef");
    expect(drag).toContain('type: "jig-insertion-slot"');
    expect(drag).toContain("PointerActivationConstraints.Distance");
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

  it("keeps operational attention in one public-leaf Jig composition", () => {
    const attention = source("ui/src/attention-banner.tsx");
    const app = source("ui/src/app.tsx");
    const settings = source("ui/src/settings.tsx");
    const setup = source("ui/src/setup.tsx");

    expect(attention).toContain('from "@astryxdesign/core"');
    expect(attention).toContain("<Icon");
    expect(attention).not.toContain("<Banner");
    expect(attention).not.toContain("stylex");
    expect(app).toContain("<JigAttentionBanner");
    expect(settings).toContain("<JigAttentionBanner");
    expect(setup).toContain("<JigAttentionBanner");
    expect(app).not.toContain("<Banner");
    expect(settings).not.toContain("<Banner");
    expect(setup).not.toContain("<Banner");
  });
});
