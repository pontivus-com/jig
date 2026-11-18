import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import type { Task } from "../../src/core/task";
import {
  serializeSnapshot,
  writeSnapshotToWorktree,
  type PortableSnapshot,
} from "../../src/shell/git";
import {
  writeConfigAtomic,
  loadConfig,
} from "../../src/shell/config";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function source(path: string): Promise<string> {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("V1 security and trust boundaries", () => {
  it("binds the service only to IPv4 loopback and never enables CORS", async () => {
    const main = await source("src/shell/main.ts");
    const http = await source("src/shell/http.ts");

    expect(main).toContain('hostname: "127.0.0.1"');
    expect(main).not.toMatch(/hostname:\s*["'](?:0\.0\.0\.0|::)["']/);
    expect(http.toLowerCase()).not.toContain("access-control-allow-origin");
    expect(http.toLowerCase()).not.toContain("cors");
  });

  it("keeps Git invocation argument-array based and out of a shell", async () => {
    const git = await source("src/shell/git.ts");

    expect(git).toContain("Bun.spawn({");
    expect(git).toContain('cmd: ["git", ...args]');
    expect(git).not.toContain("Bun.$");
    expect(git).not.toMatch(/shell\s*:\s*true/);
    expect(git).not.toMatch(/exec(?:File)?Sync?\s*\(/);
  });

  it("keeps the per-start write token out of durable SQLite, Git and configuration owners", async () => {
    for (const path of [
      "src/shell/sqlite.ts",
      "src/shell/git.ts",
      "src/shell/config.ts",
      "src/shell/setup.ts",
    ]) {
      const contents = await source(path);
      expect(contents).not.toContain("write_token");
      expect(contents).not.toContain("__JIG_WRITE_TOKEN__");
    }

    const root = await mkdtemp(join(tmpdir(), "jig-security-config-"));
    roots.push(root);
    const configPath = join(root, "config.json");
    await writeConfigAtomic(
      {
        version: 1,
        repository_path: root,
        http_port: 47831,
      },
      configPath,
    );

    expect(await loadConfig(configPath)).toStrictEqual({
      version: 1,
      repository_path: root,
      http_port: 47831,
    });
    expect(await readFile(configPath, "utf8")).not.toContain(
      "write_token",
    );
  });

  it("contains every portable snapshot path inside the isolated worktree", async () => {
    const root = await mkdtemp(join(tmpdir(), "jig-security-path-"));
    roots.push(root);
    const worktree = join(root, "worktree");
    const escaped = join(root, "escaped.json");

    const malicious: PortableSnapshot = {
      dataset_id:
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
      tasks: [],
      files: new Map([
        [
          "format.json",
          '{"version":1,"dataset_id":"018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001"}\n',
        ],
        ["../escaped.json", "{}\n"],
      ]),
    };

    await expect(
      writeSnapshotToWorktree(worktree, malicious),
    ).rejects.toThrow(/escapes the Jig worktree/);
    await expect(
      readFile(escaped, "utf8"),
    ).rejects.toThrow();
  });

  it("serializes only canonical Task data and never credentials or local paths", () => {
    const task: Task = {
      id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
      title: "Sensitive customer task",
      scheduled_date: "2026-11-16",
      position: 0,
      priority: "NORMAL",
      context: "Customer",
      reference: "https://example.com/matter",
      note: "Private note",
      reminder_time: null,
      completed_at: null,
      created_at: "2026-11-16T01:00:00.000Z",
      updated_at: "2026-11-16T01:00:00.000Z",
    };
    const snapshot = serializeSnapshot(
      [task],
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
    );
    const portable = [...snapshot.files.values()].join("\n");

    expect(portable).toContain("Sensitive customer task");
    expect(portable).not.toMatch(
      /(?:password|credential|private_key|access_token|write_token)/i,
    );
    expect(portable).not.toContain(process.cwd());
  });

  it("keeps GitHub Device Flow registration secretless and redirect-free", async () => {
    const registration = await source("src/shell/github-registration.ts");
    const auth = await source("src/shell/github-auth.ts");
    const secretService = await source("src/shell/secret-service.ts");

    expect(registration).toContain("GITHUB_DESKTOP_APP_REGISTRATION");
    expect(registration).toContain("GITHUB_ANDROID_APP_REGISTRATION");
    expect(registration).toContain("client_id:");
    expect(registration).toContain("app_slug:");
    expect(registration).not.toMatch(/client_secret\s*:/);
    expect(registration).not.toMatch(/redirect_uri\s*:/);
    expect(auth).not.toContain("readonly client_secret");
    expect(auth).not.toContain("readonly redirect_uri");
    expect(auth).not.toContain("code_verifier");
    expect(auth).not.toContain("code_challenge");
    expect(auth).toContain("https://github.com/login/device/code");
    expect(auth).toContain("urn:ietf:params:oauth:grant-type:device_code");
    expect(secretService).not.toContain("client_secret");
    expect(registration).not.toContain("access_token");
    expect(registration).not.toContain("refresh_token");
    expect(registration).not.toContain("private_key");
  });

  it("does not execute Task references or import source content in the row owner", async () => {
    const row = await source("ui/src/task-row.tsx");

    expect(row).toContain('url.protocol === "http:"');
    expect(row).toContain('url.protocol === "https:"');
    expect(row).toContain("navigator.clipboard.writeText");
    expect(row).not.toContain("Bun.");
    expect(row).not.toContain("child_process");
    expect(row).not.toMatch(/fetch\s*\(\s*task\.reference/);
  });

  it("has no ordinary Task-content logger in core, persistence, HTTP, Git or sync owners", async () => {
    for (const path of [
      "src/core/task.ts",
      "src/core/planning.ts",
      "src/shell/sqlite.ts",
      "src/shell/http.ts",
      "src/shell/git.ts",
      "src/shell/sync.ts",
    ]) {
      const contents = await source(path);
      expect(contents).not.toMatch(/console\.(?:log|info|warn|error)/);
    }
  });
});
