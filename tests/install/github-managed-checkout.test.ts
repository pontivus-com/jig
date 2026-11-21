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
