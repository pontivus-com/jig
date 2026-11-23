import { expect, test, type Page, type Request } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

function activeWeek(page: Page) {
  return page.locator(".jig-planner-surface");
}


function applicationScrollOwner(page: Page) {
  return page.locator("#astryx-app-shell-main");
}

function expectNear(actual: number, expected: number, tolerance = 3): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

const THEME_PRESETS = [
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

type ThemePreset = (typeof THEME_PRESETS)[number];
type AppearanceMode = "system" | "light" | "dark";

async function setAppearance(
  page: Page,
  themePreset: ThemePreset,
  appearanceMode: AppearanceMode,
): Promise<void> {
  await page.evaluate(
    ({ preset, mode }) => {
      localStorage.setItem("jig-theme-family", preset);
      localStorage.setItem("jig-appearance-mode", mode);
      localStorage.removeItem("jig-theme");
    },
    { preset: themePreset, mode: appearanceMode },
  );
  await page.reload();
}

function rgbChannels(value: string): readonly [number, number, number] {
  const rgb = value.match(
    /rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/,
  );
  if (rgb?.[1] !== undefined && rgb[2] !== undefined && rgb[3] !== undefined) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  const srgb = value.match(
    /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/,
  );
  if (
    srgb?.[1] !== undefined &&
    srgb[2] !== undefined &&
    srgb[3] !== undefined
  ) {
    return [
      Number(srgb[1]) * 255,
      Number(srgb[2]) * 255,
      Number(srgb[3]) * 255,
    ];
  }

  throw new Error(`Unsupported computed color: ${value}`);
}

function parsedOklab(
  value: string,
): readonly [number, number, number] | null {
  const match = value.match(
    /oklab\(\s*([-+\d.]+%?)\s+([-+\d.]+)\s+([-+\d.]+)/,
  );
  if (
    match?.[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }
  const lightness = match[1].endsWith("%")
    ? Number(match[1].slice(0, -1)) / 100
    : Number(match[1]);
  return [lightness, Number(match[2]), Number(match[3])];
}

function linearSrgbFromOklab(
  value: readonly [number, number, number],
): readonly [number, number, number] {
  const [lightness, a, b] = value;
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function relativeLuminance(value: string): number {
  const directOklab = parsedOklab(value);
  const channels =
    directOklab === null
      ? rgbChannels(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        })
      : linearSrgbFromOklab(directOklab);
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function oklab(value: string): readonly [number, number, number] {
  const direct = parsedOklab(value);
  if (direct !== null) {
    return direct;
  }

  const [red, green, blue] = rgbChannels(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  const l = Math.cbrt(
    0.4122214708 * (red ?? 0) +
      0.5363325363 * (green ?? 0) +
      0.0514459929 * (blue ?? 0),
  );
  const m = Math.cbrt(
    0.2119034982 * (red ?? 0) +
      0.6806995451 * (green ?? 0) +
      0.1073969566 * (blue ?? 0),
  );
  const s = Math.cbrt(
    0.0883024619 * (red ?? 0) +
      0.2817188376 * (green ?? 0) +
      0.6299787005 * (blue ?? 0),
  );

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabDistance(first: string, second: string): number {
  const a = oklab(first);
  const b = oklab(second);
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}

async function themeSnapshot(page: Page): Promise<{
  readonly rootTheme: string | null;
  readonly explicitMode: string | null;
  readonly bodyBackground: string;
  readonly bodyText: string;
  readonly chromeBackground: string;
  readonly contentBackground: string;
  readonly plannerBackground: string;
  readonly laneBackground: string;
  readonly taskBackground: string;
  readonly taskText: string;
  readonly taskMetaText: string;
  readonly taskBorder: string;
  readonly todayBorder: string;
  readonly logoPrimary: string;
  readonly logoAccent: string;
  readonly statusPairs: readonly {
    readonly foreground: string;
    readonly background: string;
  }[];
  readonly motionDurations: readonly string[];
}> {
  const active = activeWeek(page);
  await expect(active.locator(".jig-task-card").first()).toBeVisible();
  await expect(
    active.locator(".jig-week-column-today .jig-week-column-header"),
  ).toBeVisible();
  await expect(page.locator(".jig-logo")).toBeVisible();

  return page.evaluate(() => {
    const active = document.querySelector<HTMLElement>(
      '.jig-planner-surface',
    );
    const header = document.querySelector<HTMLElement>(".jig-app-header");
    const content = document.querySelector<HTMLElement>(".jig-content-configured");
    const lane = active?.querySelector<HTMLElement>(".jig-week-column") ?? null;
    const task = active?.querySelector<HTMLElement>(".jig-task-card") ?? null;
    const today =
      active?.querySelector<HTMLElement>(
        ".jig-week-column-today .jig-week-column-header",
      ) ?? null;
    const logoPrimary = document.querySelector<SVGElement>(".jig-logo path");
    const logoAccent = document.querySelector<SVGElement>(".jig-logo circle");
    if (
      header === null ||
      content === null ||
      lane === null ||
      task === null ||
      today === null ||
      logoPrimary === null ||
      logoAccent === null
    ) {
      throw new Error("Theme acceptance fixture is unavailable");
    }

    const bodyStyle = getComputedStyle(document.body);
    const taskStyle = getComputedStyle(task);
    const taskMeta = task.querySelector<HTMLElement>(".jig-task-meta");
    if (taskMeta === null) {
      throw new Error("Task metadata fixture is unavailable");
    }
    const statusPairs = (["info", "success", "warning", "error"] as const).map(
      (status) => {
        const probe = document.createElement("span");
        probe.style.color = `var(--color-on-${status})`;
        probe.style.backgroundColor = `var(--color-${status})`;
        probe.style.position = "fixed";
        probe.style.inset = "-9999px auto auto -9999px";
        document.body.append(probe);
        const style = getComputedStyle(probe);
        const pair = {
          foreground: style.color,
          background: style.backgroundColor,
        };
        probe.remove();
        return pair;
      },
    );
    return {
      rootTheme: document.documentElement.getAttribute("data-astryx-theme"),
      explicitMode: document.documentElement.getAttribute("data-theme"),
      bodyBackground: bodyStyle.backgroundColor,
      bodyText: bodyStyle.color,
      chromeBackground: getComputedStyle(header).backgroundColor,
      contentBackground: getComputedStyle(content).backgroundColor,
      plannerBackground: getComputedStyle(active ?? document.body).backgroundColor,
      laneBackground: getComputedStyle(lane).backgroundColor,
      taskBackground: taskStyle.backgroundColor,
      taskText: taskStyle.color,
      taskMetaText: getComputedStyle(taskMeta).color,
      taskBorder: taskStyle.borderColor,
      todayBorder: getComputedStyle(today).borderBottomColor,
      logoPrimary: getComputedStyle(logoPrimary).stroke || getComputedStyle(logoPrimary).fill,
      logoAccent: getComputedStyle(logoAccent).fill,
      statusPairs,
      motionDurations: [
        "--duration-fast-min",
        "--duration-fast",
        "--duration-fast-max",
        "--duration-medium-min",
        "--duration-medium",
        "--duration-medium-max",
        "--duration-slow-min",
        "--duration-slow",
        "--duration-slow-max",
      ].map((token) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(token)
          .trim(),
      ),
    };
  });
}

async function createTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW" = "NORMAL",
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
}

async function displayedDateValue(
  page: Page,
  civilDate: string,
): Promise<string> {
  return page.evaluate((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
  }, civilDate);
}

async function waitForResponsiveHeader(
  page: Page,
  width: number,
): Promise<void> {
  await expect(
    page.locator(
      width >= 1168
        ? ".jig-app-header-desktop"
        : ".jig-app-header-narrow",
    ),
  ).toBeVisible();
}

async function headerHeight(page: Page): Promise<number> {
  let height: number | null = null;
  await expect
    .poll(async () => {
      const box = await page.locator(".jig-app-header").boundingBox();
      height = box?.height ?? null;
      return height;
    })
    .not.toBeNull();

  if (height === null) {
    throw new Error("Application header geometry unavailable");
  }
  return height;
}

test("desktop uses explicit Planner navigation with one seven-date open canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator(".jig-primary-nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Planner home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Planner", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task", exact: true }).first()).toBeVisible();
  const active = activeWeek(page);
  await expect(active.locator(".jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-week-column-selected")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(page.locator(".jig-week-add-task")).toHaveCount(0);

  const labels = await active
    .locator(".jig-week-date-signifier > strong")
    .allTextContents();
  expect(labels.map((label) => label.split(" ")[1])).toEqual(
    await Promise.all(
      Array.from({ length: 7 }, async (_, index) =>
        (await browserCivilDate(page, index)).slice(8),
      ),
    ),
  );

  const chrome = await active.locator(".jig-week-column").first().evaluate(
    (element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth,
        shadow: style.boxShadow,
      };
    },
  );
  expect(chrome.background).toBe("rgba(0, 0, 0, 0)");
  expect(chrome.top).toBe("0px");
  expect(chrome.right).toBe("0px");
  expect(chrome.bottom).toBe("0px");
  expect(chrome.left).toBe("0px");
  expect(chrome.shadow).toBe("none");
});

test("retains governed desktop Planner History and Settings evidence", async ({
  page,
}, testInfo) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Desktop planner evidence", today, "HIGH");
  await createTask(page, "Desktop completed evidence", today);
  const completedTask = (await apiState(page)).tasks.find(
    (task) => task.title === "Desktop completed evidence",
  );
  if (completedTask === undefined) {
    throw new Error("Desktop History evidence task unavailable");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: completedTask.id,
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.screenshot({
    path: testInfo.outputPath("v1.1-planner-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByText("Desktop completed evidence", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-history-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-settings-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Show diagnostics", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-settings-diagnostics-desktop.png"),
    fullPage: true,
  });
});

test("retains governed empty Planner and History evidence", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".jig-task-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add your first task", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-planner-empty-desktop.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByText("No completed tasks yet.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-history-empty-desktop.png"),
    fullPage: true,
  });

  for (const width of [320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 844 });
    await waitForResponsiveHeader(page, width);
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-history-empty-mobile-${width}.png`),
      fullPage: true,
    });
    const primaryNavigation = page.getByRole("navigation", {
      name: "Primary",
    });
    await primaryNavigation
      .getByRole("button", { name: "Planner", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add your first task", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add task", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-planner-empty-mobile-${width}.png`),
      fullPage: true,
    });
    await primaryNavigation
      .getByRole("button", { name: "History", exact: true })
      .click();
  }
});

