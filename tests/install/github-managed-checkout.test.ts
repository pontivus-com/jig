import {
  mkdir,
  mkdtemp,
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
import {
  acquireManagedGitHubRepository,
  assertManagedGitHubSynchronizationRemote,
  createGitHubAskpassHelper,
  isManagedGitHubRepositoryPath,
  managedGitHubRepositoryPath,
} from "../../src/shell/github-managed-checkout";
import { runGit } from "../../src/shell/git";

const roots: string[] = [];

async function git(cwd: string, args: readonly string[]): Promise<void> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("managed GitHub checkout", () => {
  it("uses the deterministic Jig-owned Linux data path", () => {
    expect(
      managedGitHubRepositoryPath(
        { id: 1, owner: "pontivus-com", name: "planning" },
        "/home/example",
      ),
    ).toBe(
      "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
    );
  });

  it("recognizes only the exact Jig-managed GitHub checkout shape", () => {
    const home = "/home/example";
    expect(
      isManagedGitHubRepositoryPath(
        "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
        home,
      ),
    ).toBe(true);
    expect(
      isManagedGitHubRepositoryPath(
        "/home/example/projects/planning",
        home,
      ),
    ).toBe(false);
    expect(
      isManagedGitHubRepositoryPath(
        "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning/nested",
        home,
      ),
    ).toBe(false);
  });

  it("requires the managed synchronization remote to remain the selected HTTPS GitHub repository", async () => {
    const home = await mkdtemp(join(tmpdir(), "jig-managed-home-"));
    roots.push(home);
    const selection = {
      id: 44,
      owner: "example",
      name: "planning",
    } as const;
    const path = managedGitHubRepositoryPath(selection, home);
    await mkdir(path, { recursive: true });
    await git(path, ["init"]);
    await git(path, [
      "remote",
      "add",
      "origin",
      "https://github.com/example/planning.git",
    ]);

    await expect(
      assertManagedGitHubSynchronizationRemote(path, home),
    ).resolves.toBeUndefined();

    await git(path, [
      "remote",
      "set-url",
      "origin",
      "https://github.com/example/other.git",
    ]);
    await expect(
      assertManagedGitHubSynchronizationRemote(path, home),
    ).rejects.toThrow(/no longer matches/);

    await git(path, [
      "remote",
      "set-url",
      "origin",
      "https://example.invalid/example/planning.git",
    ]);
    await expect(
      assertManagedGitHubSynchronizationRemote(path, home),
    ).rejects.toThrow(/no longer matches/);
  });

  it("askpass returns the token only for github.com HTTPS prompts", async () => {
    const helper = await createGitHubAskpassHelper();
    try {
      const run = async (prompt: string) => {
        const child = Bun.spawn({
          cmd: [helper.path, prompt],
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            JIG_GITHUB_ACCESS_TOKEN: "device-token",
          },
        });
        const [exitCode, stdout] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
        ]);
        return { exitCode, stdout: stdout.trim() };
      };

      await expect(
        run("Password for 'https://x-access-token@github.com/example/planning.git':"),
      ).resolves.toStrictEqual({
        exitCode: 0,
        stdout: "device-token",
      });
      expect(
        (
          await run(
            "Password for 'https://x-access-token@example.invalid/example/planning.git':",
          )
        ).exitCode,
      ).not.toBe(0);
    } finally {
      await helper.dispose();
    }
  });

  it("reuses an existing checkout only when its remote matches the selected repository", async () => {
    const home = await mkdtemp(join(tmpdir(), "jig-managed-home-"));
    roots.push(home);
    const selection = {
      id: 42,
      owner: "example",
      name: "planning",
    } as const;
    const path = managedGitHubRepositoryPath(selection, home);
    await mkdir(path, { recursive: true });
    await git(path, ["init"]);
    await git(path, ["config", "user.name", "Fixture"]);
    await git(path, ["config", "user.email", "fixture@local.invalid"]);
    await writeFile(join(path, "user.txt"), "keep\n", "utf8");
    await git(path, ["add", "user.txt"]);
    await git(path, ["commit", "-m", "baseline"]);
    await git(path, [
      "remote",
      "add",
      "origin",
      "https://github.com/example/planning.git",
    ]);

    await expect(
      acquireManagedGitHubRepository(
        selection,
        { access_token: "unused-because-existing" },
        home,
      ),
    ).resolves.toBe(path);
  });

  it("refuses to overwrite a mismatching existing managed checkout", async () => {
    const home = await mkdtemp(join(tmpdir(), "jig-managed-home-"));
    roots.push(home);
    const selection = {
      id: 43,
      owner: "example",
      name: "planning",
    } as const;
    const path = managedGitHubRepositoryPath(selection, home);
    await mkdir(path, { recursive: true });
    await git(path, ["init"]);
    await git(path, ["config", "user.name", "Fixture"]);
    await git(path, ["config", "user.email", "fixture@local.invalid"]);
    await writeFile(join(path, "user.txt"), "keep\n", "utf8");
    await git(path, ["add", "user.txt"]);
    await git(path, ["commit", "-m", "baseline"]);
    await git(path, [
      "remote",
      "add",
      "origin",
      "https://github.com/example/other.git",
    ]);

    await expect(
      acquireManagedGitHubRepository(
        selection,
        { access_token: "unused-because-existing" },
        home,
      ),
    ).rejects.toThrow(/does not match the selected GitHub repository/);
  });
});
