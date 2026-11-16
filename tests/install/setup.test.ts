import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeRepositoryInstallation,
  InstallationError,
  validateSelectedRepository,
} from "../../src/shell/setup";
import { DATA_REF } from "../../src/shell/sqlite";
import { runGit } from "../../src/shell/git";

const roots: string[] = [];

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-install-"));
  roots.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Fixture"]);
  await git(root, ["config", "user.email", "fixture@local.invalid"]);
  await writeFile(join(root, "personal.txt"), "keep me\n", "utf8");
  await git(root, ["add", "personal.txt"]);
  await git(root, ["commit", "-m", "personal baseline"]);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("V1-21 repository installation", () => {
  it("initializes one dataset without changing personal branch content and reruns idempotently", async () => {
    const repo = await repository();
    const configPath = join(repo, "fixture-config.json");
    const beforeHead = await git(repo, ["rev-parse", "HEAD"]);
    const beforeContent = await readFile(join(repo, "personal.txt"), "utf8");

    const first = await initializeRepositoryInstallation({
      repository_path: repo,
      http_port: 47831,
      config_path: configPath,
    });
    const second = await initializeRepositoryInstallation({
      repository_path: repo,
      http_port: 47831,
      config_path: configPath,
    });

    expect(second.dataset_id).toBe(first.dataset_id);
    expect(await git(repo, ["rev-parse", "HEAD"])).toBe(beforeHead);
    expect(await readFile(join(repo, "personal.txt"), "utf8")).toBe(beforeContent);
    expect(await git(repo, ["show-ref", "--verify", "--hash", DATA_REF]))
      .toMatch(/^[0-9a-f]{40}$/);

    const format = JSON.parse(
      await readFile(resolve(repo, ".jig", "git", "format.json"), "utf8"),
    ) as { dataset_id: string; version: number };
    expect(format.dataset_id).toBe(first.dataset_id);
  });

  it("refuses the public Jig source checkout as a planning-data target", async () => {
    const repo = await repository();
    await git(repo, [
      "remote",
      "add",
      "origin",
      "https://github.com/pontivus-com/jig.git",
    ]);

    await expect(validateSelectedRepository(repo)).rejects.toThrow(
      /cannot be used as the planning-data repository/,
    );
  });

  it("refuses an incompatible pre-existing jig-data ref without replacing it", async () => {
    const repo = await repository();
    const emptyTree = await git(repo, ["mktree"]);
    const commit = await runGit(
      repo,
      ["commit-tree", emptyTree, "-m", "not Jig data"],
      undefined,
      {
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@local.invalid",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@local.invalid",
      },
    );
    expect(commit.exit_code).toBe(0);
    await git(repo, ["update-ref", DATA_REF, commit.stdout]);

    await expect(
      initializeRepositoryInstallation({
        repository_path: repo,
        http_port: 47831,
        config_path: join(repo, "fixture-config.json"),
      }),
    ).rejects.toBeInstanceOf(InstallationError);

    expect(await git(repo, ["rev-parse", DATA_REF])).toBe(commit.stdout);
    expect(await readFile(join(repo, "personal.txt"), "utf8")).toBe("keep me\n");
  });
});