test("retains governed synchronization-attention evidence without exposing technical locators", async ({
  page,
}, testInfo) => {
  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        repository_path: "/tmp/private/jig-repository",
        repository_status: {
          local_git: "pending",
          remote: {
            state: "sync-issue",
            remote_name: "origin",
            remote_location: "https://github.com/example/planning.git",
          },
        },
      }),
    });
  });
  await page.reload();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole("button", { name: "Needs attention", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sync needs attention", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".jig-attention-banner")).toHaveCSS(
    "animation-name",
    "jig-attention-reveal",
  );
  const desktopBannerGeometry = await page
    .locator(".jig-attention-banner")
    .evaluate((element) => {
      const icon = element.querySelector<HTMLElement>(
        ".jig-feedback-icon",
      );
      const message = element.querySelector<HTMLElement>(
        ".jig-feedback-message",
      );
      const action = element.querySelector<HTMLElement>(
        ".jig-feedback-action",
      );
      if (icon === null || message === null || action === null) {
        throw new Error("Attention banner geometry fixture unavailable");
      }
      const rootRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const messageRect = message.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      return {
        iconCenter: iconRect.top + iconRect.height / 2,
        messageCenter: messageRect.top + messageRect.height / 2,
        actionCenter: actionRect.top + actionRect.height / 2,
        overflow: element.scrollWidth - rootRect.width,
      };
    });
  expectNear(
    desktopBannerGeometry.iconCenter,
    desktopBannerGeometry.messageCenter,
    1,
  );
  expectNear(
    desktopBannerGeometry.actionCenter,
    desktopBannerGeometry.messageCenter,
    1,
  );
  expect(desktopBannerGeometry.overflow).toBeLessThanOrEqual(1);
  const headerBox = await page.locator(".jig-app-header").boundingBox();
  const bannerBox = await page.locator(".jig-attention-banner").boundingBox();
  const durableRegionBox = await page
    .locator(".jig-feedback-durable-desktop")
    .boundingBox();
  expect(headerBox).not.toBeNull();
  expect(bannerBox).not.toBeNull();
  expect(durableRegionBox).not.toBeNull();
  if (headerBox !== null && bannerBox !== null && durableRegionBox !== null) {
    expect(bannerBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    expect(durableRegionBox.width).toBeLessThanOrEqual(800 + 1);
    expectNear(
      durableRegionBox.x + durableRegionBox.width / 2,
      1440 / 2,
      1,
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("v1.1-sync-attention-planner-desktop.png"),
    fullPage: true,
  });
  await page.waitForTimeout(10_500);
  await expect(
    page.getByText("Sync needs attention", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Sync needs attention", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open Settings", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("example/planning", { exact: true })).toBeVisible();
  await expect(
    page.getByText("/tmp/private/jig-repository", { exact: true }),
  ).toHaveCount(0);
  const attentionDataSync = page.locator(".jig-settings-section").filter({
    has: page.getByRole("heading", { name: "Data & sync" }),
  });
  await expect(
    attentionDataSync.getByText("Needs attention", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^(Try again|Reconnect GitHub)$/,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-sync-attention-settings-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);
  await page.screenshot({
    path: testInfo.outputPath("v1.1-sync-attention-settings-mobile-390.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Planner", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-sync-attention-planner-mobile-390.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 844 });
  await waitForResponsiveHeader(page, 320);
  const mobileBannerGeometry = await page
    .locator(".jig-attention-banner")
    .evaluate((element) => {
      const icon = element.querySelector<HTMLElement>(
        ".jig-feedback-icon",
      );
      const message = element.querySelector<HTMLElement>(
        ".jig-feedback-message",
      );
      const action = element.querySelector<HTMLElement>(
        ".jig-feedback-action",
      );
      if (icon === null || message === null || action === null) {
        throw new Error("Mobile attention banner geometry fixture unavailable");
      }
      const rootRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const messageRect = message.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();
      return {
        iconCenter: iconRect.top + iconRect.height / 2,
        messageCenter: messageRect.top + messageRect.height / 2,
        actionTop: actionRect.top,
        messageBottom: messageRect.bottom,
        overflow: element.scrollWidth - rootRect.width,
      };
    });
  expectNear(
    mobileBannerGeometry.iconCenter,
    mobileBannerGeometry.messageCenter,
    1,
  );
  expect(mobileBannerGeometry.actionTop).toBeGreaterThanOrEqual(
    mobileBannerGeometry.messageBottom - 1,
  );
  expect(mobileBannerGeometry.overflow).toBeLessThanOrEqual(1);
  const narrowDurableBox = await page
    .locator(".jig-feedback-durable-narrow")
    .boundingBox();
  expect(narrowDurableBox).not.toBeNull();
  if (narrowDurableBox !== null) {
    expect(narrowDurableBox.x).toBeGreaterThan(0);
    expect(narrowDurableBox.x + narrowDurableBox.width).toBeLessThan(320);
  }
  await page
    .getByRole("button", { name: "Dismiss notification", exact: true })
    .click();
  await expect(page.locator(".jig-attention-banner")).toHaveCount(0);
});

test("temporal group stays page-centered in one row and navigation has no selected-day state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const center = page.locator(".jig-header-center");
  const temporal = page.locator(".jig-header-temporal");
  const range = page.locator(".jig-header-week-range");
  const centerBox = await center.boundingBox();
  const temporalBox = await temporal.boundingBox();
  expect(centerBox).not.toBeNull();
  expect(temporalBox).not.toBeNull();
  if (centerBox !== null && temporalBox !== null) {
    expectNear(centerBox.x + centerBox.width / 2, 720, 4);
    expectNear(
      temporalBox.x + temporalBox.width / 2,
      centerBox.x + centerBox.width / 2,
      1,
    );
    expect(temporalBox.height).toBeLessThanOrEqual(44);
  }

  const temporalControls = temporal.locator(".jig-temporal-control");
  await expect(temporalControls).toHaveCount(3);
  const temporalControlStyles = await temporalControls.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderWidth,
        borderColor: style.borderColor,
        background: style.backgroundColor,
      };
    }),
  );
  for (const style of temporalControlStyles) {
    expect(style.borderWidth).not.toBe("0px");
    expect(style.borderColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.background).toBe("rgba(0, 0, 0, 0)");
  }

  const rangeBefore = await range.textContent();
  const activeWeek = page.locator(
    '.jig-planner-surface',
  );
  await expect(activeWeek.locator(".jig-week-column-today")).toHaveCount(1);

  await page.getByRole("button", { name: "Next horizon" }).click();
  await expect(range).not.toHaveText(rangeBefore ?? "");
  await expect(activeWeek.locator(".jig-week-column-today")).toHaveCount(0);
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(range).toHaveText(rangeBefore ?? "");
  await expect(activeWeek.locator(".jig-week-board")).toHaveClass(
    /jig-week-board-today/,
  );
  await expect(activeWeek.locator(".jig-week-column-today")).toHaveCount(1);

  await expect(
    page.getByRole("button", { name: "Previous horizon" }),
  ).toBeDisabled();
  await expect(range).toHaveText(rangeBefore ?? "");
  await expect(activeWeek.locator(".jig-week-board")).not.toHaveClass(
    /jig-week-board-(previous|next)/,
  );
});

test("narrow Today consumes one governed scroll request and does not replay on reflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const calls: string[] = [];
    Reflect.set(window, "__jigScrollBehaviors", calls);
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(
      options?: boolean | ScrollIntoViewOptions,
    ): void {
      if (typeof options === "object" && options !== null) {
        calls.push(options.behavior ?? "auto");
      }
      original.call(this, options);
    };
  });
  await page.reload();
  await waitForResponsiveHeader(page, 390);

  const scrollBehaviors = async (): Promise<readonly string[]> =>
    page.evaluate(() => {
      const value = Reflect.get(window, "__jigScrollBehaviors");
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    });
  const clearScrollBehaviors = async (): Promise<void> => {
    await page.evaluate(() => {
      const value = Reflect.get(window, "__jigScrollBehaviors");
      if (Array.isArray(value)) {
        value.splice(0, value.length);
      }
    });
  };

  await expect.poll(scrollBehaviors).toContain("auto");
  await clearScrollBehaviors();

  await page.getByRole("button", { name: "Next horizon" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect.poll(scrollBehaviors).toEqual(["smooth"]);

  await clearScrollBehaviors();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect.poll(scrollBehaviors).toEqual(["smooth"]);

  await clearScrollBehaviors();
  await page.setViewportSize({ width: 1168, height: 844 });
  await waitForResponsiveHeader(page, 1168);
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);
  await page.waitForTimeout(100);
  expect(await scrollBehaviors()).toEqual([]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Next horizon" }).click();
  await clearScrollBehaviors();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect.poll(scrollBehaviors).toEqual(["auto"]);
});

test("desktop lanes keep equal widths but content-driven independent heights", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  for (let index = 0; index < 8; index += 1) {
    await createTask(page, `Tall lane task ${index + 1}`, today);
  }
  await createTask(page, "Short lane task", tomorrow);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  const board = activeWeek(page).locator(".jig-week-board");
  const columns = board.locator(".jig-week-column");
  const geometry = await columns.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );

  expect(geometry).toHaveLength(7);
  for (const column of geometry) {
    expectNear(column.width, geometry[0]?.width ?? column.width, 1);
    expect(column.width).toBeGreaterThanOrEqual(160);
  }
  expect(Math.max(...geometry.map((column) => column.height)))
    .toBeGreaterThan(Math.min(...geometry.map((column) => column.height)));

  const futureColumn = activeWeek(page).locator(`[data-date="${tomorrow}"]`);
  await expect(futureColumn.getByRole("button", { name: /^Add task to / })).toBeVisible();
});

