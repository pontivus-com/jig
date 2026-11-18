import {
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import type { GitHubCredential } from "../../src/github";
import {
  createGitHubAskpassHelper,
} from "../../src/shell/github-git-auth";
import {
  assertManagedGitHubSynchronizationRemote,
  createManagedGitHubTransport,
  isManagedGitHubRepositoryPath,
} from "../../src/shell/github-transport";
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

describe("managed GitHub transport", () => {
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

  it("requires the synchronization remote to remain the selected HTTPS GitHub repository", async () => {
    const home = await mkdtemp(join(tmpdir(), "jig-managed-home-"));
    roots.push(home);
    const path = join(
      home,
      ".local",
      "share",
      "jig-data",
      "repositories",
      "github",
      "example",
      "planning",
    );
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

  it("bypasses provider-neutral repositories entirely", async () => {
    await expect(
      createManagedGitHubTransport(
        "/home/example/projects/planning",
        {
          registration: {
            app_slug: "jig-desktop-mobile",
            client_id: "shared-client-id",
          },
        },
      ),
    ).resolves.toBeNull();
  });

  it("refreshes the credential inside the transport before network Git", async () => {
    const home = await mkdtemp(join(tmpdir(), "jig-managed-home-"));
    roots.push(home);
    const path = join(
      home,
      ".local",
      "share",
      "jig-data",
      "repositories",
      "github",
      "example",
      "planning",
    );
    await mkdir(path, { recursive: true });
    await git(path, ["init"]);
    await git(path, [
      "remote",
      "add",
      "origin",
      "https://github.com/example/planning.git",
    ]);

    const oldCredential: GitHubCredential = {
      user_id: 42,
      access_token: "old-token",
      refresh_token: "refresh-token",
      access_token_expires_at: "2030-01-01T00:02:00.000Z",
      refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
    };
    const newCredential: GitHubCredential = {
      ...oldCredential,
      access_token: "new-token",
      access_token_expires_at: "2030-01-01T08:00:00.000Z",
    };
    let stored: GitHubCredential | null = null;
    let environment: Readonly<Record<string, string>> | null = null;

    const transport = await createManagedGitHubTransport(
      path,
      {
        registration: {
          app_slug: "jig-desktop-mobile",
          client_id: "shared-client-id",
        },
        load_credential: async () => oldCredential,
        refresh_credential: async () => newCredential,
        store_credential: async (credential) => {
          stored = credential;
        },
        synchronize: async (_config, nextEnvironment) => {
          environment = nextEnvironment;
          return { status: "synchronized", retryable: false };
        },
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      },
    );
    if (transport === null) {
      throw new Error("Expected managed GitHub transport");
    }

    try {
      await expect(
        transport.synchronize({ repository_path: path }),
      ).resolves.toStrictEqual({
        status: "synchronized",
        retryable: false,
      });
      expect(stored).toStrictEqual(newCredential);
      expect(environment).toMatchObject({
        GIT_TERMINAL_PROMPT: "0",
        JIG_GITHUB_ACCESS_TOKEN: "new-token",
      });
    } finally {
      await transport.dispose();
    }
  });
});
