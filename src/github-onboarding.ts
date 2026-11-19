import type {
  GitHubAppRegistration,
  GitHubCredential,
  GitHubInstallation,
  GitHubOnboardingSnapshot,
  GitHubRepositoryChoice,
} from "./github";
import {
  GitHubAuthError,
  listGitHubInstallations,
  listGitHubRepositories,
} from "./github-auth";
import { GitHubDeviceFlowSession } from "./github-device-flow";

type GitHubOnboardingPhase =
  | "idle"
  | "authorizing"
  | "repository-access"
  | "repository-selection"
  | "acquiring"
  | "attention"
  | "configured";

type Sleep = (milliseconds: number) => Promise<void>;

export interface GitHubOnboardingDependencies<TAcquired> {
  readonly registration: GitHubAppRegistration | null;
  readonly device_flow: GitHubDeviceFlowSession;
  readonly acquire_repository: (
    repository: GitHubRepositoryChoice,
    credential: GitHubCredential,
  ) => Promise<TAcquired>;
  readonly on_acquired?: (acquired: TAcquired) => Promise<void> | void;
  readonly list_installations?: typeof listGitHubInstallations;
  readonly list_repositories?: typeof listGitHubRepositories;
  readonly sleep?: Sleep;
}

const INITIAL_ACCESS_RETRY_MS = 5_000;
const MAX_ACCESS_RETRY_MS = 30_000;
const MAX_TRANSIENT_ACCESS_FAILURES = 5;

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function accessProviderUrl(
  registration: GitHubAppRegistration,
  installations: readonly GitHubInstallation[],
): string {
  if (installations.length === 0) {
    return `https://github.com/apps/${registration.app_slug}/installations/new`;
  }
  if (installations.length === 1) {
    return `https://github.com/settings/installations/${installations[0]?.id ?? ""}`;
  }
  return "https://github.com/settings/installations";
}

export class GitHubOnboardingController<TAcquired> {
  private phase: GitHubOnboardingPhase = "idle";
  private providerUrl: string | null = null;
  private repositories: readonly GitHubRepositoryChoice[] = [];
  private selectedRepository: GitHubRepositoryChoice | null = null;
  private error: string | null = null;
  private worker: Promise<void> | null = null;
  private accessRetryMs = INITIAL_ACCESS_RETRY_MS;
  private transientAccessFailures = 0;

  constructor(
    private readonly dependencies: GitHubOnboardingDependencies<TAcquired>,
  ) {}

  snapshot(): GitHubOnboardingSnapshot {
    const authorization = this.dependencies.device_flow.snapshot();
    const state =
      this.phase === "idle"
        ? "initial"
        : this.phase === "repository-selection"
          ? "repository-selection"
          : this.phase === "attention"
            ? "attention"
            : "connecting";

    return {
      available:
        this.dependencies.registration !== null &&
        authorization.available,
      state,
      authorization:
        this.phase === "authorizing"
          ? authorization.authorization
          : null,
      provider_url: this.providerUrl,
      repositories:
        this.phase === "repository-selection"
          ? this.repositories
          : [],
      error: this.error ?? (
        this.phase === "authorizing"
          ? authorization.error
          : null
      ),
    };
  }

  async start(): Promise<GitHubOnboardingSnapshot> {
    this.requireRegistration();
    this.reset();
    this.phase = "authorizing";
    await this.dependencies.device_flow.start();
    this.ensureWorker();
    return this.snapshot();
  }

  async selectRepository(
    repositoryId: number,
  ): Promise<GitHubOnboardingSnapshot> {
    if (this.phase !== "repository-selection") {
      throw new Error("GitHub repository selection is not currently required");
    }
    const repository = this.repositories.find(
      (candidate) => candidate.id === repositoryId,
    );
    if (repository === undefined) {
      throw new Error("Selected GitHub repository is not authorized");
    }

    this.selectedRepository = repository;
    this.phase = "acquiring";
    this.providerUrl = null;
    this.error = null;
    this.ensureWorker();
    return this.snapshot();
  }

  async retry(): Promise<GitHubOnboardingSnapshot> {
    if (this.phase !== "attention") {
      return this.snapshot();
    }
    return this.start();
  }

  resume(): void {
    if (
      this.phase === "authorizing" ||
      this.phase === "repository-access" ||
      this.phase === "acquiring"
    ) {
      this.ensureWorker();
    }
  }

  private ensureWorker(): void {
    if (this.worker !== null) {
      return;
    }
    this.worker = this.run()
      .catch((error: unknown) => {
        this.fail(error);
      })
      .finally(() => {
        this.worker = null;
      });
  }

