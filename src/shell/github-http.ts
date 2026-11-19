import type { GitHubOnboardingController } from "../github-onboarding";
import type { GitHubReconnectController } from "../github-reconnect";
import type { JigConfig } from "./config";
import { InstallationError } from "./setup";
import {
  authorizeMutation,
  jsonResponse,
} from "./http-admission";

export interface GitHubHttpDependencies {
  readonly write_token: string;
  readonly onboarding?: GitHubOnboardingController<JigConfig>;
  readonly reconnect?: GitHubReconnectController;
  readonly reconnect_required?: () => Promise<boolean>;
  readonly is_configured: () => boolean;
}

interface GitHubRepositorySelectionRequest {
  readonly repository_id: number;
}

async function parseRepositorySelection(
  request: Request,
): Promise<GitHubRepositorySelectionRequest> {
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
    throw new InstallationError(
      "GitHub repository selection request must be an object",
    );
  }

  const object: Record<string, unknown> =
    Object.fromEntries(Object.entries(value));
  if (
    Object.keys(object).length !== 1 ||
    typeof object.repository_id !== "number" ||
    !Number.isInteger(object.repository_id) ||
    object.repository_id <= 0
  ) {
    throw new InstallationError(
      "GitHub repository selection requires exactly a positive repository_id",
    );
  }
  return { repository_id: object.repository_id };
}

function unavailableOnboarding(): Response {
  return jsonResponse({ error: "Connect GitHub is unavailable" }, 503);
}

function unavailableReconnect(): Response {
  return jsonResponse(
    { error: "GitHub reconnect is unavailable for this repository" },
    409,
  );
}

export function createGitHubHttpHandler(
  dependencies: GitHubHttpDependencies,
): (request: Request) => Promise<Response | null> {
  return async (request: Request): Promise<Response | null> => {
    const pathname = new URL(request.url).pathname;
    const reconnectAvailable = async (): Promise<boolean> => {
      const reconnect = dependencies.reconnect;
      if (reconnect === undefined || !reconnect.available()) {
        return false;
      }
      if (reconnect.snapshot().state !== "initial") {
        return true;
      }
      return dependencies.reconnect_required === undefined
        ? true
        : dependencies.reconnect_required();
    };

    if (
      request.method === "GET" &&
      pathname === "/api/v1/github/status"
    ) {
      return jsonResponse({
        onboarding_available:
          dependencies.onboarding?.snapshot().available === true,
        reconnect_available: await reconnectAvailable(),
      });
    }

    if (
      request.method === "GET" &&
      pathname === "/api/v1/setup/github/state"
    ) {
      const onboarding = dependencies.onboarding;
      return onboarding === undefined || !onboarding.snapshot().available
        ? unavailableOnboarding()
        : jsonResponse(onboarding.snapshot());
    }

    if (
      request.method === "POST" &&
      (
        pathname === "/api/v1/setup/github/connect" ||
        pathname === "/api/v1/setup/github/select-repository" ||
        pathname === "/api/v1/setup/github/retry"
      )
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
        return unavailableOnboarding();
      }

      try {
        if (pathname === "/api/v1/setup/github/connect") {
          return jsonResponse(await onboarding.start());
        }
        if (pathname === "/api/v1/setup/github/retry") {
          return jsonResponse(await onboarding.retry());
        }

        const body = await parseRepositorySelection(request);
        return jsonResponse(
          await onboarding.selectRepository(body.repository_id),
        );
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
      request.method === "GET" &&
      pathname === "/api/v1/github/reconnect/state"
    ) {
      const reconnect = dependencies.reconnect;
      return reconnect === undefined || !(await reconnectAvailable())
        ? unavailableReconnect()
        : jsonResponse(reconnect.snapshot());
    }

    if (
      request.method === "POST" &&
      pathname === "/api/v1/github/reconnect"
    ) {
      const unauthorized = authorizeMutation(
        request,
        dependencies.write_token,
      );
      if (unauthorized !== null) {
        return unauthorized;
      }

      const reconnect = dependencies.reconnect;
      if (reconnect === undefined || !(await reconnectAvailable())) {
        return unavailableReconnect();
      }

      try {
        return jsonResponse(
          reconnect.snapshot().state === "attention"
            ? await reconnect.retry()
            : await reconnect.start(),
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
