import {
  fetchJson,
  postJson,
} from "./http";

export interface SetupStatus {
  readonly mode: "bootstrap" | "configured";
  readonly local_repository_available: boolean;
  readonly github_available: boolean;
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!isObjectRecord(value)) {
    throw new TypeError("Jig setup service returned an invalid response");
  }
  return value;
}

export async function readSetupStatus(): Promise<SetupStatus> {
  const payload = asObject(await fetchJson("/api/v1/setup/status"));
  if (
    (payload.mode !== "bootstrap" && payload.mode !== "configured") ||
    typeof payload.local_repository_available !== "boolean" &&
      payload.mode === "bootstrap" ||
    typeof payload.github_available !== "boolean" &&
      payload.mode === "bootstrap"
  ) {
    throw new TypeError("Jig setup service returned invalid setup status");
  }

  return {
    mode: payload.mode,
    local_repository_available:
      payload.mode === "configured"
        ? true
        : payload.local_repository_available === true,
    github_available:
      payload.mode === "configured"
        ? true
        : payload.github_available === true,
  };
}

export async function configureLocalRepository(
  repositoryPath: string,
): Promise<string> {
  const payload = asObject(
    await postJson("/api/v1/setup/local-repository", {
      repository_path: repositoryPath,
    }),
  );
  if (
    payload.configured !== true ||
    typeof payload.repository_path !== "string"
  ) {
    throw new TypeError("Jig setup service returned invalid setup completion");
  }
  return payload.repository_path;
}

export async function startGitHubSetup(): Promise<void> {
  await postJson("/api/v1/setup/github/start", {});
}
