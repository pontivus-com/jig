import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  initializeRepositoryInstallation,
  InstallationError,
  validateSelectedRepository,
} from "../../src/shell/setup";
import { runGit } from "../../src/shell/git/process";

const roots: string[] = [];

async function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

async function repository(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `jig-${name}-`));
  roots.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Jig Test"]);
  await git(root, ["config", "user.email", "jig@local.invalid"]);
  await writeFile(join(root, "user.txt"), "user content\n", "utf8");
  await git(root, ["add", "user.txt"]);
  await git(root, ["commit", "-m", "User content"]);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("installation repository boundary", () => {
  it("initializes and reinstalls idempotently without touching tracked user content", async () => {
    const data = await repository("existing");
    const configRoot = await mkdtemp(join(tmpdir(), "jig-config-"));
    roots.push(configRoot);
    const configPath = join(configRoot, "config.json");

    const before = await git(data, ["status", "--porcelain=v1"]);
    const first = await initializeRepositoryInstallation({
      repository_path: data,
      http_port: 47831,
      config_path: configPath,
    });
    const second = await initializeRepositoryInstallation({
      repository_path: data,
      http_port: 47831,
      config_path: configPath,
    });

    expect(second.dataset_id).toBe(first.dataset_id);
    expect(await git(data, ["status", "--porcelain=v1"])).toBe(before);
    expect(await readFile(join(data, "user.txt"), "utf8")).toBe(
      "user content\n",
    );
    expect(
      await readFile(resolve(data, ".git", "info", "exclude"), "utf8"),
    ).toContain("/.jig/");
  });

  it("supports a selected linked Git worktree using the common Git dir", async () => {
    const data = await repository("worktree-main");
    const linked = `${data}-linked`;
    roots.push(linked);
    await git(data, ["worktree", "add", linked, "-b", "planner-data-home"]);

    const configRoot = await mkdtemp(join(tmpdir(), "jig-config-"));
    roots.push(configRoot);
    const installed = await initializeRepositoryInstallation({
      repository_path: linked,
      http_port: 47832,
      config_path: join(configRoot, "config.json"),
    });

    expect(installed.config.repository_path).toBe(
      await validateSelectedRepository(linked),
    );
    expect(
      await readFile(resolve(data, ".git", "info", "exclude"), "utf8"),
    ).toContain("/.jig/");
    expect(await git(linked, ["status", "--porcelain=v1"])).toBe("");
  });

  it("reuses a compatible remote jig-data dataset on a second replica", async () => {
    const source = await repository("replica-source");
    const bare = await mkdtemp(join(tmpdir(), "jig-remote-"));
    roots.push(bare);
    await git(bare, ["init", "--bare"]);
    await git(source, ["remote", "add", "origin", bare]);
    await git(source, ["push", "-u", "origin", "HEAD:master"]);

    const sourceConfig = await mkdtemp(join(tmpdir(), "jig-source-config-"));
    roots.push(sourceConfig);
    const first = await initializeRepositoryInstallation({
      repository_path: source,
      http_port: 47833,
      config_path: join(sourceConfig, "config.json"),
    });
    await git(source, [
      "push",
      "origin",
      "refs/heads/jig-data:refs/heads/jig-data",
    ]);

    const replicaParent = await mkdtemp(join(tmpdir(), "jig-replica-parent-"));
    roots.push(replicaParent);
    const replica = join(replicaParent, "replica");
    await git(replicaParent, ["clone", bare, replica]);
    const replicaConfig = await mkdtemp(join(tmpdir(), "jig-replica-config-"));
    roots.push(replicaConfig);

    // The clone already contains the fetched Jig tracking snapshot. Installation
    // must adopt it even if transport is currently unavailable.
    await git(replica, [
      "remote",
      "set-url",
      "origin",
      join(replicaParent, "missing.git"),
    ]);

    const second = await initializeRepositoryInstallation({
      repository_path: replica,
      http_port: 47834,
      config_path: join(replicaConfig, "config.json"),
    });

    expect(second.dataset_id).toBe(first.dataset_id);
    expect(second.adopted_existing_snapshot).toBe(true);
  });

  it("refuses the public Jig source checkout as the planning-data repository", async () => {
    const source = await repository("source-refusal");
    await git(source, [
      "remote",
      "add",
      "upstream",
      "https://github.com/pontivus-com/jig.git",
    ]);

    await expect(
      validateSelectedRepository(source),
    ).rejects.toThrow(InstallationError);
  });
});
