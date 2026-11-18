export interface GitHubCredential {
  readonly user_id: number;
  readonly access_token: string;
  readonly refresh_token: string | null;
  readonly access_token_expires_at: string | null;
  readonly refresh_token_expires_at: string | null;
}

export class SecretServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretServiceError";
  }
}

function validateCredential(value: unknown): GitHubCredential {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new SecretServiceError("Stored GitHub credential is not an object");
  }
  const object: Record<string, unknown> = Object.fromEntries(
    Object.entries(value),
  );
  const keys = [
    "access_token",
    "access_token_expires_at",
    "refresh_token",
    "refresh_token_expires_at",
    "user_id",
  ];
  const actualKeys = Object.keys(object).sort();
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key, index) => key !== keys[index])
  ) {
    throw new SecretServiceError(
      "Stored GitHub credential has unexpected fields",
    );
  }
  if (
    typeof object.user_id !== "number" ||
    !Number.isInteger(object.user_id) ||
    object.user_id <= 0 ||
    typeof object.access_token !== "string" ||
    object.access_token.length === 0 ||
    (object.refresh_token !== null &&
      typeof object.refresh_token !== "string") ||
    (object.access_token_expires_at !== null &&
      typeof object.access_token_expires_at !== "string") ||
    (object.refresh_token_expires_at !== null &&
      typeof object.refresh_token_expires_at !== "string")
  ) {
    throw new SecretServiceError("Stored GitHub credential is invalid");
  }

  return {
    user_id: object.user_id,
    access_token: object.access_token,
    refresh_token: object.refresh_token,
    access_token_expires_at: object.access_token_expires_at,
    refresh_token_expires_at: object.refresh_token_expires_at,
  };
}

async function runSecretTool(
  args: readonly string[],
  input?: string,
): Promise<{ readonly exit_code: number; readonly stdout: string; readonly stderr: string }> {
  const processHandle = Bun.spawn({
    cmd: ["secret-tool", ...args],
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  return {
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

export async function assertSecretServiceAvailable(): Promise<void> {
  const result = await runSecretTool(["--version"]).catch(() => null);
  if (result === null || result.exit_code !== 0) {
    throw new SecretServiceError(
      "Connect GitHub requires secret-tool and an available freedesktop Secret Service",
    );
  }
}

const BASE_ATTRIBUTES = [
  "application",
  "jig",
  "provider",
  "github",
] as const;

function attributes(userId: number): readonly string[] {
  return [
    ...BASE_ATTRIBUTES,
    "user_id",
    String(userId),
  ];
}

export async function storeGitHubCredential(
  credential: GitHubCredential,
): Promise<void> {
  const validated = validateCredential(credential);
  await assertSecretServiceAvailable();
  // Jig owns one active planning repository, so Linux owns one current
  // GitHub user credential. Clear any previous provider item before storing
  // the newly authorized or rotated credential.
  await runSecretTool(["clear", ...BASE_ATTRIBUTES]).catch(() => null);
  const result = await runSecretTool(
    [
      "store",
      "--label=Jig GitHub",
      ...attributes(validated.user_id),
    ],
    JSON.stringify(validated),
  );
  if (result.exit_code !== 0) {
    throw new SecretServiceError(
      result.stderr ||
        "Secure GitHub credential storage is unavailable or locked",
    );
  }
}

export async function loadCurrentGitHubCredential(): Promise<GitHubCredential | null> {
  await assertSecretServiceAvailable();
  const result = await runSecretTool(["lookup", ...BASE_ATTRIBUTES]);
  if (result.exit_code !== 0 || result.stdout.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new SecretServiceError("Stored GitHub credential is not valid JSON");
  }
  return validateCredential(parsed);
}

export async function loadGitHubCredential(
  userId: number,
): Promise<GitHubCredential | null> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new SecretServiceError("GitHub user id must be a positive integer");
  }
  await assertSecretServiceAvailable();
  const result = await runSecretTool(["lookup", ...attributes(userId)]);
  if (result.exit_code !== 0 || result.stdout.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new SecretServiceError("Stored GitHub credential is not valid JSON");
  }
  return validateCredential(parsed);
}

export async function clearGitHubCredential(
  userId: number,
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new SecretServiceError("GitHub user id must be a positive integer");
  }
  await assertSecretServiceAvailable();
  const result = await runSecretTool(["clear", ...attributes(userId)]);
  if (result.exit_code !== 0) {
    throw new SecretServiceError(
      result.stderr || "Unable to clear GitHub credential",
    );
  }
}
