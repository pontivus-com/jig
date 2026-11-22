import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFiles(
  directory: string,
): readonly [string, string][] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    if (
      !entry.isFile() ||
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      entry.name.endsWith(".d.ts")
    ) {
      return [];
    }
    return [[path, source(path)] as const];
  });
}

const production = [
  ...sourceFiles("src"),
  ...sourceFiles("ui/src"),
];

const EXPECTED_FAILURES = {
  rawNativePlatformDetection: {
    task: "J112-IMP-08",
    violations: ["ui/src/reminder.tsx"],
  },
  sourceOwnershipTopology: {
    task: "J112-IMP-14",
    violations: [
      "legacy:src/github-auth.ts",
      "legacy:src/github-device-flow.ts",
      "legacy:src/github-onboarding.ts",
      "legacy:src/github-reconnect.ts",
      "legacy:src/github-registration.ts",
      "legacy:src/github.ts",
      "legacy:src/portable.ts",
      "legacy:src/protocol.ts",
      "legacy:src/shell/git.ts",
      "missing:src/core/portable.ts",
      "missing:src/github/auth.ts",
      "missing:src/github/device-flow.ts",
      "missing:src/github/model.ts",
      "missing:src/github/onboarding.ts",
      "missing:src/github/parsing.ts",
      "missing:src/github/reconnect.ts",
      "missing:src/github/registration.ts",
      "missing:src/protocol/runtime.ts",
      "missing:src/shell/git/portable-store.ts",
      "missing:src/shell/git/process.ts",
      "missing:src/shell/git/remote.ts",
      "missing:src/shell/git/repository.ts",
    ],
  },
  recoveryPolicyOwner: {
    task: "J112-IMP-17",
    violations: ["missing:src/core/synchronization-recovery.ts"],
  },
  resolverDraftOwner: {
    task: "J112-IMP-17",
    violations: ["missing:ui/src/sync-conflict-state.ts"],
  },
} as const;

type ExpectedFailureId = keyof typeof EXPECTED_FAILURES;

function expectGuardViolations(
  id: ExpectedFailureId,
  actual: readonly string[],
): void {
  const expected = [...EXPECTED_FAILURES[id].violations].sort();
  expect(
    [...actual].sort(),
    `${id} is an explicit ${EXPECTED_FAILURES[id].task} expected failure. Remove the registry entry when the owning task closes; do not weaken the guard.`,
  ).toEqual(expected);
}

function declarationOwners(pattern: RegExp): readonly string[] {
  return production.flatMap(([path, content]) =>
    pattern.test(content) ? [path] : [],
  );
}