test("narrow Planner opens with the current day at the top", async ({
  page,
}) => {
  const todayDate = await browserCivilDate(page);
  for (let index = 0; index < 8; index += 1) {
    await createTask(page, `Current-day scroll task ${index + 1}`, todayDate);
  }
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);

  const scrollOwner = applicationScrollOwner(page);
  const today = activeWeek(page).locator(".jig-week-column-today");
  await expect(today).toBeVisible();
  await expect(scrollOwner).toHaveCount(1);

  const initialGeometry = await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>("#astryx-app-shell-main");
    const active = document.querySelector<HTMLElement>(
      ".jig-planner-surface",
    );
    const today =
      active?.querySelector<HTMLElement>(".jig-week-column-today") ?? null;
    if (owner === null || today === null) {
      throw new Error("Narrow Planner scroll geometry unavailable");
    }
    return {
      ownerTop: owner.getBoundingClientRect().top,
      todayTop: today.getBoundingClientRect().top,
      scrollTop: owner.scrollTop,
    };
  });

  expectNear(initialGeometry.todayTop, initialGeometry.ownerTop, 1);
  expect(initialGeometry.scrollTop).toBeGreaterThanOrEqual(0);

  await scrollOwner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect.poll(() => today.boundingBox()).not.toBeNull();
  const scrolledUpGeometry = await page.evaluate(() => {
    const owner = document.querySelector<HTMLElement>("#astryx-app-shell-main");
    const active = document.querySelector<HTMLElement>(
      ".jig-planner-surface",
    );
    const today =
      active?.querySelector<HTMLElement>(".jig-week-column-today") ?? null;
    if (owner === null || today === null) {
      throw new Error("Narrow Planner scroll geometry unavailable");
    }
    return {
      ownerTop: owner.getBoundingClientRect().top,
      todayTop: today.getBoundingClientRect().top,
    };
  });
  expectNear(scrolledUpGeometry.todayTop, scrolledUpGeometry.ownerTop, 1);
});

test("global Add exposes the full form and defaults to today", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  let workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Title")).toBeVisible();
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, today),
  );
  await expect(workspace.getByLabel("Context")).toBeVisible();
  await expect(workspace.getByText("Priority", { exact: true }).first()).toBeVisible();
  await expect(workspace.getByLabel("Reminder")).toBeVisible();
  await expect(workspace.getByLabel("Reference")).toBeVisible();
  await expect(workspace.getByLabel("Notes")).toBeVisible();
  await workspace.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(workspace).toBeHidden();

  const range = page.locator(".jig-header-week-range");
  const rangeBefore = await range.textContent();
  await page.getByRole("button", { name: "Next horizon" }).click();
  await expect(range).not.toHaveText(rangeBefore ?? "");
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, today),
  );
});

test("per-date add controls are limited to future dates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  const active = activeWeek(page);

  for (const column of await active.locator(".jig-week-column").all()) {
    const date = await column.getAttribute("data-date");
    if (date === null) {
      throw new Error("Planner date is unavailable");
    }
    const add = column.getByRole("button", { name: /^Add task to / });
    await expect(add).toHaveCount(date > today ? 1 : 0);
  }

  await page.getByRole("button", { name: "Next horizon", exact: true }).click();
  await expect(
    active.locator(".jig-week-column").first().getByRole("button", {
      name: /^Add task to /,
    }),
  ).toHaveCount(1);
});

test("per-date plus opens the same full form for its explicit date", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Next horizon", exact: true }).click();
  const active = activeWeek(page);
  const futureColumn = active.locator(".jig-week-column").first();
  const futureDate = await futureColumn.getAttribute("data-date");
  if (futureDate === null) {
    throw new Error("Future Planner date is unavailable");
  }

  await futureColumn.getByRole("button", { name: /^Add task to / }).click();

  const workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, futureDate),
  );
  await expect(workspace.getByLabel("Context")).toBeVisible();
  await expect(workspace.getByLabel("Notes")).toBeVisible();
});

test("Task click opens the editable Drawer directly and blank content dismisses without saving", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Editable directly", today);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  const active = activeWeek(page);
  const board = active.locator(".jig-week-board");
  const before = await board.boundingBox();
  await active.getByText("Editable directly", { exact: true }).click();

  const workspace = page.getByRole("dialog", { name: "Editable directly" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByLabel("Title")).toHaveValue("Editable directly");
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, today),
  );
  await workspace.getByLabel("Title").fill("Unsaved replacement");

  const after = await board.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  if (before !== null && after !== null) {
    expectNear(after.width, before.width, 1);
  }

  await page.locator(".jig-content").click({ position: { x: 2, y: 2 } });
  await expect(workspace).toBeHidden();
  expect((await apiState(page)).tasks.some((task) => task.title === "Unsaved replacement"))
    .toBe(false);
});

