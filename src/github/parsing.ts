import type {
  GitHubAuthorizationPresentation,
  GitHubCapabilityStatus,
  GitHubOnboardingSnapshot,
  GitHubReconnectSnapshot,
  GitHubRepositoryChoice,
} from "./model";

function objectRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return Object.fromEntries(Object.entries(value));
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`GitHub integration field ${key} must be a string`);
  }
  return value;
}

function requiredPositiveInteger(
  object: Record<string, unknown>,
  key: string,
): number {
  const value = object[key];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new TypeError(
      `GitHub integration field ${key} must be a positive integer`,
    );
  }
  return value;
}

function nullableString(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value = object[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(
      `GitHub integration field ${key} must be a string or null`,
    );
  }
  return value;
}

function parseAuthorizationPresentation(
  value: unknown,
): GitHubAuthorizationPresentation | null {
  if (value === null) {
    return null;
  }
  const object = objectRecord(
    value,
    "GitHub authorization state must be an object or null",
  );
  if (object.mode !== "device") {
    throw new TypeError("GitHub authorization state is invalid");
  }
  return {
    mode: "device",
    verification_uri: requiredString(object, "verification_uri"),
    user_code: requiredString(object, "user_code"),
  };
}

function parseRepositoryChoice(value: unknown): GitHubRepositoryChoice {
  const repository = objectRecord(
    value,
    "GitHub repository choice is invalid",
  );
  return {
    id: requiredPositiveInteger(repository, "id"),
    owner: requiredString(repository, "owner"),
    name: requiredString(repository, "name"),
    clone_url: requiredString(repository, "clone_url"),
    installation_id: requiredPositiveInteger(
      repository,
      "installation_id",
    ),
    account_login: requiredString(repository, "account_login"),
    account_type: requiredString(repository, "account_type"),
  };
}

export function parseGitHubReconnectSnapshot(
  value: unknown,
): GitHubReconnectSnapshot {
  const object = objectRecord(
    value,
    "GitHub reconnect snapshot must be an object",
  );
  if (
    typeof object.available !== "boolean" ||
    (
      object.state !== "initial" &&
      object.state !== "connecting" &&
      object.state !== "attention"
    ) ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub reconnect snapshot is invalid");
  }
  return {
    available: object.available,
    state: object.state,
    authorization: parseAuthorizationPresentation(object.authorization),
    error: typeof object.error === "string" ? object.error : null,
  };
}

export function parseGitHubOnboardingSnapshot(
  value: unknown,
): GitHubOnboardingSnapshot {
  const object = objectRecord(
    value,
    "GitHub onboarding snapshot must be an object",
  );
  if (
    typeof object.available !== "boolean" ||
    (
      object.state !== "initial" &&
      object.state !== "connecting" &&
      object.state !== "repository-selection" &&
      object.state !== "attention"
    ) ||
    !Array.isArray(object.repositories) ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub onboarding snapshot is invalid");
  }

  return {
    available: object.available,
    state: object.state,
    authorization: parseAuthorizationPresentation(object.authorization),
    provider_url: nullableString(object, "provider_url"),
    repositories: object.repositories.map(parseRepositoryChoice),
    error: typeof object.error === "string" ? object.error : null,
  };
}

export function parseGitHubCapabilityStatus(
  value: unknown,
): GitHubCapabilityStatus {
  const object = objectRecord(
    value,
    "GitHub capability status must be an object",
  );
  if (
    typeof object.onboarding_available !== "boolean" ||
    typeof object.reconnect_available !== "boolean"
  ) {
    throw new TypeError("GitHub capability status is invalid");
  }
  return {
    onboarding_available: object.onboarding_available,
    reconnect_available: object.reconnect_available,
  };
}
