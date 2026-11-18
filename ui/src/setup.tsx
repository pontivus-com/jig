import {
  Banner,
  Button,
  Section,
  TextInput,
  VStack,
} from "@astryxdesign/core";
import { useState } from "react";
import { GitHubDeviceFlowPanel } from "./github-device-flow";
import {
  acquireGitHubRepository,
  configureLocalRepository,
  refreshGitHubSetup,
  startGitHubSetup,
  type GitHubOnboardingSnapshot,
  type SetupStatus,
} from "./setup-http";

export interface SetupViewProps {
  readonly status: SetupStatus;
}

export function SetupView({
  status,
}: SetupViewProps): React.ReactElement {
  const [repositoryPath, setRepositoryPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [github, setGitHub] = useState<GitHubOnboardingSnapshot | null>(null);

  const completeLocalSetup = async (): Promise<void> => {
    if (!repositoryPath.startsWith("/")) {
      setError("Enter the absolute path to the root of an existing Git repository.");
      return;
    }

    setError(null);
    setIsOperating(true);
    try {
      await configureLocalRepository(repositoryPath);
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : String(setupError),
      );
      setIsOperating(false);
    }
  };

  const openExternal = (url: string): void => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleGitHubSnapshot = (
    snapshot: GitHubOnboardingSnapshot,
  ): void => {
    setGitHub(snapshot);
    if (snapshot.error !== null) {
      setError(snapshot.error);
    }
  };

  const connectGitHub = async (): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      handleGitHubSnapshot(await startGitHubSetup());
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : String(setupError),
      );
    } finally {
      setIsOperating(false);
    }
  };

  const refreshGitHub = async (): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      handleGitHubSnapshot(await refreshGitHubSetup());
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : String(setupError),
      );
    } finally {
      setIsOperating(false);
    }
  };

  const acquireGitHub = async (repositoryId: number): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      await acquireGitHubRepository(repositoryId);
      window.setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : String(setupError),
      );
      setIsOperating(false);
    }
  };

  return (
    <main className="jig-setup">
      <div className="jig-setup-content">
        <div className="jig-setup-heading">
          <h1>Set up Jig</h1>
          <p>
            Choose where Jig should keep your portable planning data.
          </p>
        </div>

        {error === null ? null : (
          <Banner
            status="error"
            title="Setup could not continue"
            description={error}
            collapsible={false}
          />
        )}

        {status.local_repository_available ? (
          <Section
            className="jig-setup-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={4}>
              <div>
                <h2>Use a repository already on this computer</h2>
                <p>
                  Enter the absolute path to the root of an existing writable
                  Git worktree. A remote is optional.
                </p>
              </div>
              <TextInput
                label="Repository path"
                value={repositoryPath}
                onChange={setRepositoryPath}
                width="100%"
                placeholder="/home/you/planning"
                isRequired
              />
              <Button
                label="Use this repository"
                variant="primary"
                isLoading={isOperating}
                onClick={() => {
                  void completeLocalSetup();
                }}
              />
            </VStack>
          </Section>
        ) : null}

        <Section
          className="jig-setup-card"
          padding={5}
          dividers={["top", "bottom", "start", "end"]}
        >
          <VStack gap={3}>
            <div>
              <h2>Connect GitHub</h2>
              <p>
                Authorize Jig, choose a repository, and let Jig manage the
                local checkout location.
              </p>
            </div>
            <Button
              label="Connect GitHub"
              variant="secondary"
              isLoading={isOperating}
              onClick={() => {
                void connectGitHub();
              }}
            />
            {status.github_available ? null : (
              <small>
                Connect GitHub becomes available when the governed Jig GitHub
                App registration is configured. Existing local repositories
                remain fully supported.
              </small>
            )}
            <GitHubDeviceFlowPanel
              authorization={github?.authorization ?? null}
              isOperating={isOperating}
              purpose="continue"
              refreshLabel="Refresh access"
              onRefresh={refreshGitHub}
            />
            {github?.grant_access_url === null ||
            github?.grant_access_url === undefined ? null : (
              <div className="jig-setup-github-state">
                <p>Grant the Jig GitHub App access to the repository you want to use.</p>
                <Button
                  label="Grant repository access"
                  variant="secondary"
                  onClick={() => {
                    if (github.grant_access_url !== null) {
                      openExternal(github.grant_access_url);
                    }
                  }}
                />
                <Button
                  label="Refresh access"
                  variant="secondary"
                  isLoading={isOperating}
                  onClick={() => {
                    void refreshGitHub();
                  }}
                />
              </div>
            )}
            {github?.phase === "repository-access" &&
            github.manage_access.length > 0 ? (
              <div className="jig-setup-github-state">
                <p>
                  The Jig GitHub App is installed, but no authorized repository
                  is available yet. Manage access, then refresh.
                </p>
                {github.manage_access.map((access) => (
                  <Button
                    key={access.installation_id}
                    label={`Manage GitHub access for ${access.account_login}`}
                    variant="secondary"
                    onClick={() => {
                      openExternal(access.manage_url);
                    }}
                  />
                ))}
                <Button
                  label="Refresh access"
                  variant="secondary"
                  isLoading={isOperating}
                  onClick={() => {
                    void refreshGitHub();
                  }}
                />
              </div>
            ) : null}
            {github?.repositories.length ? (
              <div className="jig-setup-github-repositories">
                <h3>Choose a repository</h3>
                {github.repositories.map((repository) => (
                  <Button
                    key={repository.id}
                    label={`${repository.owner}/${repository.name}`}
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void acquireGitHub(repository.id);
                    }}
                  />
                ))}
                <Button
                  label="Refresh access"
                  variant="secondary"
                  isLoading={isOperating}
                  onClick={() => {
                    void refreshGitHub();
                  }}
                />
              </div>
            ) : null}
          </VStack>
        </Section>
      </div>
    </main>
  );
}
