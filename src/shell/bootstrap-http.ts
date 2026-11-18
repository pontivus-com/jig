import { isAbsolute } from "node:path";
import {
  initializeRepositoryInstallation,
  InstallationError,
} from "./setup";
import { serveUi } from "./http";
import type { JigConfig } from "./config";

export interface BootstrapHttpDependencies {
  readonly write_token: string;
  readonly ui_directory: string;
  readonly config_path: string;
  readonly http_port: number;
  readonly on_configured: (config: JigConfig) => void;
}

interface LocalRepositoryRequest {
  readonly repository_path: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function authorizeMutation(
  request: Request,
  writeToken: string,
): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== requestUrl.origin) {
    return json({ error: "cross-origin mutation rejected" }, 403);
  }
  if (request.headers.get("x-jig-write-token") !== writeToken) {
    return json({ error: "invalid write token" }, 403);
  }
  return null;
}

async function parseLocalRepositoryRequest(
  request: Request,
): Promise<LocalRepositoryRequest> {
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

  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new InstallationError(
      "Local repository setup request must be an object",
    );
  }

  const object: Record<string, unknown> = Object.fromEntries(
    Object.entries(value),
  );
  if (
    Object.keys(object).length !== 1 ||
    typeof object.repository_path !== "string"
  ) {
    throw new InstallationError(
      "Local repository setup requires exactly repository_path",
    );
  }
  if (!isAbsolute(object.repository_path)) {
    throw new InstallationError("Repository path must be absolute");
  }

  return { repository_path: object.repository_path };
}

export function createBootstrapHttpHandler(
  dependencies: BootstrapHttpDependencies,
): (request: Request) => Promise<Response> {
  let configured = false;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const { pathname } = url;

    if (
      request.method === "GET" &&
      pathname === "/api/v1/setup/status"
    ) {
      return json({
        mode: configured ? "configured" : "bootstrap",
        local_repository_available: true,
        github_available: false,
      });
    }

    if (
      request.method === "POST" &&
      pathname === "/api/v1/setup/local-repository"
    ) {
      const unauthorized = authorizeMutation(
        request,
        dependencies.write_token,
      );
      if (unauthorized !== null) {
        return unauthorized;
      }
      if (configured) {
        return json({ error: "Jig setup is already complete" }, 409);
      }

      try {
        const body = await parseLocalRepositoryRequest(request);
        const installation = await initializeRepositoryInstallation({
          repository_path: body.repository_path,
          http_port: dependencies.http_port,
          config_path: dependencies.config_path,
        });
        configured = true;
        dependencies.on_configured(installation.config);
        return json({
          configured: true,
          repository_path: installation.config.repository_path,
        });
      } catch (error) {
        if (error instanceof InstallationError) {
          return json({ error: error.message }, 400);
        }
        return json({ error: "Repository setup failed" }, 500);
      }
    }

    if (
      [
        "/api/v1/setup/github/start",
        "/api/v1/setup/github/refresh-access",
        "/api/v1/setup/github/acquire",
      ].includes(pathname) ||
      pathname === "/api/v1/setup/github/repositories"
    ) {
      return json(
        {
          error: "GitHub connection is not available in this implementation wave",
        },
        501,
      );
    }

    if (request.method === "GET") {
      return serveUi(
        pathname,
        dependencies.ui_directory,
        dependencies.write_token,
      );
    }

    return new Response("Not found", { status: 404 });
  };
}
