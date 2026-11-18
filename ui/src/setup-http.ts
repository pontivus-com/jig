import {
  fetchJson,
  postJson,
} from "./http";


export type GitHubSetupPhase =
  | "idle"
  | "authorizing"
  | "repository-access"
  | "repository-selection"
  | "acquiring";

export interface GitHubSetupRepository {
  readonly id: number;
  readonly owner: string;
  readonly name: string;
  readonly clone_url: string;
  readonly installation_id: number;
  readonly account_login: string;
  readonly account_type: string;
}

export interface GitHubSetupSnapshot {
  readonly available: boolean;
  readonly phase: GitHubSetupPhase;
  readonly authorization:
    | {
        readonly mode: "device";
        readonly verification_uri: string;
        readonly user_code: string;
        readonly retry_after_seconds: number;
      }
    | null;
  readonly grant_access_url: string | null;
  readonly manage_access: readonly {
    readonly installation_id: number;
    readonly account_login: string;
    readonly manage_url: string;
  }[];
  readonly repositories: readonly GitHubSetupRepository[];
  readonly error: string | null;
}

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

function githubPhase(value: unknown): GitHubSetupPhase {
  switch (value) {
    case "idle":
    case "authorizing":
    case "repository-access":
    case "repository-selection":
    case "acquiring":
      return value;
    default:
      throw new TypeError("Jig setup service returned invalid GitHub phase");
  }
}


function asGitHubSetupSnapshot(value: unknown): GitHubSetupSnapshot {
  const payload = asObject(value);
  const phase = githubPhase(payload.phase);
  if (
    typeof payload.available !== "boolean" ||
    !Array.isArray(payload.repositories) ||
    (payload.grant_access_url !== null &&
      typeof payload.grant_access_url !== "string") ||
    (payload.error !== null && typeof payload.error !== "string")
  ) {
    throw new TypeError("Jig setup service returned invalid GitHub state");
  }

  if (!Array.isArray(payload.manage_access)) {
    throw new TypeError("Jig setup service returned invalid GitHub access state");
  }
  const manageAccess = payload.manage_access.map((entry) => {
    const access = asObject(entry);
    if (
      typeof access.installation_id !== "number" ||
      !Number.isInteger(access.installation_id) ||
      typeof access.account_login !== "string" ||
      typeof access.manage_url !== "string"
    ) {
      throw new TypeError("Jig setup service returned invalid GitHub access link");
    }
    return {
      installation_id: access.installation_id,
      account_login: access.account_login,
      manage_url: access.manage_url,
    };
  });

  const repositories = payload.repositories.map((entry) => {
    const repository = asObject(entry);
    if (
      typeof repository.id !== "number" ||
      !Number.isInteger(repository.id) ||
      typeof repository.owner !== "string" ||
      typeof repository.name !== "string" ||
      typeof repository.clone_url !== "string" ||
      typeof repository.installation_id !== "number" ||
      typeof repository.account_login !== "string" ||
      typeof repository.account_type !== "string"
    ) {
      throw new TypeError("Jig setup service returned invalid GitHub repository");
    }
    return {
      id: repository.id,
      owner: repository.owner,
      name: repository.name,
      clone_url: repository.clone_url,
      installation_id: repository.installation_id,
      account_login: repository.account_login,
      account_type: repository.account_type,
    };
  });

  let authorization: GitHubSetupSnapshot["authorization"] = null;
  if (payload.authorization !== null) {
    const auth = asObject(payload.authorization);
    if (
      auth.mode === "device" &&
      typeof auth.verification_uri === "string" &&
      typeof auth.user_code === "string" &&
      typeof auth.retry_after_seconds === "number"
    ) {
      authorization = {
        mode: "device",
        verification_uri: auth.verification_uri,
        user_code: auth.user_code,
        retry_after_seconds: auth.retry_after_seconds,
      };
    } else {
      throw new TypeError("Jig setup service returned invalid GitHub authorization");
    }
  }

  return {
    available: payload.available,
    phase,
    authorization,
    grant_access_url:
      typeof payload.grant_access_url === "string"
        ? payload.grant_access_url
        : null,
    manage_access: manageAccess,
    repositories,
    error: typeof payload.error === "string" ? payload.error : null,
  };
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

export async function startGitHubSetup(): Promise<GitHubSetupSnapshot> {
  return asGitHubSetupSnapshot(
    await postJson("/api/v1/setup/github/start", {}),
  );
}

export async function refreshGitHubSetup(): Promise<GitHubSetupSnapshot> {
  return asGitHubSetupSnapshot(
    await postJson("/api/v1/setup/github/refresh-access", {}),
  );
}

export async function readGitHubRepositories(): Promise<GitHubSetupSnapshot> {
  return asGitHubSetupSnapshot(
    await fetchJson("/api/v1/setup/github/repositories"),
  );
}

export async function acquireGitHubRepository(
  repositoryId: number,
): Promise<string> {
  const payload = asObject(
    await postJson("/api/v1/setup/github/acquire", {
      repository_id: repositoryId,
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
