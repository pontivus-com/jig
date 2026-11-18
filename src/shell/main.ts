import { resolve } from "node:path";
import {
  PORTABLE_FORMAT_VERSION,
  rollForwardOutstandingInDatabase,
  SQLITE_SCHEMA_VERSION,
  type RepositoryStatus,
} from "../persistence/sqlite";
import { openDatabase } from "./sqlite-bun";
import {
  createHttpHandler,
  type Diagnostics,
  type ServiceStatus,
} from "./http";
import { createBootstrapHttpHandler } from "./bootstrap-http";
import { GitHubOnboardingController } from "./github-onboarding";
import { GITHUB_APP_REGISTRATION } from "./github-registration";
import { refreshGitHubCredential } from "./github-auth";
import {
  createGitHubAskpassHelper,
  githubGitEnvironment,
  isManagedGitHubRepositoryPath,
} from "./github-managed-checkout";
import {
  loadCurrentGitHubCredential,
  storeGitHubCredential,
  type GitHubCredential,
} from "./secret-service";
import { createSyncController } from "./sync";
import {
  defaultConfigPath,
  loadConfigIfPresent,
  type JigConfig,
} from "./config";
import { acquireWriterLease } from "./writer";
import {
  localCivilDate,
  millisecondsUntilNextLocalDay,
} from "./local-date";

const DEFAULT_HTTP_PORT = 47831;

function writeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function createStatus(
  config: JigConfig,
  repositoryStatus: RepositoryStatus,
): ServiceStatus {
  return {
    ready: true,
    repository_path: config.repository_path,
    repository_status: repositoryStatus,
  };
}

function createDiagnostics(
  config: JigConfig,
  repositoryStatus: RepositoryStatus,
): Diagnostics {
  return {
    service_healthy: true,
    sqlite_available: true,
    sqlite_schema_version: SQLITE_SCHEMA_VERSION,
    repository_path: config.repository_path,
    portable_format_version: PORTABLE_FORMAT_VERSION,
    repository_adapter_healthy: repositoryStatus !== "sync-issue",
  };
}

async function runConfigured(config: JigConfig): Promise<void> {
  const lease = await acquireWriterLease(config.repository_path);
  const db = await openDatabase(
    resolve(config.repository_path, ".jig", "local", "jig.sqlite"),
  );

  const githubAskpass = isManagedGitHubRepositoryPath(
    config.repository_path,
  )
    ? await createGitHubAskpassHelper()
    : null;
  let currentGitHubCredential: GitHubCredential | null = null;

  const getGitHubNetworkEnvironment =
    githubAskpass === null
      ? undefined
      : async (): Promise<Readonly<Record<string, string>>> => {
          let credential =
            currentGitHubCredential ??
            await loadCurrentGitHubCredential();
          if (credential === null) {
            throw new Error(
              "GitHub credential is unavailable; reconnect GitHub",
            );
          }

          if (credential.access_token_expires_at !== null) {
            const expiryMs = Date.parse(
              credential.access_token_expires_at,
            );
            if (!Number.isFinite(expiryMs)) {
              throw new Error(
                "Stored GitHub access-token expiry is invalid; reconnect GitHub",
              );
            }
            if (expiryMs - Date.now() <= 5 * 60 * 1000) {
              credential = await refreshGitHubCredential(
                GITHUB_APP_REGISTRATION,
                credential,
              );
              await storeGitHubCredential(credential);
            }
          }

          currentGitHubCredential = credential;
          return githubGitEnvironment(
            githubAskpass.path,
            credential.access_token,
          );
        };

  const sync = createSyncController(db, {
    repository_path: config.repository_path,
    get_network_environment: getGitHubNetworkEnvironment,
  });

  const startupNow = new Date();
  await rollForwardOutstandingInDatabase(
    db,
    localCivilDate(startupNow),
    startupNow.toISOString(),
  );

  let rolloverTimer: ReturnType<typeof setTimeout> | null = null;

  const ensureCurrentDayRollover = async (): Promise<void> => {
    const now = new Date();
    const result = await rollForwardOutstandingInDatabase(
      db,
      localCivilDate(now),
      now.toISOString(),
    );
    if (result.moved_task_ids.length > 0) {
      sync.notifyMutation();
    }
  };

  const scheduleNextDayBoundary = (): void => {
    if (rolloverTimer !== null) {
      clearTimeout(rolloverTimer);
    }
    rolloverTimer = setTimeout(() => {
      void ensureCurrentDayRollover().finally(() => {
        scheduleNextDayBoundary();
      });
    }, millisecondsUntilNextLocalDay());
  };

  const shutdown = async (): Promise<void> => {
    if (rolloverTimer !== null) {
      clearTimeout(rolloverTimer);
      rolloverTimer = null;
    }
    sync.stop();
    if (githubAskpass !== null) {
      await githubAskpass.dispose();
    }
    await db.close();
    await lease.release();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  await sync.start();
  scheduleNextDayBoundary();

  const handler = createHttpHandler({
    db,
    write_token: writeToken(),
    repository_path: config.repository_path,
    ui_directory: resolve(import.meta.dir, "..", "..", "dist"),
    now: () => new Date().toISOString(),
    create_id: () => crypto.randomUUID(),
    get_status: () => createStatus(config, sync.status()),
    get_diagnostics: () => createDiagnostics(config, sync.status()),
    trigger_sync: sync.trigger,
    ensure_current_day_rollover: ensureCurrentDayRollover,
    on_task_mutation: sync.notifyMutation,
  });

  Bun.serve({
    hostname: "127.0.0.1",
    port: config.http_port,
    fetch: handler,
  });
}

async function runBootstrap(): Promise<void> {
  let resolveConfigured: ((config: JigConfig) => void) | null = null;
  const configured = new Promise<JigConfig>((resolvePromise) => {
    resolveConfigured = resolvePromise;
  });
  const token = writeToken();
  const onConfigured = (config: JigConfig): void => {
    resolveConfigured?.(config);
    resolveConfigured = null;
  };
  const githubOnboarding = new GitHubOnboardingController({
    registration: GITHUB_APP_REGISTRATION,
    config_path: defaultConfigPath(),
    http_port: DEFAULT_HTTP_PORT,
    on_configured: onConfigured,
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: DEFAULT_HTTP_PORT,
    fetch: createBootstrapHttpHandler({
      write_token: token,
      ui_directory: resolve(import.meta.dir, "..", "..", "dist"),
      config_path: defaultConfigPath(),
      http_port: DEFAULT_HTTP_PORT,
      on_configured: onConfigured,
      github_onboarding: githubOnboarding,
    }),
  });

  const nextConfig = await configured;
  await Bun.sleep(100);
  await server.stop(true);
  await runConfigured(nextConfig);
}

export async function main(): Promise<void> {
  const config = await loadConfigIfPresent();
  if (config === null) {
    await runBootstrap();
    return;
  }
  await runConfigured(config);
}

if (import.meta.main) {
  await main();
}
