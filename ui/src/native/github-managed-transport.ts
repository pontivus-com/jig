import type { AndroidGitEffects, GitCredentialProvider } from "./git";
import { androidSynchronizationRemote } from "./git";
import { currentAndroidGitHubToken } from "./github-credential";

export class AndroidManagedGitHubTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AndroidManagedGitHubTransportError";
  }
}

function assertManagedGitHubRemote(location: string): void {
  let remote: URL;
  try {
    remote = new URL(location);
  } catch {
    throw new AndroidManagedGitHubTransportError(
      "Managed GitHub remote is not a valid URL",
    );
  }

  const path = remote.pathname.replace(/\.git$/, "");
  const segments = path.split("/").filter(Boolean);
  if (
    remote.protocol !== "https:" ||
    remote.hostname.toLowerCase() !== "github.com" ||
    remote.port !== "" ||
    remote.username !== "" ||
    remote.password !== "" ||
    remote.search !== "" ||
    remote.hash !== "" ||
    segments.length !== 2
  ) {
    throw new AndroidManagedGitHubTransportError(
      "Managed GitHub remote no longer identifies one credential-free HTTPS github.com repository",
    );
  }
}

export function createAndroidManagedGitHubCredentialProvider(
  effects: AndroidGitEffects,
  loadToken: () => Promise<string> = currentAndroidGitHubToken,
): GitCredentialProvider {
  return async () => {
    const remote = await androidSynchronizationRemote(effects);
    assertManagedGitHubRemote(remote.location);
    return loadToken();
  };
}