test("adding and editing a Task confirm success and close the workspace", async ({
  page,
}) => {
  const today = await browserCivilDate(page);

  for (const width of [1440, 390]) {
    await resetCanonicalTasks(page);
    await page.reload();
    await page.setViewportSize({ width, height: 900 });

    const addControl =
      width < 600
        ? page.locator(".jig-mobile-add-fab")
        : page.locator(".jig-header-right").getByRole("button", {
            name: "Add task",
            exact: true,
          });
    await addControl.click();

    const addWorkspace = page.getByRole("dialog", { name: "Add task" });
    await expect(addWorkspace).toBeVisible();
    if (width < 600) {
      await expect(addWorkspace.getByLabel("Title")).toBeFocused();
    }
    await addWorkspace.getByLabel("Title").fill(`Feedback ${width}`);
    await addWorkspace.getByRole("button", {
      name: "Add task",
      exact: true,
    }).click();
    await expect(addWorkspace).toBeHidden();
    const addedConfirmation = page
      .getByRole("status")
      .filter({ hasText: "Task added" });
    await expect(addedConfirmation).toBeVisible();

    if (width >= 1168) {
      const placement = page.locator(".jig-feedback-transient-desktop");
      await expect(placement).toHaveCSS("position", "absolute");
      const stackBox = await placement
        .locator(".jig-feedback-transient-stack")
        .boundingBox();
      expect(stackBox).not.toBeNull();
      if (stackBox !== null) {
        expect(stackBox.width).toBeLessThanOrEqual(384 + 1);
      }
      const beforeScroll = await addedConfirmation.boundingBox();
      await applicationScrollOwner(page).evaluate((element) => {
        element.scrollTop = Math.min(120, element.scrollHeight - element.clientHeight);
      });
      const afterScroll = await addedConfirmation.boundingBox();
      expect(beforeScroll).not.toBeNull();
      expect(afterScroll).not.toBeNull();
      if (beforeScroll !== null && afterScroll !== null) {
        expectNear(afterScroll.y, beforeScroll.y, 1);
      }
    } else {
      const placement = page.locator(".jig-feedback-transient-narrow");
      await expect(placement).toHaveCSS("position", "fixed");
      const confirmationBox = await addedConfirmation.boundingBox();
      const navigationBox = await page
        .getByRole("navigation", { name: "Primary" })
        .boundingBox();
      expect(confirmationBox).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      if (confirmationBox !== null && navigationBox !== null) {
        expect(confirmationBox.y + confirmationBox.height).toBeLessThan(
          navigationBox.y,
        );
      }
    }

    await addedConfirmation
      .getByRole("button", { name: "Dismiss confirmation" })
      .click();
    await expect(addedConfirmation).toHaveClass(
      /jig-success-confirmation-exiting/,
    );
    await expect(addedConfirmation).toBeHidden();

    const task = page.getByText(`Feedback ${width}`, { exact: true });
    await expect(task).toBeVisible();
    await task.click();
    const editWorkspace = page.getByRole("dialog", {
      name: `Feedback ${width}`,
    });
    await expect(editWorkspace).toBeVisible();
    if (width < 600) {
      await expect(editWorkspace.getByLabel("Title")).not.toBeFocused();
    }
    await editWorkspace.evaluate((dialog) => {
      const scrollRegion = Array.from(
        dialog.querySelectorAll<HTMLElement>("*"),
      ).find((element) => element.scrollHeight > element.clientHeight);
      if (scrollRegion === undefined) {
        throw new Error("Task workspace has no scroll region");
      }
      scrollRegion.scrollTop = scrollRegion.scrollHeight;
    });
    await editWorkspace.getByLabel("Title").fill(`Edited ${width}`);
    let saveCommandCount = 0;
    const observeSaveCommand = (request: Request): void => {
      const url = new URL(request.url());
      if (url.pathname === "/api/v1/commands" && request.method() === "POST") {
        saveCommandCount += 1;
      }
    };
    page.on("request", observeSaveCommand);
    await editWorkspace.getByRole("button", {
      name: "Save",
      exact: true,
    }).click();
    await expect(editWorkspace).toBeHidden();
    await expect.poll(() => saveCommandCount).toBe(1);
    page.off("request", observeSaveCommand);
    await expect(
      page.getByRole("status").filter({ hasText: "Task saved" }),
    ).toBeVisible();
    await expect(page.getByText(`Edited ${width}`, { exact: true })).toBeVisible();

    await addControl.click();
    const reopenedAddWorkspace = page.getByRole("dialog", {
      name: "Add task",
    });
    const reopenedTitle = reopenedAddWorkspace.getByLabel("Title");
    await expect(reopenedTitle).toBeVisible();
    if (width < 600) {
      await expect(reopenedTitle).toBeFocused();
    }
    await expect
      .poll(() =>
        reopenedAddWorkspace.evaluate(
          (dialog) =>
            dialog
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
    const titleBox = await reopenedTitle.boundingBox();
    const workspaceBox = await reopenedAddWorkspace.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    if (titleBox !== null && workspaceBox !== null) {
      expect(titleBox.y).toBeGreaterThanOrEqual(workspaceBox.y);
      expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(
        workspaceBox.y + workspaceBox.height,
      );
    }
    await expect
      .poll(() =>
        reopenedAddWorkspace.evaluate((dialog) => {
          const scrollRegion = Array.from(
            dialog.querySelectorAll<HTMLElement>("*"),
          ).find((element) => element.scrollHeight > element.clientHeight);
          return scrollRegion?.scrollTop ?? null;
        }),
      )
      .toBe(0);
    await reopenedAddWorkspace.getByRole("button", {
      name: "Cancel",
      exact: true,
    }).click();
    await expect(reopenedAddWorkspace).toBeHidden();

    await page.getByLabel(`Complete Edited ${width}`, { exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Task completed" }),
    ).toBeVisible();
  }
});

test("reduced motion dismisses transient feedback without an exit-animation wait", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await resetCanonicalTasks(page);
  await page.reload();

  await page.locator(".jig-mobile-add-fab").click();
  const workspace = page.getByRole("dialog", { name: "Add task" });
  await workspace.getByLabel("Title").fill("Reduced feedback");
  await workspace.getByRole("button", {
    name: "Add task",
    exact: true,
  }).click();

  const confirmation = page
    .getByRole("status")
    .filter({ hasText: "Task added" });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Dismiss confirmation" })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.locator(".jig-success-confirmation-exiting")).toHaveCount(0);
});

test("selecting another Task retargets the open editable workspace", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Retarget first", today);
  await createTask(page, "Retarget second", today);
  await page.reload();

  await page.getByText("Retarget first", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Retarget first" })).toBeVisible();

  await page.getByText("Retarget second", { exact: true }).click();
  const second = page.getByRole("dialog", { name: "Retarget second" });
  await expect(second).toBeVisible();
  await expect(second.getByLabel("Title")).toHaveValue("Retarget second");
});

test("desktop header stays compact while narrow header uses sticky destination-specific rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForResponsiveHeader(page, 1440);
  const plannerHeight = await headerHeight(page);
  expect(plannerHeight).toBeLessThanOrEqual(44);

  const headerChrome = await page.locator(".jig-app-header").evaluate((element) => {
    const style = getComputedStyle(element);
    const body = getComputedStyle(document.body);
    return {
      background: style.backgroundColor,
      bodyBackground: body.backgroundColor,
      borderBottom: style.borderBottomWidth,
      radius: style.borderRadius,
      shadow: style.boxShadow,
    };
  });
  expect(headerChrome.background).toBe(headerChrome.bodyBackground);
  expect(headerChrome.borderBottom).not.toBe("0px");
  expect(headerChrome.radius).toBe("0px");
  expect(headerChrome.shadow).toBe("none");

  await page.getByRole("button", { name: "History", exact: true }).click();
  const historyHeight = await headerHeight(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsHeight = await headerHeight(page);

  expectNear(historyHeight, plannerHeight, 1);
  expectNear(settingsHeight, plannerHeight, 1);

  for (const width of [320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 844 });
    await waitForResponsiveHeader(page, width);

    const primaryNavigation = page.getByRole("navigation", {
      name: "Primary",
    });
    await expect(primaryNavigation).toBeVisible();
    await primaryNavigation
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    const narrowSettingsHeight = await headerHeight(page);
    expect(narrowSettingsHeight).toBeGreaterThanOrEqual(52);
    expect(narrowSettingsHeight).toBeLessThanOrEqual(57);
    await expect(page.locator(".jig-header-mobile-application-row")).toHaveCount(1);
    await expect(page.locator(".jig-header-mobile-temporal-row")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(0);

    const topBefore = await page.locator(".jig-app-header-narrow").evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    await applicationScrollOwner(page).evaluate((element) => {
      element.scrollTop = 500;
    });
    const topAfter = await page.locator(".jig-app-header-narrow").evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expectNear(topAfter, topBefore, 1);

    const frameWidth = await page.locator(".jig-content-frame").evaluate(
      (element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }),
    );
    expect(frameWidth.scroll).toBeLessThanOrEqual(frameWidth.client + 1);

    await primaryNavigation
      .getByRole("button", { name: "Planner", exact: true })
      .click();

    await expect(page.locator(".jig-header-mobile-application-row")).toHaveCount(1);
    await expect(page.locator(".jig-header-mobile-temporal-row")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeVisible();
    const narrowPlannerHeight = await headerHeight(page);
    expect(narrowPlannerHeight).toBeGreaterThan(narrowSettingsHeight);
  }
});

test("narrow Task workspace keeps the Close action readable under a long valid title", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const title =
    "High priority quarterly planning review with deliberately long but valid title";
  await createTask(page, title, today, "HIGH");
  await page.reload();
  await page.setViewportSize({ width: 320, height: 844 });

  await page.getByText(title, { exact: true }).click();
  const workspace = page.getByRole("dialog", { name: title });
  const close = workspace.getByRole("button", {
    name: "Close",
    exact: true,
  });
  await expect(close).toBeVisible();

  const geometry = await close.evaluate((button) => {
    const walker = document.createTreeWalker(
      button,
      NodeFilter.SHOW_TEXT,
    );
    let textNode: Node | null = walker.nextNode();
    while (
      textNode !== null &&
      textNode.textContent?.trim() !== "Close"
    ) {
      textNode = walker.nextNode();
    }
    if (textNode === null) {
      throw new Error("Close label text node unavailable");
    }
    const range = document.createRange();
    range.selectNode(textNode);
    const text = range.getBoundingClientRect();
    const control = button.getBoundingClientRect();
    return {
      controlLeft: control.left,
      controlRight: control.right,
      textLeft: text.left,
      textRight: text.right,
    };
  });

  expect(geometry.textLeft).toBeGreaterThanOrEqual(
    geometry.controlLeft - 1,
  );
  expect(geometry.textRight).toBeLessThanOrEqual(
    geometry.controlRight + 1,
  );
});

test("mobile interaction inventory meets the governed geometry and expanded-form contract", async ({
  page,
}, testInfo) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Mobile geometry inventory",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: "https://example.com/mobile-geometry",
    note: null,
    reminder_time: null,
  });
  await createTask(page, "Mobile completed evidence", today);
  const mobileCompleted = (await apiState(page)).tasks.find(
    (task) => task.title === "Mobile completed evidence",
  );
  if (mobileCompleted === undefined) {
    throw new Error("Mobile History evidence task unavailable");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: mobileCompleted.id,
  });
  await page.reload();

  const expectTarget = async (
    locator: ReturnType<Page["locator"]>,
    label: string,
  ): Promise<void> => {
    const box = await locator.boundingBox();
    if (box === null) {
      throw new Error(`Missing geometry for ${label}`);
    }
    // Layout engines can report a 48px CSS box a few ten-thousandths
    // below 48 after device-pixel/subpixel conversion. Keep the product
    // contract at 48 CSS px while tolerating only that floating-point noise.
    expect(box.width, `${label} width`).toBeGreaterThanOrEqual(47.99);
    expect(box.height, `${label} height`).toBeGreaterThanOrEqual(47.99);
  };

  for (const width of [320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 844 });
    await waitForResponsiveHeader(page, width);

    const applicationRow = await page
      .locator(".jig-header-mobile-application-row")
      .boundingBox();
    const temporalRow = await page
      .locator(".jig-header-mobile-temporal-row")
      .boundingBox();
    if (applicationRow === null || temporalRow === null) {
      throw new Error("Mobile Planner header geometry unavailable");
    }
    expect(applicationRow.height).toBeGreaterThanOrEqual(52);
    expect(applicationRow.height).toBeLessThanOrEqual(56);
    expect(temporalRow.height).toBeGreaterThanOrEqual(52);
    expect(temporalRow.height).toBeLessThanOrEqual(56);

    await expectTarget(
      page.getByRole("button", { name: "Planner home", exact: true }),
      "Planner home",
    );
    await expectTarget(
      page.getByRole("button", { name: "Add task", exact: true }),
      "Global Add task",
    );
    await expectTarget(
      page.getByRole("button", { name: "Previous horizon", exact: true }),
      "Previous horizon",
    );
    await expectTarget(
      page.getByRole("button", { name: "Next horizon", exact: true }),
      "Next horizon",
    );
    await expectTarget(
      page.getByRole("button", { name: "Today", exact: true }),
      "Today",
    );
    await expectTarget(
      page.locator(".jig-status-indicator"),
      "Synchronization status",
    );
    const primaryNavigation = page.getByRole("navigation", {
      name: "Primary",
    });
    for (const destination of ["Planner", "History", "Settings"] as const) {
      await expectTarget(
        primaryNavigation.getByRole("button", {
          name: destination,
          exact: true,
        }),
        `${destination} bottom navigation`,
      );
    }

    const navTypography = await page
      .locator(".jig-mobile-nav-label")
      .first()
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
    expect(navTypography).toBeGreaterThanOrEqual(14);
    await expectTarget(
      page.locator(".jig-date-add").first(),
      "Date Add",
    );
    await expectTarget(
      page.getByRole("button", { name: "Move Mobile geometry inventory" }),
      "Task drag grip",
    );
    await expectTarget(
      page.locator(".jig-task-menu-trigger").first(),
      "Task action menu",
    );
    await expectTarget(
      page.locator(".jig-task-completion-target").first(),
      "Task completion",
    );

    const taskControlAlignment = await page
      .locator(".jig-task-card")
      .filter({ hasText: "Mobile geometry inventory" })
      .first()
      .evaluate((card) => {
        const leading = card.querySelector<HTMLElement>(
          ".jig-task-card-leading",
        );
        if (leading === null) {
          throw new Error("Task leading controls unavailable");
        }
        const cardBox = card.getBoundingClientRect();
        const leadingBox = leading.getBoundingClientRect();
        return {
          cardCenter: cardBox.top + cardBox.height / 2,
          leadingCenter: leadingBox.top + leadingBox.height / 2,
        };
      });
    expect(
      Math.abs(
        taskControlAlignment.cardCenter -
          taskControlAlignment.leadingCenter,
      ),
    ).toBeLessThanOrEqual(1);
    await expectTarget(
      page.getByRole("link", { name: "Open reference" }).first(),
      "Task reference",
    );

    const fab = page.getByRole("button", { name: "Add task", exact: true });
    const fabBox = await fab.boundingBox();
    const bottomNavBox = await primaryNavigation.boundingBox();
    if (fabBox === null || bottomNavBox === null) {
      throw new Error("Compact navigation/FAB geometry unavailable");
    }
    expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(
      bottomNavBox.y + 1,
    );

    await expect(
      page.getByRole("button", { name: "Open navigation menu" }),
    ).toHaveCount(0);

    const widthGeometry = await page.locator(".jig-content-frame").evaluate(
      (element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }),
    );
    expect(widthGeometry.scrollWidth).toBeLessThanOrEqual(
      widthGeometry.clientWidth + 1,
    );

    const emptyDateHeights = await activeWeek(page)
      .locator(".jig-week-column")
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.querySelector(".jig-task-card") === null)
          .map((element) => element.getBoundingClientRect().height),
      );
    expect(emptyDateHeights.length).toBeGreaterThan(0);
    for (const height of emptyDateHeights) {
      expect(height, "empty mobile date section height").toBeLessThanOrEqual(84);
    }

    const leadingControls = await page
      .locator(".jig-task-card-leading")
      .first()
      .boundingBox();
    if (leadingControls === null) {
      throw new Error("Task leading-control geometry unavailable");
    }
    expect(leadingControls.height).toBeLessThanOrEqual(48.5);
    expect(leadingControls.width).toBeGreaterThanOrEqual(95);

    await page.screenshot({
      path: testInfo.outputPath(`v1.1-planner-mobile-${width}.png`),
      fullPage: true,
    });

    await page
      .locator(".jig-task-card")
      .filter({ hasText: "Mobile geometry inventory" })
      .first()
      .locator(".jig-task-title")
      .click();
    const workspace = page.getByRole("dialog", {
      name: "Mobile geometry inventory",
    });
    await expect(workspace).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toHaveCount(0);
    await expect(
      workspace.getByRole("heading", { level: 3 }),
    ).toHaveText(["Task", "Schedule", "Details", "Notes"]);

    await expectTarget(
      workspace.getByRole("button", { name: "Close", exact: true }),
      "BottomSheet close",
    );
    await expectTarget(
      workspace.getByRole("button", { name: "Cancel", exact: true }),
      "Task form Cancel",
    );
    await expectTarget(
      workspace.getByRole("button", { name: "Save", exact: true }),
      "Task form Save",
    );

    const baseControls = workspace.locator(".jig-mobile-touch-control");
    await expect(baseControls).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await expectTarget(baseControls.nth(index), `Task form control ${index + 1}`);
    }
    const priorityControls = workspace.getByRole("radio");
    await expect(priorityControls).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expectTarget(
        priorityControls.nth(index),
        `Priority segment ${index + 1}`,
      );
    }

    await page.screenshot({
      path: testInfo.outputPath(`v1.1-task-form-off-mobile-${width}.png`),
      fullPage: true,
    });

    const repeat = workspace.getByRole("combobox", { name: "Repeat" });
    await repeat.click();
    const repeatOptions = page.getByRole("option");
    await expect(repeatOptions).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expectTarget(repeatOptions.nth(index), `Repeat option ${index + 1}`);
    }
    await page.getByRole("option", { name: "Weekly", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-task-form-weekly-mobile-${width}.png`),
      fullPage: true,
    });

    const weeklyControls = workspace.locator(".jig-mobile-touch-control");
    await expect(weeklyControls).toHaveCount(9);
    for (let index = 0; index < 9; index += 1) {
      await expectTarget(
        weeklyControls.nth(index),
        `Expanded weekly control ${index + 1}`,
      );
    }

    const weekdays = workspace.locator(".jig-repeat-weekday");
    await expect(weekdays).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await expectTarget(weekdays.nth(index), `Repeat weekday ${index + 1}`);
    }

    await repeat.click();
    await page.getByRole("option", { name: "Monthly", exact: true }).click();
    await expect(workspace.getByLabel("Day of month")).toBeVisible();
    await expect(workspace.getByLabel("Ends on")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-task-form-monthly-mobile-${width}.png`),
      fullPage: true,
    });
    await repeat.click();
    await page.getByRole("option", { name: "Weekly", exact: true }).click();

    const actionRegion = workspace.locator(
      ".jig-task-workspace-actions-narrow",
    );
    const actionBefore = await actionRegion.boundingBox();
    if (actionBefore === null) {
      throw new Error("Task action region geometry unavailable");
    }

    const notes = workspace.getByLabel("Notes");
    await notes.scrollIntoViewIfNeeded();
    await expect(notes).toBeVisible();
    await notes.focus();
    await expect(notes).toBeFocused();
    await expect(
      workspace.getByRole("button", { name: "Save", exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ width, height: 560 });
    await expect(notes).toBeFocused();
    await notes.scrollIntoViewIfNeeded();
    await expect(notes).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: "Save", exact: true }),
    ).toBeVisible();
    await expectTarget(
      workspace.getByRole("button", { name: "Mark complete", exact: true }),
      "Task lifecycle action under IME",
    );
    await expectTarget(
      workspace.getByRole("button", { name: "Delete…", exact: true }),
      "Task delete action under IME",
    );
    await page.setViewportSize({ width, height: 844 });

    const actionAfter = await actionRegion.boundingBox();
    if (actionAfter === null) {
      throw new Error("Sticky Task action region geometry unavailable");
    }
    expectNear(actionAfter.y, actionBefore.y, 2);
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-task-form-weekly-lower-mobile-${width}.png`),
      fullPage: true,
    });

    await workspace
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(primaryNavigation).toBeVisible();

    await primaryNavigation
      .getByRole("button", { name: "Settings", exact: true })
      .click();

    const settingsControls = page
      .locator(".jig-settings-view .jig-mobile-touch-control");
    await expect(settingsControls).toHaveCount(1);
    await expectTarget(settingsControls.first(), "Theme selector");

    const appearanceControls = page
      .locator(".jig-settings-view")
      .getByRole("radio");
    await expect(appearanceControls).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expectTarget(
        appearanceControls.nth(index),
        `Appearance segment ${index + 1}`,
      );
    }
    await expectTarget(
      page.getByRole("button", { name: "Show diagnostics", exact: true }),
      "Diagnostics disclosure",
    );

    const themeSelector = page.getByRole("combobox", { name: "Theme" });
    await themeSelector.click();
    const themeOptions = page.getByRole("option");
    await expect(themeOptions).toHaveCount(13);
    for (let index = 0; index < 13; index += 1) {
      await expectTarget(
        themeOptions.nth(index),
        `Theme option ${index + 1}`,
      );
    }
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-settings-mobile-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Show diagnostics", exact: true })
      .click();
    await page.screenshot({
      path: testInfo.outputPath(
        `v1.1-settings-diagnostics-mobile-${width}.png`,
      ),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Hide diagnostics", exact: true })
      .click();

    await primaryNavigation
      .getByRole("button", { name: "History", exact: true })
      .click();
    await expect(
      page.getByText("Mobile completed evidence", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-history-mobile-${width}.png`),
      fullPage: true,
    });

    await primaryNavigation
      .getByRole("button", { name: "Planner", exact: true })
      .click();
  }
});

