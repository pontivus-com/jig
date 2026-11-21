import type { AndroidGitEffects, GitCredentialProvider } from "./git";
import { androidSynchronizationRemote } from "./git";
import {
  AndroidGitHubReauthorizationRequiredError,
  androidGitHubCredentialNeedsReconnect,
  currentAndroidGitHubToken,
} from "./github-credential";

export class AndroidManagedGitHubTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AndroidManagedGitHubTransportError";
  }
}

let reconnectRequired = false;

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
  return Object.assign(
    async (): Promise<string> => {
      const remote = await androidSynchronizationRemote(effects);
      assertManagedGitHubRemote(remote.location);
      try {
        const token = await loadToken();
        reconnectRequired = false;
        return token;
      } catch (error) {
        if (error instanceof AndroidGitHubReauthorizationRequiredError) {
          reconnectRequired = true;
        }
        throw error;
      }
    },
    {
      onAuthFailure: (): void => {
        reconnectRequired = true;
      },
      onAuthSuccess: (): void => {
        reconnectRequired = false;
      },
    },
  );
}

export async function androidManagedGitHubReconnectRequired():
Promise<boolean> {
  if (reconnectRequired) {
    return true;
  }
  try {
    return await androidGitHubCredentialNeedsReconnect();
  } catch {
    return false;
  }
}
