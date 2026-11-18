import {
  createGitHubAuthorizationRequest,
  exchangeGitHubAuthorizationCode,
  listGitHubInstallations,
  listGitHubRepositories,
  pollGitHubDeviceAuthorization,
  startGitHubDeviceAuthorization,
  type GitHubAppRegistration,
  type GitHubAuthorizationRequest,
  type GitHubDeviceAuthorization,
  type GitHubInstallation,
  type GitHubRepository,
} from "./github-auth";
import {
  assertSecretServiceAvailable,
  storeGitHubCredential,
  type GitHubCredential,
} from "./secret-service";
import {
  acquireManagedGitHubRepository,
} from "./github-managed-checkout";
import {
  initializeRepositoryInstallation,
} from "./setup";
import type { JigConfig } from "./config";

export type GitHubOnboardingPhase =
  | "idle"
  | "authorizing"
  | "repository-access"
  | "repository-selection"
  | "acquiring";

export interface GitHubRepositoryChoice extends GitHubRepository {
  readonly installation_id: number;
  readonly account_login: string;
  readonly account_type: string;
}

export interface GitHubManageAccess {
  readonly installation_id: number;
  readonly account_login: string;
  readonly manage_url: string;
}

export interface GitHubOnboardingSnapshot {
  readonly available: boolean;
  readonly phase: GitHubOnboardingPhase;
  readonly authorization:
    | {
        readonly mode: "browser";
        readonly authorization_url: string;
      }
    | {
        readonly mode: "device";
        readonly verification_uri: string;
        readonly user_code: string;
        readonly retry_after_seconds: number;
      }
    | null;
  readonly grant_access_url: string | null;
  readonly manage_access: readonly GitHubManageAccess[];
  readonly installations: readonly GitHubInstallation[];
  readonly repositories: readonly GitHubRepositoryChoice[];
  readonly error: string | null;
}

export interface GitHubOnboardingDependencies {
  readonly registration: GitHubAppRegistration | null;
  readonly config_path: string;
  readonly http_port: number;
  readonly on_configured: (config: JigConfig) => void;
  readonly store_credential?: typeof storeGitHubCredential;
  readonly assert_secret_service?: typeof assertSecretServiceAvailable;
  readonly create_authorization_request?: typeof createGitHubAuthorizationRequest;
  readonly exchange_authorization_code?: typeof exchangeGitHubAuthorizationCode;
  readonly list_installations?: typeof listGitHubInstallations;
  readonly list_repositories?: typeof listGitHubRepositories;
  readonly start_device_authorization?: typeof startGitHubDeviceAuthorization;
  readonly poll_device_authorization?: typeof pollGitHubDeviceAuthorization;
  readonly acquire_repository?: typeof acquireManagedGitHubRepository;
  readonly initialize_repository?: typeof initializeRepositoryInstallation;
  readonly now?: () => Date;
}

interface DeviceState {
  readonly authorization: GitHubDeviceAuthorization;
  readonly retry_after_seconds: number;
  readonly started_at_ms: number;
}

export class GitHubOnboardingController {
  private phase: GitHubOnboardingPhase = "idle";
  private authorization:
    GitHubOnboardingSnapshot["authorization"] = null;
  private grantAccessUrl: string | null = null;
  private manageAccess: readonly GitHubManageAccess[] = [];
  private installations: readonly GitHubInstallation[] = [];
  private repositories: readonly GitHubRepositoryChoice[] = [];
  private error: string | null = null;
  private credential: GitHubCredential | null = null;
  private pendingAuthorization: GitHubAuthorizationRequest | null = null;
  private deviceState: DeviceState | null = null;
  private callbackServer: ReturnType<typeof Bun.serve> | null = null;

  constructor(private readonly dependencies: GitHubOnboardingDependencies) {}

  snapshot(): GitHubOnboardingSnapshot {
    return {
      available: this.dependencies.registration !== null,
      phase: this.phase,
      authorization: this.authorization,
      grant_access_url: this.grantAccessUrl,
      manage_access: this.manageAccess,
      installations: this.installations,
      repositories: this.repositories,
      error: this.error,
    };
  }