  private async run(): Promise<void> {
    while (true) {
      if (this.phase === "authorizing") {
        await this.continueAuthorization();
        continue;
      }

      if (this.phase === "repository-access") {
        const next = await this.continueRepositoryAccess();
        if (next === "wait") {
          await this.sleep(this.accessRetryMs);
          this.accessRetryMs = Math.min(
            MAX_ACCESS_RETRY_MS,
            this.accessRetryMs * 2,
          );
          continue;
        }
        continue;
      }

      if (this.phase === "acquiring") {
        await this.acquireSelectedRepository();
      }
      return;
    }
  }

  private async continueAuthorization(): Promise<void> {
    const delay = this.dependencies.device_flow.nextPollDelayMs();
    if (delay !== null && delay > 0) {
      await this.sleep(delay);
    }
    if (this.phase !== "authorizing") {
      return;
    }

    const authorization = await this.dependencies.device_flow.poll();
    const credential = this.dependencies.device_flow.credential();
    if (credential !== null) {
      this.phase = "repository-access";
      this.error = null;
      this.accessRetryMs = INITIAL_ACCESS_RETRY_MS;
      this.transientAccessFailures = 0;
      return;
    }
    if (authorization.error !== null) {
      this.phase = "attention";
      this.error = authorization.error;
    }
  }

  private async continueRepositoryAccess():
  Promise<"continue" | "wait"> {
    const credential = this.dependencies.device_flow.credential();
    if (credential === null) {
      this.phase = "attention";
      this.error = "GitHub authorization is no longer available. Try GitHub authorization again.";
      return "continue";
    }

    try {
      const registration = this.requireRegistration();
      const installations = await (
        this.dependencies.list_installations ??
        listGitHubInstallations
      )(credential.access_token);

      const choices = new Map<number, GitHubRepositoryChoice>();
      for (const installation of installations) {
        const repositories = await (
          this.dependencies.list_repositories ??
          listGitHubRepositories
        )(credential.access_token, installation.id);
        for (const repository of repositories) {
          choices.set(repository.id, {
            ...repository,
            installation_id: installation.id,
            account_login: installation.account.login,
            account_type: installation.account.type,
          });
        }
      }

      this.repositories = [...choices.values()].sort((left, right) =>
        `${left.owner}/${left.name}`.localeCompare(
          `${right.owner}/${right.name}`,
        ),
      );
      this.providerUrl = accessProviderUrl(registration, installations);
      this.error = null;
      this.transientAccessFailures = 0;

      if (this.repositories.length === 0) {
        this.phase = "repository-access";
        return "wait";
      }

      if (this.repositories.length === 1) {
        this.selectedRepository = this.repositories[0] ?? null;
        this.providerUrl = null;
        this.phase = "acquiring";
        return "continue";
      }

      this.phase = "repository-selection";
      return "continue";
    } catch (error) {
      if (
        error instanceof GitHubAuthError &&
        error.status_code === 401
      ) {
        this.phase = "attention";
        this.error =
          "GitHub authorization is no longer valid. Try GitHub authorization again.";
        return "continue";
      }

      if (
        error instanceof GitHubAuthError &&
        (error.status_code === 403 || error.status_code === 404)
      ) {
        const registration = this.requireRegistration();
        this.providerUrl =
          `https://github.com/apps/${registration.app_slug}/installations/new`;
        this.phase = "repository-access";
        this.error = null;
        return "wait";
      }

      this.transientAccessFailures += 1;
      if (
        this.transientAccessFailures >=
        MAX_TRANSIENT_ACCESS_FAILURES
      ) {
        this.phase = "attention";
        this.error =
          "Jig could not confirm repository access with GitHub. Try again when the connection is available.";
        return "continue";
      }
      return "wait";
    }
  }

  private async acquireSelectedRepository(): Promise<void> {
    const credential = this.dependencies.device_flow.credential();
    const repository = this.selectedRepository;
    if (credential === null || repository === null) {
      this.phase = "attention";
      this.error = "GitHub repository acquisition cannot continue.";
      return;
    }

    try {
      const acquired = await this.dependencies.acquire_repository(
        repository,
        credential,
      );
      if (this.dependencies.on_acquired !== undefined) {
        await this.dependencies.on_acquired(acquired);
      }
      this.phase = "configured";
      this.error = null;
    } catch (error) {
      this.phase = "attention";
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private fail(error: unknown): void {
    this.phase = "attention";
    this.error = error instanceof Error ? error.message : String(error);
  }

  private requireRegistration(): GitHubAppRegistration {
    if (this.dependencies.registration === null) {
      throw new Error(
        "Connect GitHub is unavailable until the Jig GitHub App registration is configured",
      );
    }
    return this.dependencies.registration;
  }

  private reset(): void {
    this.phase = "idle";
    this.providerUrl = null;
    this.repositories = [];
    this.selectedRepository = null;
    this.error = null;
    this.accessRetryMs = INITIAL_ACCESS_RETRY_MS;
    this.transientAccessFailures = 0;
  }

  private sleep(milliseconds: number): Promise<void> {
    return (this.dependencies.sleep ?? defaultSleep)(milliseconds);
  }
}
