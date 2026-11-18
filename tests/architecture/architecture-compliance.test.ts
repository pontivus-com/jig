import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function productionSources(
  directory: string,
): readonly [string, string][] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionSources(path);
    }
    if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name)) {
      return [];
    }
    if (/jig(?:\.variants|\.css)?\.d\.ts$/.test(entry.name)) {
      return [];
    }
    return [[path, source(path)] as const];
  });
}

const production = [
  ...productionSources("src"),
  ...productionSources("ui/src"),
];

describe("architecture compliance", () => {
  it("keeps the functional core dependency-free from shell and UI", () => {
    for (const [path, content] of production.filter(([path]) =>
      path.startsWith("src/core/"),
    )) {
      expect(content, path).not.toMatch(/from\s+["'][^"']*\/shell\//);
      expect(content, path).not.toMatch(/from\s+["'][^"']*\/ui\//);
      expect(content, path).not.toMatch(
        /bun:sqlite|node:fs|node:path|Bun\.spawn|\bfetch\(|\blocalStorage\b|\bsessionStorage\b/,
      );
    }
  });

  it("keeps browser UI independent from shell implementation modules", () => {
    for (const [path, content] of production.filter(([path]) =>
      path.startsWith("ui/src/"),
    )) {
      expect(content, path).not.toMatch(
        /from\s+["'][^"']*\/src\/shell\//,
      );
      expect(content, path).not.toMatch(/bun:sqlite|Bun\.spawn/);
    }
  });

  it("rejects architecture-inflating abstractions and unsafe typing escapes", () => {
    for (const [path, content] of production) {
      expect(content, path).not.toMatch(/\bas\s+unknown\s+as\b/);
      expect(content, path).not.toMatch(/\bas\s+any\b/);
      expect(content, path).not.toMatch(/:\s*any\b/);
      expect(content, path).not.toMatch(/<any>/);
      expect(content, path).not.toMatch(/\bArray<any>\b/);
      expect(content, path).not.toMatch(
        /\b(?:class|interface|type)\s+\w*(?:Dto|DTO|ViewModel)\b/,
      );
      expect(content, path).not.toMatch(
        /\bclass\s+\w*(?:Service|Repository|Manager)\b/,
      );
    }
  });

  it("keeps one canonical Task model and one protocol-envelope owner", () => {
    const taskOwners = production.filter(([, content]) =>
      /export interface Task\s*\{/.test(content),
    );
    expect(taskOwners.map(([path]) => path)).toEqual(["src/core/task.ts"]);

    for (const typeName of [
      "LocalGitSnapshotState",
      "RemoteGitSynchronization",
      "RepositorySynchronizationStatus",
      "CanonicalState",
      "CommandResult",
      "ServiceStatus",
      "Diagnostics",
    ]) {
      const owners = production.filter(([, content]) =>
        new RegExp(`export (?:type|interface) ${typeName}\\b`).test(content),
      );
      expect(owners.map(([path]) => path)).toEqual(["src/protocol.ts"]);
    }
  });

  it("keeps recurrence configuration single-owner and Task linkage-only", () => {
    const recurrenceOwners = production.filter(([, content]) =>
      /export interface RecurrenceSeries\s*\{/.test(content),
    );
    expect(recurrenceOwners.map(([path]) => path)).toEqual([
      "src/core/recurrence.ts",
    ]);

    const taskSource = source("src/core/task.ts");
    const taskStart = taskSource.indexOf("export interface Task {");
    const taskEnd = taskSource.indexOf(
      "\n}",
      taskStart,
    );
    expect(taskStart).toBeGreaterThanOrEqual(0);
    expect(taskEnd).toBeGreaterThan(taskStart);
    const taskInterface = taskSource.slice(taskStart, taskEnd);
    expect(taskInterface).toContain("recurrence_series_id");
    expect(taskInterface).toContain("recurrence_occurrence_date");
    expect(taskInterface).not.toContain("interval_weeks");
    expect(taskInterface).not.toContain("weekdays");
    expect(taskInterface).not.toContain("day_of_month");
    expect(taskInterface).not.toContain("end_date");

    const recurrence = source("src/core/recurrence.ts");
    const planning = source("src/core/recurrence-planning.ts");
    const editor = source("ui/src/recurrence-editor.tsx");
    const nativeRuntime = source("ui/src/runtime-native.ts");

    expect(recurrence).toContain("export type RecurrencePattern");
    expect(planning).toContain("setTaskRecurrence");
    expect(editor).toContain("type RecurrenceSeries");
    expect(editor).toContain("type RecurrenceSpec");
    expect(editor).not.toMatch(
      /interface\s+RecurrenceSeries\s*\{|type\s+RecurrencePattern\s*=/,
    );
    expect(nativeRuntime).not.toContain("RecurrenceSeries");
    expect(nativeRuntime).not.toContain("RecurrencePattern");
    expect(nativeRuntime).not.toContain("interval_weeks");
    expect(nativeRuntime).not.toContain("day_of_month");
  });

  it("keeps v1.0.4 Planner and editor semantics single-owner", () => {
    const app = source("ui/src/app.tsx");
    const planner = source("ui/src/planner.tsx");
    const week = source("ui/src/week.tsx");
    const list = source("ui/src/planner-list.tsx");
    const editor = source("ui/src/task-editor.tsx");

    expect(app).not.toContain("selectedDate");
    expect(planner).not.toContain("selectedDate");
    expect(week).not.toContain("selectedDate");
    expect(list).not.toContain("selectedDate");

    expect(week).toContain("<PlannerTaskList");
    expect(week).not.toContain("<TaskRow");
    expect(week).not.toContain("<SortableTaskRow");

    expect(editor).not.toContain("normalizeTitle");
    expect(editor).not.toContain("normalizeOptionalText");
    expect(editor).not.toContain("function optionalText");
  });

  it("enforces the SD-38 GitHub integration dependency direction", () => {
    const sync = source("src/shell/sync.ts");
    const protocol = source("src/protocol.ts");
    const http = source("src/shell/http.ts");
    const main = source("src/shell/main.ts");
    const onboarding = source("src/shell/github-onboarding.ts");
    const reconnect = source("src/shell/github-reconnect.ts");
    const deviceFlow = source("src/shell/github-device-flow.ts");
    const setup = source("ui/src/setup.tsx");
    const app = source("ui/src/app.tsx");
    const deviceFlowUi = source("ui/src/github-device-flow.tsx");

    for (const [path, content] of production.filter(([path]) =>
      path.startsWith("src/core/") || path.startsWith("src/persistence/"),
    )) {
      expect(content, path).not.toMatch(
        /from\s+["'][^"']*(?:\/github|github-)[^"']*["']/,
      );
    }

    expect(sync.toLowerCase()).not.toContain("github");
    expect(sync).not.toContain("client_id");
    expect(sync).not.toContain("secret-tool");
    expect(sync).not.toContain("GIT_ASKPASS");
    expect(sync).not.toContain("JIG_GITHUB_ACCESS_TOKEN");
    expect(sync).not.toContain("get_network_environment");
    expect(sync).not.toContain("SyncAuthenticationError");

    expect(protocol.toLowerCase()).not.toContain("github");
    expect(http.toLowerCase()).not.toContain("github");
    expect(http).not.toContain("/api/v1/github/");

    expect(main).not.toContain("loadCurrentGitHubCredential");
    expect(main).not.toContain("refreshGitHubCredential");
    expect(main).not.toContain("githubGitEnvironment");
    expect(main).not.toContain("GIT_ASKPASS");
    expect(main).not.toContain(
      "assertManagedGitHubSynchronizationRemote",
    );

    expect(onboarding).toContain("GitHubDeviceFlowSession");
    expect(onboarding).not.toContain("startGitHubDeviceAuthorization");
    expect(onboarding).not.toContain("pollGitHubDeviceAuthorization");

    expect(reconnect).toContain("GitHubDeviceFlowSession");
    expect(reconnect).not.toContain("config_path");
    expect(reconnect).not.toContain("http_port");
    expect(reconnect).not.toContain("acquire");
    expect(reconnect).not.toContain("repository");

    expect(deviceFlow).toContain("startGitHubDeviceAuthorization");
    expect(deviceFlow).toContain("pollGitHubDeviceAuthorization");
    expect(deviceFlow).not.toContain("repository");

    expect(setup).not.toContain("retry_after_seconds");
    expect(app).not.toContain("retry_after_seconds");
    expect(deviceFlowUi).toContain("retry_after_seconds");

    const githubContractOwners = production.filter(([, content]) =>
      /export interface GitHubAuthorizationSnapshot\b/.test(content),
    );
    expect(githubContractOwners.map(([path]) => path)).toEqual([
      "src/github.ts",
    ]);
  });

  it("keeps portable records platform-neutral and Android Git provider-neutral", () => {
    const portable = source("src/portable.ts");
    const desktopGit = source("src/shell/git.ts");
    const nativeGit = source("ui/src/native/git.ts");
    const nativeHttp = source("ui/src/native/git-http.ts");
    const nativeFilesystem = source(
      "ui/src/native/git-filesystem.ts",
    );

    expect(portable).not.toMatch(
      /node:|bun:sqlite|Bun\.|@capacitor|isomorphic-git|github/i,
    );
    expect(portable).toContain(
      "export const PORTABLE_FORMAT_VERSION = 2",
    );
    expect(desktopGit).toContain('from "../portable"');
    expect(desktopGit).not.toContain(
      "export const PORTABLE_FORMAT_VERSION",
    );

    expect(nativeGit.toLowerCase()).not.toContain("github");
    expect(nativeGit).not.toContain("client_id");
    expect(nativeGit).not.toContain("device flow");
    expect(nativeGit).toContain("onAuth: authCallback(credential)");
    expect(nativeGit).not.toMatch(
      /https?:\/\/[^"']*(?:token|password|secret)@/i,
    );
    expect(nativeGit).toContain(
      'export const ANDROID_DATA_BRANCH = "jig-data"',
    );

    expect(nativeHttp).toContain(
      'registerPlugin<NativeHttpPort>("JigGitHttp")',
    );
    expect(nativeHttp).not.toContain("CapacitorHttp");
    expect(nativeHttp).not.toContain("responseType");
    expect(nativeHttp).not.toContain("fetch(");
    expect(nativeHttp).not.toContain("corsProxy");

    expect(nativeFilesystem).toContain("Directory.Data");
    expect(nativeFilesystem).toContain("readlink");
    expect(nativeFilesystem).toContain("symlink");
    expect(nativeFilesystem).not.toContain("Task");
    expect(nativeFilesystem.toLowerCase()).not.toContain("github");
  });

  it("keeps the configured UI runtime boundary provider-neutral and singular", () => {
    const runtime = source("ui/src/runtime.ts");
    const app = source("ui/src/app.tsx");

    for (const operation of [
      "readCanonicalTasks",
      "readStatus",
      "readDiagnostics",
      "submitTaskCommand",
      "triggerSync",
    ]) {
      expect(runtime, operation).toContain(operation);
      expect(app, operation).toMatch(
        new RegExp(`\\b${operation}\\b`),
      );
    }

    expect(runtime).not.toMatch(/github|client_id|device[_ -]?flow/i);
    expect(runtime).not.toContain("../src/shell/");
    expect(app).toContain('from "./runtime"');
    expect(app).not.toMatch(
      /import\s*\{[^}]*readCanonicalTasks[^}]*\}\s*from\s*["']\.\/http["']/s,
    );
  });

  it("keeps Android SQLite native code as a low-level driver only", () => {
    const nativeAdapter = source("ui/src/native/jig-sqlite.ts");
    const nativeRuntime = source("ui/src/runtime-native.ts");
    const java = source(
      "android/app/src/main/java/com/pontivus/jig/JigSqlitePlugin.java",
    );
    const gradle = source("android/app/build.gradle");

    expect(nativeAdapter).toContain(
      'from "../../../src/persistence/sqlite"',
    );
    expect(nativeRuntime).toContain("applyTaskCommand");
    expect(nativeRuntime).toContain("rollForwardOutstandingInDatabase");
    expect(nativeRuntime).toContain("readCanonicalState");

    expect(java).toContain('@CapacitorPlugin(name = "JigSqlite")');
    expect(java).toContain("BundledSQLiteDriver");
    expect(java).toContain("SQLiteConnection");
    expect(java).toContain("SQLiteStatement");
    expect(java).not.toMatch(
      /\bTask\b|RecurrenceSeries|CREATE TABLE|schema_version|dataset_id/,
    );
    expect(java).not.toMatch(/RoomDatabase|androidx\.room/);
    const gitHttpJava = source(
      "android/app/src/main/java/com/pontivus/jig/JigGitHttpPlugin.java",
    );
    const gitTransportJava = source(
      "android/app/src/main/java/com/pontivus/jig/JigGitHttpTransport.java",
    );
    expect(gitHttpJava).toContain(
      '@CapacitorPlugin(name = "JigGitHttp")',
    );
    expect(gitHttpJava).toContain("HttpsURLConnection");
    expect(gitHttpJava).not.toMatch(
      /\bTask\b|RecurrenceSeries|github|client_id/i,
    );
    expect(gitTransportJava).toContain("HttpURLConnection");
    expect(gitTransportJava).not.toMatch(
      /\bTask\b|RecurrenceSeries|github|client_id/i,
    );
    expect(gradle).toContain(
      'implementation "androidx.sqlite:sqlite-bundled:$androidxSqliteVersion"',
    );
    expect(gradle).not.toContain("androidx.room");
  });

  it("keeps Android configured runtime provider-neutral", () => {
    const runtime = source("ui/src/runtime.ts");
    const native = source("ui/src/runtime-native.ts");

    expect(runtime).toContain("Capacitor.isNativePlatform()");
    expect(runtime).toContain('from "./runtime-native"');
    expect(native.toLowerCase()).not.toContain("github");
    expect(native).not.toContain("client_id");
    expect(native).not.toContain("TaskDTO");
    expect(native).not.toContain("ViewModel");

    for (const operation of [
      "readCanonicalTasks",
      "readStatus",
      "readDiagnostics",
      "submitTaskCommand",
      "triggerSync",
    ]) {
      expect(native, operation).toContain(operation);
    }
  });

  it("isolates justified third-party assertions to boundary adapters", () => {
    const ui = production.filter(([path]) => path.startsWith("ui/src/"));
    const assertions = ui.flatMap(([path, content]) =>
      content
        .split("\n")
        .map((line, index) => ({ path, line: index + 1, text: line.trim() }))
        .filter(
          ({ text }) =>
            !text.startsWith("//") &&
            /\sas\s+[A-Z][A-Za-z0-9_<>, |\[\]]+/.test(text),
        ),
    );

    expect(assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "ui/src/dates.ts",
          text: "return value as ISODateString;",
        }),
        expect.objectContaining({
          path: "ui/src/dates.ts",
          text: "return value as ISOTimeString;",
        }),
        expect.objectContaining({
          path: "ui/src/http.ts",
          text: "return value as Record<string, unknown>;",
        }),
        expect.objectContaining({
          path: "ui/src/http.ts",
          text: "? (payload as Record<string, unknown>)",
        }),
      ]),
    );
    expect(assertions).toHaveLength(4);
  });
});