test("configured destination headings keep Jig identity and one title owner", async ({
  page,
}) => {
  const cases = [
    {
      destination: "History",
      subtitle: "Completed work grouped by actual completion date",
      body: ".jig-history-view",
    },
    {
      destination: "Settings",
      subtitle: "Repository, synchronization, appearance and diagnostics",
      body: ".jig-settings-view",
    },
  ] as const;

  for (const width of [1440, 320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 900 });
    await waitForResponsiveHeader(page, width);

    if (width < 1168) {
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("button", { name: "Planner", exact: true })
        .click();
      const header = page.locator(".jig-app-header");
      await expect(
        header.getByRole("button", {
          name: "Planner home",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        header.getByRole("heading", {
          level: 1,
          name: "Planner",
          exact: true,
        }),
      ).toHaveCount(1);
    }

    for (const item of cases) {
      if (width >= 1168) {
        await page
          .getByRole("button", { name: item.destination, exact: true })
          .click();
      } else {
        await page
          .getByRole("navigation", { name: "Primary" })
          .getByRole("button", {
            name: item.destination,
            exact: true,
          })
          .click();
      }

      const header = page.locator(".jig-app-header");
      if (width < 1168) {
        await expect(
          header.getByRole("button", {
            name: "Planner home",
            exact: true,
          }),
        ).toBeVisible();
      }
      await expect(
        header.getByRole("heading", {
          level: 1,
          name: item.destination,
          exact: true,
        }),
      ).toHaveCount(1);
      if (width >= 1168) {
        await expect(
          header.getByText(item.subtitle, { exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          header.getByText(item.subtitle, { exact: true }),
        ).toHaveCount(0);
      }
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: item.destination,
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(page.locator(item.body).getByRole("heading", { level: 1 }))
        .toHaveCount(0);
      await expect(page.locator(item.body).getByText(item.subtitle, { exact: true }))
        .toHaveCount(0);
    }
  }
});

test("selected Task today priority and status use distinct governed semantics", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Selected semantic task", today, "NORMAL");
  await page.reload();

  const active = activeWeek(page);
  const todayHeader = active
    .locator(`[data-date="${today}"] .jig-week-column-header`);
  const task = active
    .getByText("Selected semantic task", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await task.click();

  const semantics = await page.evaluate(() => {
    const active = document.querySelector<HTMLElement>(
      '.jig-planner-surface',
    );
    const todayElement =
      active?.querySelector<HTMLElement>(
        ".jig-week-column-today .jig-week-column-header",
      ) ?? null;
    const selected =
      active?.querySelector<HTMLElement>(".jig-task-card-selected") ?? null;
    const status = document.querySelector<HTMLElement>(
      ".jig-status-control",
    );
    if (todayElement === null || selected === null || status === null) {
      throw new Error("Semantic state fixture unavailable");
    }
    return {
      todayBorder: getComputedStyle(todayElement).borderBottomColor,
      selectedBackground: getComputedStyle(selected).backgroundColor,
      selectedBorder: getComputedStyle(selected).borderColor,
      statusColor: getComputedStyle(status).color,
    };
  });

  await expect(todayHeader).toBeVisible();
  expect(semantics.todayBorder).not.toBe(semantics.selectedBorder);
  expect(semantics.todayBorder).not.toBe(semantics.statusColor);
  expect(semantics.selectedBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("narrow Planner shows all seven dated sections and preserves the same workspace draft", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Mobile workspace task", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  const active = activeWeek(page);
  await expect(active.locator(".jig-week-board")).toHaveCount(1);
  await expect(active.locator(".jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-planner-narrow")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary" }),
  ).toBeVisible();

  const dates = await active
    .locator(".jig-week-column")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-date")),
    );
  expect(dates).toEqual(
    await Promise.all(
      Array.from({ length: 7 }, async (_, index) =>
        browserCivilDate(page, index),
      ),
    ),
  );

  await page.getByText("Mobile workspace task", { exact: true }).click();
  let workspace = page.getByRole("dialog", { name: "Mobile workspace task" });
  await workspace.getByLabel("Title").fill("Draft survives reflow");

  await page.setViewportSize({ width: 1440, height: 900 });
  workspace = page.getByRole("dialog", { name: "Mobile workspace task" });
  await expect(workspace.getByLabel("Title")).toHaveValue("Draft survives reflow");
});

test("desktop and narrow navigation share the same destinations and semantic icons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const label of ["Planner", "History", "Settings"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toHaveCount(1);
  }
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }).first().locator("svg"),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNavigation = page.getByRole("navigation", {
    name: "Primary",
  });
  await expect(mobileNavigation).toBeVisible();

  for (const label of ["Planner", "History", "Settings"] as const) {
    const button = mobileNavigation.getByRole("button", {
      name: label,
      exact: true,
    });
    await expect(button).toBeVisible();
    expect(await button.locator("svg").count()).toBeGreaterThanOrEqual(1);
  }
  await expect(
    mobileNavigation.getByRole("button", {
      name: "Planner",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
});

test("outstanding Task action menus are identical at desktop and narrow widths", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Menu first", today);
  await createTask(page, "Menu parity", today);
  await createTask(page, "Menu last", today);
  await page.reload();

  const menuLabels = async (): Promise<string[]> => {
    const row = page
      .getByText("Menu parity", { exact: true })
      .locator("xpath=ancestor::li[1]");
    await row.getByRole("button", { name: "Actions for Menu parity" }).click();
    const labels = (await page.getByRole("menuitem").allTextContents())
      .map((label) => label.trim());
    await page.keyboard.press("Escape");
    return labels;
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await menuLabels();
  expect(desktop).toEqual([
    "Open / edit",
    "Complete",
    "Priority: High",
    "Priority: Normal",
    "Priority: Low",
    "Move up",
    "Move down",
    "Delete…",
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await menuLabels()).toEqual(desktop);
});

test("Repeat uses one shared series while Task occurrences remain ordinary canonical Tasks", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  const endDate = await browserCivilDate(page, 14);
  await createTask(page, "Browser recurrence", today);
  await page.reload();

  await page.getByText("Browser recurrence", { exact: true }).click();
  let workspace = page.getByRole("dialog", {
    name: "Browser recurrence",
  });
  const repeat = workspace.getByRole("combobox", { name: "Repeat" });
  await page.screenshot({
    path: testInfo.outputPath("v1.1-task-form-off-desktop.png"),
    fullPage: true,
  });
  await repeat.click();
  await page.getByRole("option", { name: "Monthly", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-task-form-monthly-desktop.png"),
    fullPage: true,
  });
  await repeat.click();
  await page.getByRole("option", { name: "Weekly", exact: true }).click();
  await workspace
    .getByLabel("Ends on")
    .fill(await displayedDateValue(page, endDate));
  await page.screenshot({
    path: testInfo.outputPath("v1.1-task-form-weekly-desktop.png"),
    fullPage: true,
  });
  await workspace
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(workspace).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Task saved" }),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const state = await apiState(page);
      return {
        recurrences: state.recurrences.length,
        linked: state.tasks.filter(
          (task) => task.recurrence_series_id !== null,
        ).length,
      };
    })
    .toEqual({
      recurrences: 1,
      linked: 3,
    });

  let state = await apiState(page);
  const series = state.recurrences[0];
  if (series === undefined) {
    throw new Error("Expected recurrence series");
  }
  expect(
    state.tasks.every(
      (task) => task.recurrence_series_id === series.id,
    ),
  ).toBe(true);
  await expect(
    page.getByLabel("Recurring task").first(),
  ).toBeVisible();
  const rangeBeforeNext = await page.locator(".jig-header-week-range").textContent();
  await page.getByRole("button", { name: "Next horizon" }).click();
  await expect(page.locator(".jig-header-week-range")).not.toHaveText(
    rangeBeforeNext ?? "",
  );
  await activeWeek(page)
    .getByText("Browser recurrence", { exact: true })
    .click();
  workspace = page.getByRole("dialog", {
    name: "Browser recurrence",
  });
  await expect(
    workspace.getByRole("combobox", { name: "Repeat" }),
  ).toContainText("Weekly");
  await expect(workspace.getByLabel("Ends on")).toHaveValue(
    await displayedDateValue(page, endDate),
  );
  await expect(
    workspace.getByText(
      "Repeat changes the series schedule. Other Task fields change this Task only.",
      { exact: true },
    ),
  ).toBeVisible();

  const invokingSlot = state.tasks.find(
    (task) =>
      task.scheduled_date !== today &&
      task.recurrence_series_id === series.id,
  )?.recurrence_occurrence_date;
  if (invokingSlot === undefined || invokingSlot === null) {
    throw new Error("Expected later recurrence occurrence");
  }

  const repeatForExisting = workspace.getByRole("combobox", {
    name: "Repeat",
  });
  await repeatForExisting.click();
  await page
    .getByRole("option", { name: "Does not repeat", exact: true })
    .click();
  await expect(
    workspace.getByText("Stop this series when you save?", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("v1.1-task-form-stop-desktop.png"),
    fullPage: true,
  });

  for (const width of [320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 844 });
    await waitForResponsiveHeader(page, width);
    workspace = page.getByRole("dialog", {
      name: "Browser recurrence",
    });
    await expect(
      workspace.getByText("Stop this series when you save?", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`v1.1-task-form-stop-mobile-${width}.png`),
      fullPage: true,
    });
  }

  await workspace
    .getByRole("button", { name: "Save", exact: true })
    .click();

  await expect
    .poll(async () => {
      state = await apiState(page);
      return {
        tasks: state.tasks.length,
        recurrences: state.recurrences.length,
        remaining: state.tasks[0] ?? null,
      };
    })
    .toMatchObject({
      tasks: 1,
      recurrences: 0,
      remaining: {
        recurrence_series_id: null,
        recurrence_occurrence_date: null,
      },
    });
});

