import { registerPlugin } from "@capacitor/core";
import type { GitHubCredential } from "../../../src/github";

export interface SecureCredentialsPort {
  readonly store: (options: {
    readonly credential: GitHubCredential;
  }) => Promise<void>;
  readonly load: () => Promise<{
    readonly credential: unknown;
  }>;
  readonly delete: () => Promise<void>;
}

const nativeSecureCredentials =
  registerPlugin<SecureCredentialsPort>(
    "JigSecureCredentials",
  );

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function nullableString(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value = object[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(
      `Stored GitHub credential has invalid ${key}`,
    );
  }
  return value;
}

export function parseStoredGitHubCredential(
  value: unknown,
): GitHubCredential {
  const object = recordValue(value);
  if (object === null) {
    throw new Error("Stored GitHub credential is invalid");
  }

  const userId = object.user_id;
  const accessToken = object.access_token;
  if (
    typeof userId !== "number" ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    typeof accessToken !== "string" ||
    accessToken.length === 0
  ) {
    throw new Error("Stored GitHub credential is invalid");
  }

  return {
    user_id: userId,
    access_token: accessToken,
    refresh_token: nullableString(object, "refresh_token"),
    access_token_expires_at: nullableString(
      object,
      "access_token_expires_at",
    ),
    refresh_token_expires_at: nullableString(
      object,
      "refresh_token_expires_at",
    ),
  };
}

export async function storeAndroidGitHubCredential(
  credential: GitHubCredential,
  port: SecureCredentialsPort = nativeSecureCredentials,
): Promise<void> {
  await port.store({ credential });
}

export async function loadAndroidGitHubCredential(
  port: SecureCredentialsPort = nativeSecureCredentials,
): Promise<GitHubCredential | null> {
  const result = await port.load();
  return result.credential === null
    ? null
    : parseStoredGitHubCredential(result.credential);
}

export async function deleteAndroidGitHubCredential(
  port: SecureCredentialsPort = nativeSecureCredentials,
): Promise<void> {
  await port.delete();
}

export async function assertAndroidCredentialStore(
  port: SecureCredentialsPort = nativeSecureCredentials,
): Promise<void> {
  await port.load();
}
