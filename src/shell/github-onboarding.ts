import type {
  GitHubAppRegistration,
  GitHubInstallation,
  GitHubOnboardingPhase,
  GitHubOnboardingSnapshot,
  GitHubRepositoryChoice,
} from "../github";
import {
  listGitHubInstallations,
  listGitHubRepositories,
} from "./github-auth";
import { GitHubDeviceFlowSession } from "./github-device-flow";
import {
  acquireManagedGitHubRepository,
} from "./github-managed-checkout";
import {
  initializeRepositoryInstallation,
} from "./setup";
import type { JigConfig } from "./config";

export interface GitHubOnboardingDependencies {
  readonly registration: GitHubAppRegistration | null;
  readonly device_flow: GitHubDeviceFlowSession;
  readonly config_path: string;
  readonly http_port: number;
  readonly list_installations?: typeof listGitHubInstallations;
  readonly list_repositories?: typeof listGitHubRepositories;
  readonly acquire_repository?: typeof acquireManagedGitHubRepository;
  readonly initialize_repository?: typeof initializeRepositoryInstallation;
}

export class GitHubOnboardingController {
  private phase: GitHubOnboardingPhase = "idle";
  private grantAccessUrl: string | null = null;
  private manageAccess: GitHubOnboardingSnapshot["manage_access"] = [];
  private installations: readonly GitHubInstallation[] = [];
  private repositories: readonly GitHubRepositoryChoice[] = [];
  private error: string | null = null;

  constructor(private readonly dependencies: GitHubOnboardingDependencies) {}

  snapshot(): GitHubOnboardingSnapshot {
    const authorization = this.dependencies.device_flow.snapshot();
    return {
      available:
        this.dependencies.registration !== null &&
        authorization.available,
      phase:
        this.phase === "authorizing"
          ? authorization.phase
          : this.phase,
      authorization: authorization.authorization,
      grant_access_url: this.grantAccessUrl,
      manage_access: this.manageAccess,
      installations: this.installations,
      repositories: this.repositories,
      error: this.error ?? authorization.error,
    };
  }

  async start(): Promise<GitHubOnboardingSnapshot> {
    this.requireRegistration();
    this.resetRepositoryState();
    this.phase = "authorizing";
    await this.dependencies.device_flow.start();
    return this.snapshot();
  }

  async refreshAccess(): Promise<GitHubOnboardingSnapshot> {
    if (this.phase === "authorizing") {
      const authorization = await this.dependencies.device_flow.poll();
      if (this.dependencies.device_flow.credential() === null) {
        if (authorization.phase === "idle") {
          this.phase = "idle";
        }
        return this.snapshot();
      }
    }

    if (this.dependencies.device_flow.credential() === null) {
      throw new Error("GitHub authorization has not completed");
    }

    await this.loadRepositoryAccess();
    return this.snapshot();
  }

  async acquire(repositoryId: number): Promise<JigConfig> {
    const credential = this.dependencies.device_flow.credential();
    if (credential === null) {
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
        { access_token: credential.access_token },
      );
      const installation = await (
        this.dependencies.initialize_repository ??
        initializeRepositoryInstallation
      )({
        repository_path: checkout,
        http_port: this.dependencies.http_port,
        config_path: this.dependencies.config_path,
      });
      return installation.config;
    } catch (error) {
      this.phase = "repository-selection";
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private requireRegistration(): GitHubAppRegistration {
    if (this.dependencies.registration === null) {
      throw new Error(
        "Connect GitHub is unavailable until the Jig GitHub App registration is configured",
      );
    }
    return this.dependencies.registration;
  }

  private resetRepositoryState(): void {
    this.phase = "idle";
    this.grantAccessUrl = null;
    this.manageAccess = [];
    this.installations = [];
    this.repositories = [];
    this.error = null;
  }

  private async loadRepositoryAccess(): Promise<void> {
    const credential = this.dependencies.device_flow.credential();
    if (credential === null) {
      throw new Error("GitHub credential is unavailable");
    }
    const registration = this.requireRegistration();
    try {
      const installations = await (
        this.dependencies.list_installations ??
        listGitHubInstallations
      )(credential.access_token);

      const choices: GitHubRepositoryChoice[] = [];
      for (const installation of installations) {
        const repositories = await (
          this.dependencies.list_repositories ??
          listGitHubRepositories
        )(credential.access_token, installation.id);
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
        manage_url:
          `https://github.com/settings/installations/${installation.id}`,
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
}