describe("v1.1.2 corrective architecture boundaries", () => {
  it("keeps one width-only 73rem LayoutMode owner", () => {
    const owners = declarationOwners(/export type LayoutMode\s*=/);
    expect(owners).toEqual(["ui/src/use-layout-mode.ts"]);

    const queryOwners = production.flatMap(([path, content]) =>
      content.includes('"(min-width: 73rem)"') ? [path] : [],
    );
    expect(queryOwners).toEqual(["ui/src/use-layout-mode.ts"]);

    const layoutMode = source("ui/src/use-layout-mode.ts");
    expect(layoutMode).not.toMatch(/Capacitor|Android|isNativePlatform|pointer|coarse/);
  });

  it("contains raw native-platform detection to the governed runtime boundaries", () => {
    const allowed = new Set([
      "ui/src/runtime.ts",
      "ui/src/setup-http.ts",
      "ui/src/notification-settings.ts",
    ]);
    const violations = production.flatMap(([path, content]) => {
      if (!content.includes("Capacitor.isNativePlatform()")) {
        return [];
      }
      if (allowed.has(path) || path.startsWith("ui/src/native/")) {
        return [];
      }
      return [path];
    });
    expectGuardViolations("rawNativePlatformDetection", violations);
  });

  it("keeps LayoutMode out of platform, persistence, Git and transport adapters", () => {
    const adapterPaths = production.filter(([path]) =>
      path.startsWith("src/persistence/") ||
      path.startsWith("src/shell/") ||
      path.startsWith("src/github/") ||
      path.startsWith("ui/src/native/") ||
      path === "ui/src/browser-notifications.ts" ||
      path === "ui/src/notification-settings.ts" ||
      path === "ui/src/runtime.ts" ||
      path === "ui/src/setup-http.ts",
    );

    for (const [path, content] of adapterPaths) {
      expect(content, path).not.toMatch(/\bLayoutMode\b|use-layout-mode/);
    }
  });

  it("prevents desktop/narrow presenter cross-imports and outward imports from shared leaves", () => {
    for (const [path, content] of sourceFiles("ui/src/presentation/desktop")) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*(?:\/|\.\.)narrow(?:\/|["'])/);
    }
    for (const [path, content] of sourceFiles("ui/src/presentation/narrow")) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*(?:\/|\.\.)desktop(?:\/|["'])/);
    }
    for (const [path, content] of sourceFiles("ui/src/presentation/shared")) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*(?:desktop|narrow)\//);
    }
  });

  it("keeps destination, Task sequence projection and workspace state single-owner", () => {
    expect(
      declarationOwners(/\b(?:const|export const)\s+DESTINATIONS\s*=\s*\[/),
    ).toEqual(["ui/src/planner-header.tsx"]);
    expect(
      declarationOwners(/export type TaskWorkspaceState\s*=/),
    ).toEqual(["ui/src/task-workspace.tsx"]);
    expect(
      declarationOwners(/function plannerTaskPresentationItems\s*\(/),
    ).toEqual(["ui/src/planner-list.tsx"]);
  });

  it("reserves one pure recovery-policy owner and one UI-only resolver-draft owner", () => {
    const recoveryPath = "src/core/synchronization-recovery.ts";
    const recoveryViolations = existsSync(recoveryPath)
      ? []
      : [`missing:${recoveryPath}`];
    expectGuardViolations("recoveryPolicyOwner", recoveryViolations);

    if (existsSync(recoveryPath)) {
      const recovery = source(recoveryPath);
      expect(recovery).not.toMatch(
        /from\s+["'][^"']*(?:shell|persistence|protocol|github|ui)\/|node:|bun:|Bun\.|@capacitor|isomorphic-git|\bfetch\(/,
      );
    }

    const draftPath = "ui/src/sync-conflict-state.ts";
    const draftViolations = existsSync(draftPath)
      ? []
      : [`missing:${draftPath}`];
    expectGuardViolations("resolverDraftOwner", draftViolations);

    if (existsSync(draftPath)) {
      expect(source(draftPath)).not.toMatch(
        /from\s+["'][^"']*(?:src\/shell|src\/persistence|\.\/native|\/native\/|isomorphic-git)/,
      );
    }

    const recoveryDeclarations = production.flatMap(([path, content]) =>
      /\b(?:interface|type)\s+JigData(?:Conflict|Resolution)\w*/.test(content)
        ? [path]
        : [],
    );
    for (const path of recoveryDeclarations) {
      expect(path).toBe(recoveryPath);
    }
  });

  it("freezes the SD-17 source-ownership cutover without compatibility barrels", () => {
    const legacyPaths = [
      "src/portable.ts",
      "src/protocol.ts",
      "src/github.ts",
      "src/github-auth.ts",
      "src/github-device-flow.ts",
      "src/github-onboarding.ts",
      "src/github-reconnect.ts",
      "src/github-registration.ts",
      "src/shell/git.ts",
    ] as const;
    const imp14Targets = [
      "src/core/portable.ts",
      "src/protocol/runtime.ts",
      "src/github/model.ts",
      "src/github/parsing.ts",
      "src/github/auth.ts",
      "src/github/device-flow.ts",
      "src/github/onboarding.ts",
      "src/github/reconnect.ts",
      "src/github/registration.ts",
      "src/shell/git/process.ts",
      "src/shell/git/repository.ts",
      "src/shell/git/portable-store.ts",
      "src/shell/git/remote.ts",
    ] as const;

    const violations = [
      ...legacyPaths.flatMap((path) =>
        existsSync(path) ? [`legacy:${path}`] : [],
      ),
      ...imp14Targets.flatMap((path) =>
        existsSync(path) ? [] : [`missing:${path}`],
      ),
    ];
    expectGuardViolations("sourceOwnershipTopology", violations);

    if (existsSync("src/github")) {
      for (const [path, content] of sourceFiles("src/github")) {
        expect(content, path).not.toMatch(
          /from\s+["'][^"']*(?:shell|persistence|ui)\/|@capacitor|bun:sqlite|Bun\.spawn|node:fs/,
        );
      }
    }
    if (existsSync("src/protocol/runtime.ts")) {
      expect(source("src/protocol/runtime.ts")).not.toMatch(
        /Bun\.|bun:|node:fs|@capacitor|isomorphic-git|\bfetch\(|localStorage|sessionStorage/,
      );
    }
    if (existsSync("src/shell/git")) {
      for (const [path, content] of sourceFiles("src/shell/git")) {
        expect(content, path).not.toMatch(/from\s+["'][^"']*ui\/src\/native/);
      }
    }
    for (const [path, content] of sourceFiles("ui/src/native")) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*src\/shell\//);
    }
  });

  it("locks the approved dependency stack and rejects recovery-specific escape hatches", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      readonly dependencies: Readonly<Record<string, string>>;
      readonly devDependencies: Readonly<Record<string, string>>;
    };
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      "@astryxdesign/core",
      "@astryxdesign/theme-butter",
      "@astryxdesign/theme-chocolate",
      "@astryxdesign/theme-matcha",
      "@astryxdesign/theme-neutral",
      "@astryxdesign/theme-stone",
      "@astryxdesign/theme-y2k",
      "@capacitor/android",
      "@capacitor/app",
      "@capacitor/core",
      "@capacitor/filesystem",
      "@capacitor/local-notifications",
      "@dnd-kit/dom",
      "@dnd-kit/react",
      "@stylexjs/stylex",
      "buffer",
      "isomorphic-git",
      "react",
      "react-dom",
    ].sort());
    expect(Object.keys(packageJson.devDependencies).sort()).toEqual([
      "@astryxdesign/cli",
      "@capacitor/cli",
      "@playwright/test",
      "@types/bun",
      "@types/react",
      "@types/react-dom",
      "typescript",
      "vite",
      "vitest",
    ].sort());

    const resolverSources = production.filter(([path]) =>
      path.includes("synchronization-recovery") ||
      path.includes("sync-conflict") ||
      path === "src/shell/git/recovery.ts",
    );
    for (const [path, content] of resolverSources) {
      expect(content, path).not.toMatch(/\bas\s+unknown\s+as\b|\bas\s+any\b|:\s*any\b|<any>|\bArray<any>\b/);
      expect(content, path).not.toMatch(/\b[A-Za-z_$][\w$]*!\s*(?:\.|[;,)}\]])/);
      expect(content, path).not.toMatch(/JSON\.parse\([^;\n]+\)\s+as\s+/);
    }
  });

  it("keeps explicit browser-profile and Android/native acceptance hooks", () => {
    const helpers = source("tests/browser/helpers.ts");
    for (const profile of [
      "expanded-fine",
      "narrow-fine",
      "narrow-coarse",
      "expanded-reduced-motion",
      "narrow-reduced-motion",
    ]) {
      expect(helpers).toContain(`"${profile}"`);
    }
    expect(helpers).toContain("withBrowserAcceptanceProfile");
    expect(helpers).toContain("hasTouch: true");
    expect(helpers).toContain('reducedMotion: "reduce"');

    const workflow = source(".github/workflows/verify.yml");
    expect(workflow).toContain("android-build-certification:");
    expect(workflow).toContain("android-api-24:");
    expect(workflow).toContain(":app:testDebugUnitTest :app:lintDebug");
    expect(workflow).toContain(":app:connectedDebugAndroidTest");

    const nativeHooks = source(
      "tests/certification/v1.1.2-native-acceptance.md",
    );
    for (const hook of [
      "J112-NA-01",
      "J112-NA-02",
      "J112-NA-03",
      "J112-NA-04",
      "J112-NA-05",
      "J112-NA-06",
      "J112-NA-07",
      "J112-NA-08",
    ]) {
      expect(nativeHooks).toContain(hook);
    }
    expect(nativeHooks).toContain("HOOK_ONLY");
  });
});
