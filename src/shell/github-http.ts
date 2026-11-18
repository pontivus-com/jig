import type { JigConfig } from "./config";
import type { GitHubOnboardingController } from "../github-onboarding";
import type { GitHubReconnectController } from "../github-reconnect";
import { InstallationError } from "./setup";
import {
  authorizeMutation,
  jsonResponse,
} from "./http-admission";

export interface GitHubHttpDependencies {
  readonly write_token: string;
  readonly onboarding?: GitHubOnboardingController<JigConfig>;
  readonly reconnect?: GitHubReconnectController;
  readonly is_configured: () => boolean;
  readonly on_configured?: (config: JigConfig) => void;
}

interface GitHubAcquireRequest {
  readonly repository_id: number;
}

async function parseGitHubAcquireRequest(
  request: Request,
): Promise<GitHubAcquireRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new InstallationError(
      "State-changing setup requests require Content-Type application/json",
    );
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new InstallationError("Setup request body must be valid JSON");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InstallationError("GitHub acquisition request must be an object");
  }
  const object: Record<string, unknown> = Object.fromEntries(
    Object.entries(value),
  );
  if (
    Object.keys(object).length !== 1 ||
    typeof object.repository_id !== "number" ||
    !Number.isInteger(object.repository_id) ||
    object.repository_id <= 0
  ) {
    throw new InstallationError(
      "GitHub acquisition requires exactly a positive repository_id",
    );
  }
  return { repository_id: object.repository_id };
}

export function createGitHubHttpHandler(
  dependencies: GitHubHttpDependencies,
): (request: Request) => Promise<Response | null> {
  return async (request: Request): Promise<Response | null> => {
    const pathname = new URL(request.url).pathname;

    if (
      request.method === "GET" &&
      pathname === "/api/v1/github/status"
    ) {
      return jsonResponse({
        onboarding_available:
          dependencies.onboarding?.snapshot().available === true,
        reconnect_available:
          dependencies.reconnect?.available() === true,
      });
    }

    if (
      request.method === "GET" &&
      pathname === "/api/v1/setup/github/repositories"
    ) {
      const onboarding = dependencies.onboarding;
      if (onboarding === undefined || !onboarding.snapshot().available) {
        return jsonResponse({ error: "Connect GitHub is unavailable" }, 503);
      }
      return jsonResponse(onboarding.snapshot());
    }

    if (
      request.method === "POST" &&
      [
        "/api/v1/setup/github/start",
        "/api/v1/setup/github/refresh-access",
        "/api/v1/setup/github/acquire",
      ].includes(pathname)
    ) {
      const unauthorized = authorizeMutation(
        request,
        dependencies.write_token,
      );
      if (unauthorized !== null) {
        return unauthorized;
      }
      if (dependencies.is_configured()) {
        return jsonResponse({ error: "Jig setup is already complete" }, 409);
      }

      const onboarding = dependencies.onboarding;
      if (onboarding === undefined || !onboarding.snapshot().available) {
        return jsonResponse({ error: "Connect GitHub is unavailable" }, 503);
      }

      try {
        if (pathname === "/api/v1/setup/github/start") {
          return jsonResponse(await onboarding.start());
        }
        if (pathname === "/api/v1/setup/github/refresh-access") {
          return jsonResponse(await onboarding.refreshAccess());
        }

        const body = await parseGitHubAcquireRequest(request);
        const config = await onboarding.acquire(body.repository_id);
        if (dependencies.on_configured === undefined) {
          return jsonResponse(
            { error: "GitHub setup completion is unavailable" },
            409,
          );
        }
        dependencies.on_configured(config);
        return jsonResponse({
          configured: true,
          repository_path: config.repository_path,
        });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "GitHub setup failed",
          },
          400,
        );
      }
    }

    if (
      request.method === "POST" &&
      [
        "/api/v1/github/reconnect/start",
        "/api/v1/github/reconnect/refresh",
      ].includes(pathname)
    ) {
      const unauthorized = authorizeMutation(
        request,
        dependencies.write_token,
      );
      if (unauthorized !== null) {
        return unauthorized;
      }

      const reconnect = dependencies.reconnect;
      if (reconnect === undefined || !reconnect.available()) {
        return jsonResponse(
          { error: "GitHub reconnect is unavailable for this repository" },
          409,
        );
      }

      try {
        return jsonResponse(
          pathname.endsWith("/start")
            ? await reconnect.start()
            : await reconnect.refresh(),
        );
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "GitHub reconnect failed",
          },
          400,
        );
      }
    }

    return null;
  };
}
