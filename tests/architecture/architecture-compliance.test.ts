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
    const editor = source("ui/src/task-editor.tsx");
    const nativeRuntime = source("ui/src/runtime-native.ts");

    expect(recurrence).toContain("export type RecurrencePattern");
    expect(planning).toContain("setTaskRecurrence");
    expect(editor).toContain("type RecurrenceSeries");
    expect(editor).toContain("type RecurrenceSpec");
    expect(editor).toContain('label="Repeat"');
    expect(editor).not.toContain("Enable repeat");
    expect(editor).not.toContain("Save repeat");
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
    const auth = source("src/github-auth.ts");
    const onboarding = source("src/github-onboarding.ts");
    const reconnect = source("src/github-reconnect.ts");
    const deviceFlow = source("src/github-device-flow.ts");
    const setup = source("ui/src/setup.tsx");
    const app = source("ui/src/app.tsx");
    const deviceFlowUi = source("ui/src/github-device-flow.tsx");
    const githubHttp = source("src/shell/github-http.ts");
    const setupHttp = source("ui/src/setup-http.ts");

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

    expect(auth).not.toMatch(/node:|bun:|Bun\.|@capacitor/);
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
    expect(deviceFlow).toContain("runUntilSettled");
    expect(onboarding).toContain("runUntilSettled");
    expect(reconnect).toContain("runUntilSettled");
    expect(deviceFlow).not.toMatch(/node:|bun:|Bun\.|@capacitor/);
    expect(onboarding).not.toMatch(/node:|bun:|Bun\.|@capacitor|\.\/shell\//);
    expect(reconnect).not.toMatch(/node:|bun:|Bun\.|@capacitor/);
    expect(deviceFlow).not.toContain("repository");

    expect(setup).not.toContain("retry_after_seconds");
    expect(app).not.toContain("retry_after_seconds");
    expect(deviceFlowUi).not.toContain("retry_after_seconds");
    expect(deviceFlowUi).not.toContain("onRefresh");
    expect(setup).not.toContain("Refresh access");
    expect(setup).not.toContain("Grant repository access");
    expect(setup).not.toContain("Manage GitHub access");
    expect(setupHttp).not.toContain("refreshGitHubSetup");
    expect(setupHttp).not.toContain("acquireGitHubRepository");
    expect(githubHttp).not.toContain("/api/v1/setup/github/refresh-access");
    expect(githubHttp).not.toContain("/api/v1/setup/github/acquire");
    expect(githubHttp).toContain("/api/v1/setup/github/connect");
    expect(githubHttp).toContain("/api/v1/setup/github/state");
    expect(githubHttp).toContain("/api/v1/setup/github/select-repository");

    for (const ownerPath of [
      "src/github-auth.ts",
      "src/github-device-flow.ts",
      "src/github-onboarding.ts",
      "src/github-reconnect.ts",
      "src/github-registration.ts",
    ]) {
      expect(
        production.some(([path]) => path === ownerPath),
        ownerPath,
      ).toBe(true);
    }
    for (const obsoletePath of [
      "src/shell/github-auth.ts",
      "src/shell/github-device-flow.ts",
      "src/shell/github-onboarding.ts",
      "src/shell/github-reconnect.ts",
      "src/shell/github-registration.ts",
    ]) {
      expect(
        production.some(([path]) => path === obsoletePath),
        obsoletePath,
      ).toBe(false);
    }

    const githubContractOwners = production.filter(([, content]) =>
      /export interface GitHubAuthorizationSnapshot\b/.test(content),
    );
    expect(githubContractOwners.map(([path]) => path)).toEqual([
      "src/github.ts",
    ]);
  });

  it("reuses the shared GitHub protocol and orchestration owners on Android", () => {
    const androidSetup = source("ui/src/native/github-setup.ts");
    const registration = source("src/github-registration.ts");

    expect(androidSetup).toContain(
      'from "../../../src/github-device-flow"',
    );
    expect(androidSetup).toContain(
      'from "../../../src/github-onboarding"',
    );
    expect(androidSetup).toContain(
      'from "../../../src/github-reconnect"',
    );
    expect(androidSetup).toContain(
      'from "../../../src/github-registration"',
    );
    expect(androidSetup).toContain("new GitHubDeviceFlowSession");
    expect(androidSetup).toContain("new GitHubOnboardingController");
    expect(androidSetup).toContain("new GitHubReconnectController");
    expect(androidSetup).toContain("GITHUB_APP_REGISTRATION");
    expect(androidSetup).not.toContain(
      "GITHUB_ANDROID_APP_REGISTRATION",
    );
    expect(androidSetup).not.toContain(
      "GITHUB_DESKTOP_APP_REGISTRATION",
    );
    expect(androidSetup).not.toMatch(
      /interface\s+GitHubAuthorizationSnapshot\b|interface\s+GitHubDeviceAuthorization\b/,
    );
    expect(androidSetup).not.toContain("refreshAndroidGitHubSetup");
    expect(androidSetup).not.toContain("refreshAndroidGitHubReconnect");
    expect(androidSetup).not.toContain("acquireAndroidGitHubRepository");
    expect(androidSetup).toContain("resumeAndroidGitHubSetup");
    expect(androidSetup).toContain("resumeAndroidGitHubReconnect");

    expect(registration).toContain(
      'app_slug: "jig-desktop-mobile"',
    );
    expect(registration).toContain(
      'client_id: "Iv23liyCoLFStLGRXgUk"',
    );

    for (const [path, content] of production) {
      expect(content, path).not.toContain(
        "GITHUB_ANDROID_APP_REGISTRATION",
      );
      expect(content, path).not.toContain(
        "GITHUB_DESKTOP_APP_REGISTRATION",
      );
    }
  });

  it("keeps synchronization policy, canonical reconciliation and Git effects single-owner", () => {
    const policy = source("src/synchronization.ts");
    const reconciliation = source("src/core/reconciliation.ts");
    const desktopSync = source("src/shell/sync.ts");
    const desktopGit = source("src/shell/git.ts");
    const androidSync = source("ui/src/native/sync.ts");
    const androidGit = source("ui/src/native/git.ts");

    expect(policy).toContain("export function decideSynchronization");
    expect(policy).toContain("synchronizationRetryDelayMs");
    expect(policy).not.toMatch(
      /node:|bun:|Bun\.|@capacitor|isomorphic-git|github/i,
    );
    expect(policy).not.toContain("Task");
    expect(policy).not.toContain("RecurrenceSeries");

    expect(reconciliation).toContain(
      "export function reconcileCanonicalPlanning",
    );
    expect(reconciliation).toContain("assertRecurrenceState");
    expect(reconciliation).not.toMatch(
      /from\s+["'][^"']*(?:\/shell\/|\/ui\/|protocol)["']/,
    );
    expect(reconciliation).not.toMatch(
      /node:|bun:|Bun\.|@capacitor|isomorphic-git|github/i,
    );

    for (const sync of [desktopSync, androidSync]) {
      expect(sync).toContain("decideSynchronization");
      expect(sync).toContain("reconcileCanonicalPlanning");
    }
    expect(desktopSync).toContain(
      'from "../core/reconciliation"',
    );
    expect(androidSync).toContain(
      'from "../../../src/core/reconciliation"',
    );

    for (const git of [desktopGit, androidGit]) {
      expect(git).not.toContain("reconcileCanonicalPlanning");
      expect(git).not.toContain("mergeValue");
    }

    expect(desktopGit).not.toMatch(
      /["']push["'][\s\S]{0,250}(?:--force|-f\b|\+refs\/heads\/jig-data)/,
    );
    expect(desktopGit).not.toMatch(
      /["']pull["']|["']rebase["']/,
    );
    expect(desktopGit).toContain('"update-ref"');
    expect(desktopGit).toContain("60_000");

    expect(androidGit).not.toContain("forceWithLease");
    expect(androidGit).not.toContain("pushForce");
    expect(androidGit).not.toContain("rebase");
    expect(androidGit).toContain("fastForwardOnly: true");
    expect(androidGit).toContain("ANDROID_OBSERVED_REMOTE_REF");
    expect(androidGit).toContain("expectedHead");
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
    expect(nativeGit).toContain("...authenticationCallbacks(credential)");
    expect(nativeGit).toContain("onAuthFailure");
    expect(nativeGit).toContain("onAuthSuccess");
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

  it("keeps Android GitHub onboarding out of browser module evaluation", () => {
    const setupHttp = source("ui/src/setup-http.ts");

    expect(setupHttp).toContain("Capacitor.isNativePlatform()");
    expect(setupHttp).toContain('import("./native/github-setup")');
    expect(setupHttp).not.toMatch(
      /from\s+["']\.\/native\/github-setup["']/,
    );
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

    expect(runtime).toContain("Capacitor.isNativePlatform()");
    expect(runtime).toContain('import("./runtime-native")');
    expect(runtime).not.toMatch(
      /from\s+["']\.\/runtime-native["']/,
    );
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

  it("keeps Android GitHub credentials inside the governed Keystore boundary", () => {
    const activity = source(
      "android/app/src/main/java/com/pontivus/jig/MainActivity.java",
    );
    const plugin = source(
      "android/app/src/main/java/com/pontivus/jig/JigSecureCredentialsPlugin.java",
    );
    const manifest = source("android/app/src/main/AndroidManifest.xml");
    const adapter = source("ui/src/native/secure-credentials.ts");

    expect(activity).toContain(
      "registerPlugin(JigSecureCredentialsPlugin.class)",
    );
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    const dataExtractionRules = source(
      "android/app/src/main/res/xml/data_extraction_rules.xml",
    );
    const backupRules = source(
      "android/app/src/main/res/xml/backup_rules.xml",
    );
    for (const rules of [dataExtractionRules, backupRules]) {
      expect(rules).toContain("jig_secure_credentials_v1.xml");
      expect(rules).toContain("jig_notification_registry_v1.xml");
    }
    expect(plugin).toContain(
      '"com.pontivus.jig.github.credentials.v1"',
    );
    expect(plugin).toContain('"AndroidKeyStore"');
    expect(plugin).toContain('"AES/GCM/NoPadding"');
    expect(plugin).toContain(".setKeySize(256)");
    expect(plugin).toContain(
      "KeyProperties.ENCRYPTION_PADDING_NONE",
    );
    expect(plugin).toContain("Context.MODE_PRIVATE");
    expect(plugin).toContain('putString(\n                    CIPHERTEXT');
    expect(plugin).toContain('putString(\n                    IV');
    expect(plugin).not.toContain("client_secret");
    expect(plugin).not.toContain("redirect_uri");
    expect(adapter).toMatch(
      /import type \{ GitHubCredential \} from/,
    );
    expect(adapter).not.toContain("JigConfig");
    expect(adapter).not.toContain("Task");
  });

  it("keeps Android configured runtime provider-neutral", () => {
    const runtime = source("ui/src/runtime.ts");
    const native = source("ui/src/runtime-native.ts");

    expect(runtime).toContain("Capacitor.isNativePlatform()");
    expect(runtime).toContain('import("./runtime-native")');
    expect(runtime).not.toMatch(
      /from\s+["']\.\/runtime-native["']/,
    );
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


describe("v1.1 Android managed GitHub transport ownership", () => {
  it("keeps credential lookup behind the managed remote-validation shell", () => {
    const configured = source("ui/src/native/configured-sync.ts");
    const managed = source("ui/src/native/github-managed-transport.ts");
    expect(configured).toContain(
      "createAndroidManagedGitHubCredentialProvider",
    );
    expect(configured).not.toContain("currentAndroidGitHubToken");
    expect(managed).toContain("androidSynchronizationRemote");
    expect(managed).toContain("currentAndroidGitHubToken");
    expect(managed.indexOf("androidSynchronizationRemote")).toBeLessThan(
      managed.lastIndexOf("currentAndroidGitHubToken"),
    );
  });
});