  async start(): Promise<GitHubOnboardingSnapshot> {
    const registration = this.requireRegistration();
    await (this.dependencies.assert_secret_service ??
      assertSecretServiceAvailable)();

    await this.resetTransient();
    this.phase = "authorizing";

    const request = await (
      this.dependencies.create_authorization_request ??
      createGitHubAuthorizationRequest
    )(registration, registration.linux_callback_url);

    try {
      this.startLoopbackListener(request);
      this.pendingAuthorization = request;
      this.authorization = {
        mode: "browser",
        authorization_url: request.authorization_url,
      };
    } catch {
      this.pendingAuthorization = null;
      const device = await (
        this.dependencies.start_device_authorization ??
        startGitHubDeviceAuthorization
      )(registration);
      this.deviceState = {
        authorization: device,
        retry_after_seconds: device.interval,
        started_at_ms: this.now().getTime(),
      };
      this.authorization = {
        mode: "device",
        verification_uri: device.verification_uri,
        user_code: device.user_code,
        retry_after_seconds: device.interval,
      };
    }

    return this.snapshot();
  }

  async refreshAccess(): Promise<GitHubOnboardingSnapshot> {
    if (this.deviceState !== null && this.credential === null) {
      await this.pollDeviceFlow();
      if (this.credential === null) {
        return this.snapshot();
      }
    }

    if (this.credential === null) {
      if (this.phase === "authorizing") {
        return this.snapshot();
      }
      throw new Error("GitHub authorization has not completed");
    }

    await this.loadRepositoryAccess();
    return this.snapshot();
  }