test("History and Settings keep one continuous 50rem measure across the Planner breakpoint", async ({
  page,
}) => {
  const viewports = [1440, 1168, 1167, 1024, 900, 800, 600, 390] as const;

  for (const width of viewports) {
    await page.setViewportSize({ width, height: 900 });
    await waitForResponsiveHeader(page, width);

    for (const destination of ["History", "Settings"] as const) {
      if (width >= 1168) {
        await page.getByRole("button", { name: destination, exact: true }).click();
      } else {
        await page
          .getByRole("navigation", { name: "Primary" })
          .getByRole("button", { name: destination, exact: true })
          .click();
      }

      const selector =
        destination === "History" ? ".jig-history-view" : ".jig-settings-view";
      const box = await page.locator(selector).boundingBox();
      expect(box, `${destination} @ ${width}`).not.toBeNull();
      if (box !== null) {
        const expectedWidth = Math.min(width, 800);
        expectNear(box.width, expectedWidth, 1);
        expectNear(box.x, (width - expectedWidth) / 2, 1);
      }

      if (width < 1168) {
        const padding = await page.locator(selector).evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            left: Number.parseFloat(style.paddingInlineStart),
            right: Number.parseFloat(style.paddingInlineEnd),
          };
        });
        expect(padding.left).toBeGreaterThan(0);
        expect(padding.right).toBe(padding.left);
      }

      if (destination === "Settings") {
        const settings = page.locator(".jig-settings-sections");
        await expect(settings).toBeVisible();
        await expect(
          settings.locator(".jig-settings-section"),
        ).toHaveCount(4);
        const headings = await settings.getByRole("heading", { level: 2 })
          .allTextContents();
        expect(headings.map((value) => value.trim())).toEqual([
          "Data & sync",
          "Appearance",
          "Notifications",
          "Diagnostics",
        ]);
        await expect(
          settings.getByText("Planning data", { exact: true }),
        ).toBeVisible();
        await expect(
          settings.getByText("Saved on this device", { exact: true }),
        ).toBeVisible();
        await expect(
          settings.getByText("Synchronization", { exact: true }),
        ).toBeVisible();
        await expect(
          settings.locator(
            ".jig-settings-section:not(.jig-settings-diagnostics) .jig-settings-card",
          ),
        ).toHaveCount(0);
        const notifications = settings.locator(
          '.jig-settings-section[aria-labelledby="notifications-heading"]',
        );
        await expect(
          notifications.getByText("Browser notifications", { exact: true }),
        ).toBeVisible();
        await expect(
          notifications.getByText("Android notifications", { exact: true }),
        ).toHaveCount(0);
        await expect(
          notifications.getByRole("button", {
            name: "Exact timing settings",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(notifications).not.toContainText("exact alarms");
      }
    }

    if (width >= 1168) {
      await page.getByRole("button", { name: "Planner", exact: true }).click();
    } else {
      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("button", { name: "Planner", exact: true })
        .click();
    }
    const planner = await activeWeek(page)
      .locator(".jig-week-board")
      .boundingBox();
    expect(planner).not.toBeNull();
    if (planner !== null) {
      expectNear(planner.x, 0, 1);
      expectNear(planner.width, width, 1);
    }
  }
});

