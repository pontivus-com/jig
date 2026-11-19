import {
  Banner,
  Button,
  Section,
  TextInput,
  VStack,
} from "@astryxdesign/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GitHubDeviceFlowPanel } from "./github-device-flow";
import { installNativeActiveListener } from "./native/app-lifecycle";
import {
  configureLocalRepository,
  connectGitHubSetup,
  readGitHubSetupState,
  readSetupStatus,
  resumeGitHubSetup,
  retryGitHubSetup,
  selectGitHubRepository,
  type GitHubOnboardingSnapshot,
  type SetupStatus,
} from "./setup-http";

export interface SetupViewProps {
  readonly status: SetupStatus;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SetupView({
  status,
}: SetupViewProps): React.ReactElement {
  const [repositoryPath, setRepositoryPath] = useState("");
  const [showLocalRepository, setShowLocalRepository] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [github, setGitHub] = useState<GitHubOnboardingSnapshot | null>(null);
  const openedProviderUrl = useRef<string | null>(null);

  const observeGitHub = useCallback(async (): Promise<void> => {
    try {
      const setup = await readSetupStatus();
      if (setup.mode === "configured") {
        window.location.reload();
        return;
      }
      if (github !== null) {
        const snapshot = await readGitHubSetupState();
        setGitHub(snapshot);
        if (snapshot.error !== null) {
          setError(snapshot.error);
        }
      }
    } catch {
      // Bootstrap may briefly restart after successful configuration.
    }
  }, [github]);

  useEffect(() => {
    if (github === null) {
      return;
    }
    const timer = window.setInterval(() => {
      void observeGitHub();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [github, observeGitHub]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => Promise<void>) | null = null;

    void installNativeActiveListener(() => {
      void resumeGitHubSetup()
        .then(observeGitHub)
        .catch(() => undefined);
    }).then((remove) => {
      if (disposed) {
        void remove();
        return;
      }
      cleanup = remove;
    });

    return () => {
      disposed = true;
      if (cleanup !== null) {
        void cleanup();
      }
    };
  }, [observeGitHub]);

  useEffect(() => {
    const providerUrl = github?.provider_url ?? null;
    if (
      providerUrl === null ||
      openedProviderUrl.current === providerUrl
    ) {
      return;
    }
    openedProviderUrl.current = providerUrl;
    window.open(providerUrl, "_blank", "noopener,noreferrer");
  }, [github?.provider_url]);

  const completeLocalSetup = async (): Promise<void> => {
    if (!repositoryPath.startsWith("/")) {
      setError(
        "Enter the absolute path to the root of an existing Git repository.",
      );
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
      setError(errorMessage(setupError));
      setIsOperating(false);
    }
  };

  const connectGitHub = async (): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      const snapshot = await connectGitHubSetup();
      setGitHub(snapshot);
      setShowLocalRepository(false);
    } catch (setupError) {
      setError(errorMessage(setupError));
    } finally {
      setIsOperating(false);
    }
  };

  const retryGitHub = async (): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      setGitHub(await retryGitHubSetup());
    } catch (setupError) {
      setError(errorMessage(setupError));
    } finally {
      setIsOperating(false);
    }
  };

  const selectRepository = async (repositoryId: number): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      setGitHub(await selectGitHubRepository(repositoryId));
    } catch (setupError) {
      setError(errorMessage(setupError));
    } finally {
      setIsOperating(false);
    }
  };

  const initial = github === null || github.state === "initial";
  const connecting = github?.state === "connecting";
  const selecting = github?.state === "repository-selection";
  const attention = github?.state === "attention";

  return (
    <div className="jig-setup">
      <div className="jig-setup-content">
        <div className="jig-setup-heading">
          <h1>Connect your planning data</h1>
          <p>
            Jig keeps your planning data in a Git repository so it can stay
            local and move with you.
          </p>
        </div>

        {error === null ? null : (
          <Banner
            status="error"
            title="Jig needs attention"
            description={error}
            collapsible={false}
          />
        )}

        {initial ? (
          <Section
            className="jig-setup-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              {status.github_available ? (
                <Button
                  label="Connect GitHub repository"
                  variant="primary"
                  isLoading={isOperating}
                  onClick={() => {
                    void connectGitHub();
                  }}
                />
              ) : (
                <p>Connect GitHub is unavailable in this runtime.</p>
              )}

              {status.local_repository_available ? (
                <Button
                  label="Use an existing local repository"
                  variant="secondary"
                  onClick={() => {
                    setShowLocalRepository((current) => !current);
                    setError(null);
                  }}
                />
              ) : null}

              {showLocalRepository ? (
                <div className="jig-setup-local-repository">
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
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void completeLocalSetup();
                    }}
                  />
                </div>
              ) : null}
            </VStack>
          </Section>
        ) : null}

        {connecting ? (
          <Section
            className="jig-setup-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <div>
                <h2>Connecting repository…</h2>
                <p>Jig will continue automatically when it can.</p>
              </div>

              <GitHubDeviceFlowPanel
                authorization={github.authorization}
                purpose="continue"
              />

              {github.provider_url === null ? null : (
                <div className="jig-setup-github-state">
                  <p>
                    Choose or review repository access on GitHub. Jig will
                    check the result automatically when you return.
                  </p>
                  <Button
                    label="Open GitHub"
                    variant="secondary"
                    onClick={() => {
                      if (github.provider_url !== null) {
                        window.open(
                          github.provider_url,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    }}
                  />
                </div>
              )}

              {github.authorization === null &&
              github.provider_url === null ? (
                <p className="jig-secondary-copy">
                  Finishing the repository connection…
                </p>
              ) : null}
            </VStack>
          </Section>
        ) : null}

        {selecting ? (
          <Section
            className="jig-setup-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <div>
                <h2>Choose a repository</h2>
                <p>Select the repository Jig should use for planning data.</p>
              </div>
              <div className="jig-setup-github-repositories">
                {github.repositories.map((repository) => (
                  <Button
                    key={repository.id}
                    label={`${repository.owner}/${repository.name}`}
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void selectRepository(repository.id);
                    }}
                  />
                ))}
              </div>
              {github.provider_url === null ? null : (
                <Button
                  label="Repository not listed? Open GitHub"
                  variant="secondary"
                  onClick={() => {
                    if (github.provider_url !== null) {
                      window.open(
                        github.provider_url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }}
                />
              )}
            </VStack>
          </Section>
        ) : null}

        {attention ? (
          <Section
            className="jig-setup-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <h2>Connection needs attention</h2>
              {github.error === null ? null : <p>{github.error}</p>}
              <Button
                label="Try again"
                variant="primary"
                isLoading={isOperating}
                onClick={() => {
                  void retryGitHub();
                }}
              />
              {status.local_repository_available ? (
                <Button
                  label="Use an existing local repository"
                  variant="secondary"
                  onClick={() => {
                    setGitHub(null);
                    setShowLocalRepository(true);
                    setError(null);
                  }}
                />
              ) : null}
            </VStack>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
