import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { createBootstrapHttpHandler } from "../../src/shell/bootstrap-http";
import { runGit } from "../../src/shell/git/process";
import type { JigConfig } from "../../src/shell/config";

const roots: string[] = [];

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

async function repository(root: string): Promise<string> {
  const repo = join(root, "repo");
  await mkdir(repo);
  await git(repo, ["init"]);
  await git(repo, ["config", "user.name", "Bootstrap"]);
  await git(repo, ["config", "user.email", "bootstrap@local.invalid"]);
  await writeFile(join(repo, "user.txt"), "keep\n", "utf8");
  await git(repo, ["add", "user.txt"]);
  await git(repo, ["commit", "-m", "baseline"]);
  return repo;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("bootstrap HTTP mode", () => {
  it("admits only setup operations and transitions after canonical local setup", async () => {
    const root = await mkdtemp(join(tmpdir(), "jig-bootstrap-http-"));
    roots.push(root);
    const repo = await repository(root);
    const ui = join(root, "dist");
    await mkdir(ui);
    await writeFile(join(ui, "index.html"), "<head></head><body>Jig</body>");

    let configured: JigConfig | null = null;
    let configuredState = false;
    const handler = createBootstrapHttpHandler({
      write_token: "a".repeat(64),
      ui_directory: ui,
      config_path: join(root, "config.json"),
      http_port: 47831,
      is_configured: () => configuredState,
      on_configured: (config) => {
        configured = config;
        configuredState = true;
      },
    });

    const status = await handler(
      new Request("http://127.0.0.1:47831/api/v1/setup/status"),
    );
    expect(await status.json()).toMatchObject({
      mode: "bootstrap",
      local_repository_available: true,
    });

    const tasks = await handler(
      new Request("http://127.0.0.1:47831/api/v1/tasks"),
    );
    expect(tasks.status).toBe(404);

    const rejected = await handler(
      new Request(
        "http://127.0.0.1:47831/api/v1/setup/local-repository",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ repository_path: repo }),
        },
      ),
    );
    expect(rejected.status).toBe(403);

    const accepted = await handler(
      new Request(
        "http://127.0.0.1:47831/api/v1/setup/local-repository",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jig-write-token": "a".repeat(64),
          },
          body: JSON.stringify({ repository_path: repo }),
        },
      ),
    );
    expect(accepted.status).toBe(200);
    expect(configured).toStrictEqual({
      version: 1,
      repository_path: repo,
      http_port: 47831,
    });

    const after = await handler(
      new Request("http://127.0.0.1:47831/api/v1/setup/status"),
    );
    expect(await after.json()).toMatchObject({ mode: "configured" });
  });
});