test("AppShell main is the sole configured scroller across governed widths", async ({
  page,
}) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1168, height: 900 },
    { width: 1167, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 720 },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await waitForResponsiveHeader(page, viewport.width);

    const expectedPresentation =
      viewport.width >= 1168 ? "desktop" : "narrow";
    await expect(
      page.locator(
        `[data-jig-configured-presentation="${expectedPresentation}"]`,
      ),
    ).toHaveCount(1);
    await expect(applicationScrollOwner(page)).toHaveCount(1);

    for (const selector of [
      ".jig-app-shell",
      ".jig-app-header",
      ".jig-content-frame",
      ".jig-content",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      if (box !== null) {
        expectNear(box.x, 0, 1);
        expectNear(box.width, viewport.width, 1);
      }
    }

    const geometry = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(".jig-content-frame");
      const owner = document.querySelector<HTMLElement>("#astryx-app-shell-main");
      const planner = document.querySelector<HTMLElement>(".jig-planner-surface");
      if (frame === null || owner === null || planner === null) {
        throw new Error("Configured viewport geometry unavailable");
      }
      const frameStyle = getComputedStyle(frame);
      return {
        frameOverflowX: frameStyle.overflowX,
        frameOverflowY: frameStyle.overflowY,
        ownerOverflowY: getComputedStyle(owner).overflowY,
        ownerBottom: owner.getBoundingClientRect().bottom,
        plannerBottom: planner.getBoundingClientRect().bottom,
        margin: frameStyle.margin,
        padding: frameStyle.padding,
        border: frameStyle.borderWidth,
        radius: frameStyle.borderRadius,
        shadow: frameStyle.boxShadow,
      };
    });
    expect(["visible", "clip"]).toContain(geometry.frameOverflowY);
    expect(["visible", "clip"]).toContain(geometry.frameOverflowX);
    expect(["auto", "scroll"]).toContain(geometry.ownerOverflowY);
    expect(geometry.plannerBottom).toBeGreaterThanOrEqual(
      geometry.ownerBottom - 1,
    );
    expect(geometry.margin).toBe("0px");
    expect(geometry.padding).toBe("0px");
    expect(geometry.border).toBe("0px");
    expect(geometry.radius).toBe("0px");
    expect(geometry.shadow).toBe("none");

    if (viewport.width < 1168) {
      const bottomNavigation = page.getByRole("navigation", {
        name: "Primary",
      });
      const navigationBox = await bottomNavigation.boundingBox();
      if (navigationBox === null) {
        throw new Error("Compact bottom-navigation geometry unavailable");
      }
      expectNear(navigationBox.height, 64, 1);
      const fab = page.getByRole("button", { name: "Add task", exact: true });
      const fabBox = await fab.boundingBox();
      expect(fabBox).not.toBeNull();
      if (fabBox !== null) {
        expectNear(fabBox.width, 56, 1);
        expectNear(fabBox.height, 56, 1);
      }
      const contentPaddingBottom = await page
        .locator(".jig-content-configured-planner .jig-planner-surface")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).paddingBottom),
        );
      expect(contentPaddingBottom).toBeGreaterThanOrEqual(
        navigationBox.height - 1,
      );
    }
  }

  const today = await browserCivilDate(page);
  for (let index = 0; index < 18; index += 1) {
    await createTask(page, `Viewport overflow ${index + 1}`, today);
  }
  await page.reload();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await waitForResponsiveHeader(page, viewport.width);
    const overflow = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>(".jig-content-frame");
      const owner = document.querySelector<HTMLElement>("#astryx-app-shell-main");
      if (frame === null || owner === null) {
        throw new Error("Configured scroll owner unavailable");
      }
      owner.scrollTop = 120;
      return {
        frameOverflowY: getComputedStyle(frame).overflowY,
        frameScrollTop: frame.scrollTop,
        ownerScrollable: owner.scrollHeight > owner.clientHeight,
        ownerScrollTop: owner.scrollTop,
      };
    });
    expect(["visible", "clip"]).toContain(overflow.frameOverflowY);
    expect(overflow.frameScrollTop).toBe(0);
    expect(overflow.ownerScrollable).toBe(true);
    expect(overflow.ownerScrollTop).toBeGreaterThan(0);
  }

  await page.setViewportSize({ width: 1168, height: 900 });
  await waitForResponsiveHeader(page, 1168);
  const desktopGeometry = await activeWeek(page)
    .locator(".jig-week-column")
    .evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width };
      }),
    );
  expect(desktopGeometry).toHaveLength(2);
  expectNear(desktopGeometry[0]?.y ?? 0, desktopGeometry[1]?.y ?? 0, 1);
  expect(desktopGeometry[0]?.width ?? 0).toBeGreaterThanOrEqual(160);

  await page.setViewportSize({ width: 1167, height: 900 });
  await waitForResponsiveHeader(page, 1167);
  const narrowGeometry = await activeWeek(page)
    .locator(".jig-week-column")
    .evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => ({
        y: element.getBoundingClientRect().y,
      })),
    );
  expect(narrowGeometry).toHaveLength(2);
  expect(narrowGeometry[1]?.y ?? 0).toBeGreaterThan(narrowGeometry[0]?.y ?? 0);
});

test("configured Planner History and Settings share the Planner surface while chrome remains distinct", async ({
  page,
}) => {
  const readSurfaces = async (): Promise<{
    readonly content: string;
    readonly header: string;
    readonly planner: string | null;
    readonly bottomNavigation: string | null;
  }> =>
    page.evaluate(() => {
      const content = document.querySelector<HTMLElement>(
        ".jig-content-configured",
      );
      const header = document.querySelector<HTMLElement>(".jig-app-header");
      const planner = document.querySelector<HTMLElement>(
        ".jig-planner-surface",
      );
      const bottomNavigation = document.querySelector<HTMLElement>(
        ".jig-mobile-bottom-navigation",
      );
      if (content === null || header === null) {
        throw new Error("Configured surface fixture is unavailable");
      }
      return {
        content: getComputedStyle(content).backgroundColor,
        header: getComputedStyle(header).backgroundColor,
        planner:
          planner === null ? null : getComputedStyle(planner).backgroundColor,
        bottomNavigation:
          bottomNavigation === null
            ? null
            : getComputedStyle(bottomNavigation).backgroundColor,
      };
    });

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForResponsiveHeader(page, 1440);

  const plannerDesktop = await readSurfaces();
  expect(plannerDesktop.planner).not.toBeNull();
  expect(plannerDesktop.content).toBe(plannerDesktop.planner);
  expect(plannerDesktop.content).not.toBe(plannerDesktop.header);

  await page.getByRole("button", { name: "History", exact: true }).click();
  const historyDesktop = await readSurfaces();
  expect(historyDesktop.content).toBe(plannerDesktop.content);
  expect(historyDesktop.content).not.toBe(historyDesktop.header);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsDesktop = await readSurfaces();
  expect(settingsDesktop.content).toBe(plannerDesktop.content);
  expect(settingsDesktop.content).not.toBe(settingsDesktop.header);

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });

  for (const destination of ["Settings", "History", "Planner"] as const) {
    await primaryNavigation
      .getByRole("button", { name: destination, exact: true })
      .click();
    const surfaces = await readSurfaces();
    expect(surfaces.content, destination).toBe(plannerDesktop.content);
    expect(surfaces.content, destination).not.toBe(surfaces.header);
    expect(surfaces.bottomNavigation, destination).toBe(surfaces.header);
  }
});

