import { addRemote, init, setConfig } from "isomorphic-git";
import { describe, expect, it } from "vitest";
import {
  createAndroidManagedGitHubCredentialProvider,
} from "../../ui/src/native/github-managed-transport";
import {
  createAndroidGitFilesystem,
} from "../../ui/src/native/git-filesystem";
import type {
  AndroidGitEffects,
} from "../../ui/src/native/git";
import type {
  IsomorphicGitHttpClient,
} from "../../ui/src/native/git-http";
import { ANDROID_GIT_WORKTREE } from "../../ui/src/native/paths";
import { fakeFilesystem } from "./fake-filesystem";

function noNetwork(): IsomorphicGitHttpClient {
  return {
    async request() {
      throw new Error("Managed credential validation must not use network");
    },
  };
}

async function managedEffects(
  remoteUrl: string,
): Promise<AndroidGitEffects> {
  const { port } = fakeFilesystem();
  const fs = createAndroidGitFilesystem(port);
  await fs.promises.mkdir("repository");
  await fs.promises.mkdir("repository/.jig");
  await fs.promises.mkdir(ANDROID_GIT_WORKTREE);
  await init({
    fs,
    dir: ANDROID_GIT_WORKTREE,
    defaultBranch: "jig-data",
  });
  await addRemote({
    fs,
    dir: ANDROID_GIT_WORKTREE,
    remote: "origin",
    url: remoteUrl,
  });
  return {
    fs,
    http: noNetwork(),
    dir: ANDROID_GIT_WORKTREE,
  };
}

describe("Android managed GitHub credential boundary", () => {
  it("loads a credential only after the configured origin is a canonical GitHub repository", async () => {
    const effects = await managedEffects(
      "https://github.com/pontivus-com/jig.git",
    );
    let loads = 0;
    const provider = createAndroidManagedGitHubCredentialProvider(
      effects,
      async () => {
        loads += 1;
        return "fixture-token";
      },
    );

    await expect(provider()).resolves.toBe("fixture-token");
    expect(loads).toBe(1);
  });

  it("refuses a changed non-GitHub origin before credential lookup", async () => {
    const effects = await managedEffects(
      "https://github.com/pontivus-com/jig.git",
    );
    let loads = 0;
    const provider = createAndroidManagedGitHubCredentialProvider(
      effects,
      async () => {
        loads += 1;
        return "must-not-be-read";
      },
    );

    await setConfig({
      fs: effects.fs,
      dir: effects.dir,
      path: "remote.origin.url",
      value: "https://example.invalid/pontivus-com/jig.git",
    });

    await expect(provider()).rejects.toThrow(
      /no longer identifies one credential-free HTTPS github\.com repository/,
    );
    expect(loads).toBe(0);
  });

  it("refuses ambiguous GitHub URLs before credential lookup", async () => {
    for (const remoteUrl of [
      "https://github.com/pontivus-com/jig.git?token=leak",
      "https://github.com/pontivus-com/jig.git#fragment",
      "https://github.com/pontivus-com/jig/extra.git",
      "https://github.com:8443/pontivus-com/jig.git",
    ]) {
      const effects = await managedEffects(remoteUrl);
      let loads = 0;
      const provider = createAndroidManagedGitHubCredentialProvider(
        effects,
        async () => {
          loads += 1;
          return "must-not-be-read";
        },
      );
      await expect(provider()).rejects.toThrow();
      expect(loads).toBe(0);
    }
  });
});