  async acquire(repositoryId: number): Promise<JigConfig> {
    if (this.credential === null) {
      throw new Error("GitHub authorization has not completed");
    }
    const repository = this.repositories.find(
      (candidate) => candidate.id === repositoryId,
    );
    if (repository === undefined) {
      throw new Error("Selected GitHub repository is not authorized");
    }

    this.phase = "acquiring";
    this.error = null;
    try {
      const checkout = await (
        this.dependencies.acquire_repository ??
        acquireManagedGitHubRepository
      )(
        {
          id: repository.id,
          owner: repository.owner,
          name: repository.name,
        },
        { access_token: this.credential.access_token },
      );
      const installation = await (
        this.dependencies.initialize_repository ??
        initializeRepositoryInstallation
      )({
        repository_path: checkout,
        http_port: this.dependencies.http_port,
        config_path: this.dependencies.config_path,
      });
      this.dependencies.on_configured(installation.config);
      return installation.config;
    } catch (error) {
      this.phase = "repository-selection";
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async completeAuthorization(
    state: string,
    code: string,
  ): Promise<void> {
    const registration = this.requireRegistration();
    const pending = this.pendingAuthorization;
    if (
      pending === null ||
      state.length === 0 ||
      code.length === 0 ||
      state !== pending.state
    ) {
      throw new Error("GitHub authorization callback state is invalid");
    }

    const credential = await (
      this.dependencies.exchange_authorization_code ??
      exchangeGitHubAuthorizationCode
    )(registration, pending, code, this.now());

    await this.persistCredential(credential);
    this.pendingAuthorization = null;
    await this.loadRepositoryAccess();
  }

  private requireRegistration(): GitHubAppRegistration {
    if (this.dependencies.registration === null) {
      throw new Error(
        "Connect GitHub is unavailable until the Jig GitHub App registration is configured",
      );
    }
    return this.dependencies.registration;
  }

  private async resetTransient(): Promise<void> {
    this.phase = "idle";
    this.authorization = null;
    this.grantAccessUrl = null;
    this.manageAccess = [];
    this.installations = [];
    this.repositories = [];
    this.error = null;
    this.credential = null;
    this.pendingAuthorization = null;
    this.deviceState = null;
    await this.stopLoopbackListener();
  }

  private now(): Date {
    return (this.dependencies.now ?? (() => new Date()))();
  }

  private async persistCredential(
    credential: GitHubCredential,
  ): Promise<void> {
    await (this.dependencies.store_credential ?? storeGitHubCredential)(
      credential,
    );
    this.credential = credential;
    this.authorization = null;
    this.deviceState = null;
  }

  private async loadRepositoryAccess(): Promise<void> {
    if (this.credential === null) {
      throw new Error("GitHub credential is unavailable");
    }
    const registration = this.requireRegistration();
    try {
      const installations = await (
        this.dependencies.list_installations ??
        listGitHubInstallations
      )(this.credential.access_token);

      const choices: GitHubRepositoryChoice[] = [];
      for (const installation of installations) {
        const repositories = await (
          this.dependencies.list_repositories ??
          listGitHubRepositories
        )(this.credential.access_token, installation.id);
        for (const repository of repositories) {
          choices.push({
            ...repository,
            installation_id: installation.id,
            account_login: installation.account.login,
            account_type: installation.account.type,
          });
        }
      }

      this.installations = installations;
      this.repositories = choices;
      this.grantAccessUrl =
        installations.length === 0
          ? `https://github.com/apps/${registration.app_slug}/installations/new`
          : null;
      this.manageAccess = installations.map((installation) => ({
        installation_id: installation.id,
        account_login: installation.account.login,
        manage_url: `https://github.com/settings/installations/${installation.id}`,
      }));
      this.phase =
        choices.length === 0
          ? "repository-access"
          : "repository-selection";
      this.error = null;
    } catch (error) {
      this.phase = "repository-access";
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private startLoopbackListener(
    request: GitHubAuthorizationRequest,
  ): void {
    const callback = new URL(request.redirect_uri);
    const port = Number(callback.port);
    if (
      callback.protocol !== "http:" ||
      callback.hostname !== "127.0.0.1" ||
      !Number.isInteger(port) ||
      port <= 0
    ) {
      throw new Error("GitHub Linux callback URL is not a loopback HTTP URL");
    }

    this.callbackServer = Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: async (incoming): Promise<Response> => {
        const url = new URL(incoming.url);
        if (url.pathname !== callback.pathname) {
          return new Response("Not found", { status: 404 });
        }
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        try {
          await this.completeAuthorization(state, code);
          setTimeout(() => {
            void this.stopLoopbackListener();
          }, 25);
          return new Response(
            "<!doctype html><title>Jig GitHub authorization complete</title><p>GitHub authorization completed. You can return to Jig.</p>",
            {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" },
            },
          );
        } catch (error) {
          this.error = error instanceof Error ? error.message : String(error);
          setTimeout(() => {
            void this.stopLoopbackListener();
          }, 25);
          return new Response(
            "<!doctype html><title>Jig GitHub authorization failed</title><p>GitHub authorization could not be completed. Return to Jig and retry.</p>",
            {
              status: 400,
              headers: { "content-type": "text/html; charset=utf-8" },
            },
          );
        }
      },
    });
  }

  private async stopLoopbackListener(): Promise<void> {
    const server = this.callbackServer;
    this.callbackServer = null;
    if (server !== null) {
      await server.stop(true);
    }
  }

  private async pollDeviceFlow(): Promise<void> {
    const registration = this.requireRegistration();
    const device = this.deviceState;
    if (device === null) {
      return;
    }
    const elapsedSeconds =
      (this.now().getTime() - device.started_at_ms) / 1000;
    if (elapsedSeconds >= device.authorization.expires_in) {
      this.deviceState = null;
      this.phase = "idle";
      this.authorization = null;
      this.error = "GitHub device authorization expired";
      return;
    }

    const result = await (
      this.dependencies.poll_device_authorization ??
      pollGitHubDeviceAuthorization
    )(
      registration,
      device.authorization,
      device.retry_after_seconds,
      this.now(),
    );

    if (result.status === "authorized") {
      await this.persistCredential(result.credential);
      await this.loadRepositoryAccess();
      return;
    }
    if (result.status === "denied") {
      this.deviceState = null;
      this.phase = "idle";
      this.authorization = null;
      this.error = "GitHub device authorization was denied";
      return;
    }
    if (result.status === "expired") {
      this.deviceState = null;
      this.phase = "idle";
      this.authorization = null;
      this.error = "GitHub device authorization expired";
      return;
    }

    this.deviceState = {
      ...device,
      retry_after_seconds: result.retry_after_seconds,
    };
    if (this.authorization?.mode === "device") {
      this.authorization = {
        ...this.authorization,
        retry_after_seconds: result.retry_after_seconds,
      };
    }
  }
}