test("all v1.0.6 themes preserve semantic surfaces in Light Dark and live System mode", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const today = await browserCivilDate(page);
  await createTask(page, "Theme matrix contract", today);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const preset of THEME_PRESETS) {
    for (const mode of ["light", "dark"] as const) {
      await setAppearance(page, preset, mode);
      const snapshot = await themeSnapshot(page);
      await page.screenshot({
        path: testInfo.outputPath(
          `v1.1-theme-${preset}-${mode}-desktop.png`,
        ),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await waitForResponsiveHeader(page, 390);
      await page.screenshot({
        path: testInfo.outputPath(
          `v1.1-theme-${preset}-${mode}-mobile-390.png`,
        ),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await waitForResponsiveHeader(page, 1440);
      expect(snapshot.rootTheme).toBe(preset);
      expect(snapshot.explicitMode).toBe(mode);
      expect(snapshot.chromeBackground, `${preset}/${mode} chrome matches body`)
        .toBe(snapshot.bodyBackground);
      expect(
        snapshot.contentBackground,
        `${preset}/${mode} configured content uses Planner surface`,
      ).toBe(snapshot.plannerBackground);
      expect(
        new Set([
          snapshot.chromeBackground,
          snapshot.plannerBackground,
          snapshot.taskBackground,
        ]).size,
        `${preset}/${mode} surface colors must resolve distinctly`,
      ).toBe(3);
      expect(
        oklabDistance(snapshot.chromeBackground, snapshot.plannerBackground),
        `${preset}/${mode} chrome↔Planner OKLab distance`,
      ).toBeGreaterThanOrEqual(0.018);
      expect(
        oklabDistance(snapshot.chromeBackground, snapshot.taskBackground),
        `${preset}/${mode} chrome↔Task OKLab distance`,
      ).toBeGreaterThanOrEqual(0.018);
      expect(
        oklabDistance(snapshot.plannerBackground, snapshot.taskBackground),
        `${preset}/${mode} Planner↔Task OKLab distance`,
      ).toBeGreaterThanOrEqual(0.025);
      expect(snapshot.laneBackground, `${preset}/${mode} lane remains open`)
        .toBe("rgba(0, 0, 0, 0)");
      expect(snapshot.taskBorder).not.toBe("rgba(0, 0, 0, 0)");
      expect(
        contrastRatio(snapshot.bodyText, snapshot.bodyBackground),
        `${preset}/${mode} body text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(snapshot.taskText, snapshot.taskBackground),
        `${preset}/${mode} Task text contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(snapshot.taskMetaText, snapshot.taskBackground),
        `${preset}/${mode} Task metadata contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(snapshot.todayBorder).not.toBe(snapshot.taskBorder);
      expect(
        snapshot.motionDurations.map((value) => {
          const parsed = Number.parseFloat(value);
          return value.endsWith("ms") ? parsed : parsed * 1000;
        }),
      ).toEqual([
        190,
        250,
        330,
        450,
        600,
        800,
        1050,
        1400,
        1870,
      ]);
      expect(
        contrastRatio(snapshot.logoPrimary, snapshot.chromeBackground),
        `${preset}/${mode} logo primary contrast on chrome`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(snapshot.logoAccent, snapshot.chromeBackground),
        `${preset}/${mode} logo accent contrast on chrome`,
      ).toBeGreaterThanOrEqual(3);
      for (const [index, pair] of snapshot.statusPairs.entries()) {
        expect(
          contrastRatio(pair.foreground, pair.background),
          `${preset}/${mode} status contrast #${index}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }

    await page.emulateMedia({ colorScheme: "light" });
    await setAppearance(page, preset, "system");
    const systemLight = await themeSnapshot(page);
    expect(systemLight.rootTheme).toBe(preset);
    expect(systemLight.explicitMode).toBeNull();

    await page.emulateMedia({ colorScheme: "dark" });
    await expect
      .poll(async () => (await themeSnapshot(page)).bodyBackground)
      .not.toBe(systemLight.bodyBackground);
    await expect
      .poll(async () => {
        const snapshot = await themeSnapshot(page);
        return snapshot.chromeBackground === snapshot.bodyBackground;
      })
      .toBe(true);
    const systemDark = await themeSnapshot(page);
    expect(systemDark.rootTheme).toBe(preset);
    expect(systemDark.explicitMode).toBeNull();
    expect(systemDark.chromeBackground).toBe(systemDark.bodyBackground);
    expect(systemDark.contentBackground).toBe(systemDark.plannerBackground);
    expect(systemDark.plannerBackground).not.toBe(systemDark.chromeBackground);
    expect(systemDark.laneBackground).toBe("rgba(0, 0, 0, 0)");
    expect(systemDark.taskBackground).not.toBe(systemDark.plannerBackground);
  }

  await page.emulateMedia({ colorScheme: "no-preference" });
});

test("Settings leads with continuity and keeps Git mechanics in Diagnostics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  const dataSync = page.locator(".jig-settings-section").filter({
    has: page.getByRole("heading", { name: "Data & sync" }),
  });
  const diagnosticsSection = page.locator(".jig-settings-diagnostics");

  await expect(
    dataSync.getByText("Connected repository", { exact: true }),
  ).toBeVisible();
  await expect(dataSync).not.toContainText("/tmp/jig-playwright-remote.git");
  await expect(
    dataSync.getByText(/^(Syncing|Up to date)$/),
  ).toBeVisible();
  await expect(dataSync.getByText("Local Git", { exact: true }))
    .toHaveCount(0);
  await expect(dataSync.getByText("Remote Git", { exact: true }))
    .toHaveCount(0);
  await expect(
    dataSync.getByRole("button", { name: "Sync now", exact: true }),
  ).toHaveCount(0);

  await expect(diagnosticsSection.getByText("Local Git", { exact: true }))
    .toHaveCount(0);
  await diagnosticsSection
    .getByRole("button", { name: "Show diagnostics", exact: true })
    .click();

  const diagnostics = diagnosticsSection.locator(".jig-settings-card");
  await expect(diagnostics.getByText("Local Git", { exact: true }))
    .toBeVisible();
  await expect(diagnostics.getByText("Remote Git", { exact: true }))
    .toBeVisible();
  await expect(diagnostics).toContainText("/tmp/jig-playwright-remote.git");
  await expect(
    diagnostics.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeVisible();

  await diagnostics
    .getByRole("button", { name: "Sync now", exact: true })
    .click();

  await expect
    .poll(async () => {
      const localGit = diagnostics
        .locator("dt", { hasText: "Local Git" })
        .locator("xpath=following-sibling::dd[1]");
      return (await localGit.textContent())?.trim() ?? "";
    }, { timeout: 10_000 })
    .toBe("Committed");

  await expect
    .poll(async () => {
      const remoteGit = diagnostics
        .locator("dt", { hasText: "Remote Git" })
        .locator("xpath=following-sibling::dd[1]");
      return (await remoteGit.textContent())?.trim() ?? "";
    }, { timeout: 10_000 })
    .toBe("Synchronized");

  await expect(
    dataSync.getByText("Up to date", { exact: true }),
  ).toBeVisible();

  const remoteRepository = diagnostics
    .locator("dt", { hasText: "Remote repository" })
    .locator("xpath=following-sibling::dd[1]");
  await expect(remoteRepository).toContainText("/tmp/jig-playwright-remote.git");
  await expect(remoteRepository).toContainText("Git remote: origin");

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings", exact: true }),
  ).toHaveCount(1);
  await expect(diagnostics.getByText("Local Git", { exact: true }))
    .toBeVisible();
  await expect(diagnostics.getByText("Remote Git", { exact: true }))
    .toBeVisible();
});

test("Theme and Appearance controls exist only in Settings and apply independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("combobox", { name: "Theme" })).toHaveCount(0);
  await expect(page.getByText("Appearance", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const themeSelector = page.getByRole("combobox", { name: "Theme" });
  await expect(themeSelector).toBeVisible();
  await themeSelector.click();

  const options = page.getByRole("option");
  await expect(options).toHaveCount(13);
  expect(await options.allTextContents()).toEqual([
    "Jig",
    "Neutral",
    "Butter",
    "Chocolate",
    "Matcha",
    "Stone",
    "Y2K",
    "Gruvbox",
    "Dracula",
    "Solarized",
    "Nord",
    "Catppuccin",
    "Tokyo Night",
  ]);
  await page.getByRole("option", { name: "Dracula", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-astryx-theme", "dracula");
  const themeTransitionProperties = await page.locator(".jig-app-shell").evaluate(
    (element) => getComputedStyle(element).transitionProperty,
  );
  expect(themeTransitionProperties).toContain("background-color");

  const appearance = page.getByText("Appearance", { exact: true });
  await expect(appearance).toBeVisible();
  await page.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const stored = await page.evaluate(() => ({
    theme: localStorage.getItem("jig-theme-family"),
    mode: localStorage.getItem("jig-appearance-mode"),
    legacy: localStorage.getItem("jig-theme"),
  }));
  expect(stored).toEqual({ theme: "dracula", mode: "dark", legacy: null });
});

test("invalid appearance storage falls back safely and persistence failure does not block in-memory changes", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem("jig-theme-family", "not-a-jig-theme");
    localStorage.setItem("jig-appearance-mode", "sepia");
    localStorage.setItem("jig-theme", "also-invalid");
  });
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-astryx-theme", "jig");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value: () => {
        throw new DOMException("synthetic localStorage write failure", "QuotaExceededError");
      },
    });
    Object.defineProperty(Storage.prototype, "removeItem", {
      configurable: true,
      value: () => {
        throw new DOMException("synthetic localStorage remove failure", "QuotaExceededError");
      },
    });
  });

  const themeSelector = page.getByRole("combobox", { name: "Theme" });
  await themeSelector.click();
  await page.getByRole("option", { name: "Gruvbox", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-astryx-theme", "gruvbox");

  await page.getByText("Dark", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Settings workspace menu and destructive dialog inherit the active semantic theme", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Theme scope task", today);
  await page.reload();
  await setAppearance(page, "dracula", "dark");

  const rootTokens = await page.locator("html").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      surface: style.getPropertyValue("--color-background-surface").trim(),
      popover: style.getPropertyValue("--color-background-popover").trim(),
      primary: style.getPropertyValue("--color-text-primary").trim(),
    };
  });
  expect(rootTokens.surface).not.toBe("");
  expect(rootTokens.popover).not.toBe("");
  expect(rootTokens.primary).not.toBe("");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsSurface = page.locator(".jig-settings-group").first();
  await expect(settingsSurface).toBeVisible();
  const settingsTokens = await settingsSurface.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      surface: style.getPropertyValue("--color-background-surface").trim(),
      primary: style.getPropertyValue("--color-text-primary").trim(),
    };
  });
  expect(settingsTokens).toEqual({
    surface: rootTokens.surface,
    primary: rootTokens.primary,
  });

  await page.getByRole("button", { name: "Planner", exact: true }).click();
  const task = page
    .getByText("Theme scope task", { exact: true })
    .locator("xpath=ancestor::li[1]");

  await task.getByRole("button", { name: "Actions for Theme scope task" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const menuPopover = await menu.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--color-background-popover")
      .trim(),
  );
  expect(menuPopover).toBe(rootTokens.popover);
  await page.keyboard.press("Escape");

  await task.click();
  const workspace = page.getByRole("dialog", { name: "Theme scope task" });
  await expect(workspace).toBeVisible();
  const workspaceTokens = await workspace.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      surface: style.getPropertyValue("--color-background-surface").trim(),
      primary: style.getPropertyValue("--color-text-primary").trim(),
    };
  });
  expect(workspaceTokens).toEqual({
    surface: rootTokens.surface,
    primary: rootTokens.primary,
  });

  await workspace
    .getByRole("button", { name: "Delete…", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  const dialogPopover = await confirmation.evaluate((element) =>
    getComputedStyle(element)
      .getPropertyValue("--color-background-popover")
      .trim(),
  );
  expect(dialogPopover).toBe(rootTokens.popover);
});

test("legacy appearance preference is honored and migrated by the next explicit setting", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.removeItem("jig-appearance-mode");
    localStorage.removeItem("jig-theme-family");
    localStorage.setItem("jig-theme", "dark");
  });
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-astryx-theme", "jig");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Light", { exact: true }).click();
  const stored = await page.evaluate(() => ({
    mode: localStorage.getItem("jig-appearance-mode"),
    legacy: localStorage.getItem("jig-theme"),
  }));
  expect(stored).toEqual({ mode: "light", legacy: null });
});

test("browser notification infrastructure registers the production service worker", async ({
  page,
}) => {
  await page.context().grantPermissions(["notifications"]);
  await page.reload();

  await expect.poll(async () =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.scriptURL ?? null;
    }),
  ).toContain("/jig-notifications-sw.js");

  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);
});


test("History keeps its destination active while using the same editable workspace and complete menu", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "History detail contract", today);
  const created = (await apiState(page)).tasks.find(
    (task) => task.title === "History detail contract",
  );
  if (created === undefined) {
    throw new Error("History fixture missing");
  }
  await apiCommand(page, { type: "complete", task_id: created.id });
  await page.reload();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");

  const row = page
    .getByText("History detail contract", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await row.getByRole("button", { name: "Actions for History detail contract" }).click();
  await expect(page.getByRole("menuitem", { name: "Open / edit", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Reopen", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Priority: High", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete…", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByText("History detail contract", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "History detail contract" })).toBeVisible();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");
});
