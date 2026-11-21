import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeRepositoryInstallation,
  validateSelectedRepository,
} from "../../src/shell/setup";
import { repositorySynchronizationMode, runGit } from "../../src/shell/git";

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
    expect(first.config).toStrictEqual({
      version: 1,
      repository_path: repo,
      http_port: 47831,
    });
  });

  it("accepts a repository without a remote as healthy local-only setup", async () => {
    const repo = await repository();
    const configPath = join(repo, "local-only-config.json");

    await expect(
      initializeRepositoryInstallation({
        repository_path: repo,
        http_port: 47831,
        config_path: configPath,
      }),
    ).resolves.toMatchObject({
      config: {
        repository_path: repo,
        http_port: 47831,
      },
    });

    await expect(
      repositorySynchronizationMode({ repository_path: repo }),
    ).resolves.toBe("local-only");
    expect(await git(repo, ["remote"])).toBe("");
  });

  it("keeps setup valid when an existing remote is unavailable", async () => {
    const repo = await repository();
    const configPath = join(repo, "unavailable-remote-config.json");
    const remoteUrl = "https://127.0.0.1:1/example/planning.git";
    await git(repo, ["remote", "add", "origin", remoteUrl]);

    const installed = await initializeRepositoryInstallation({
      repository_path: repo,
      http_port: 47831,
      config_path: configPath,
    });

    expect(installed.config.repository_path).toBe(repo);
    expect(await git(repo, ["remote", "get-url", "origin"])).toBe(remoteUrl);
    await expect(
      repositorySynchronizationMode({ repository_path: repo }),
    ).resolves.toBe("remote");
  });

  it("validates non-GitHub SSH remotes without rewriting provider topology", async () => {
    const repo = await repository();
    const remoteUrl = "git@gitlab.com:example/planning.git";
    await git(repo, ["remote", "add", "origin", remoteUrl]);
    await git(repo, ["config", "remote.pushDefault", "origin"]);

    await expect(validateSelectedRepository(repo)).resolves.toBe(repo);
    expect(await git(repo, ["remote", "get-url", "origin"])).toBe(remoteUrl);
    expect(await git(repo, ["config", "--get", "remote.pushDefault"])).toBe(
      "origin",
    );
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


});
