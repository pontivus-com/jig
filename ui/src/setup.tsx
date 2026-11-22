import {
  Button,
  Icon,
  Section,
  TextInput,
  VStack,
} from "@astryxdesign/core";

import { JigAttentionBanner } from "./attention-banner";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GitHubDeviceFlowPanel } from "./github-device-flow";
import type { LayoutMode } from "./use-layout-mode";
import {
  configureLocalRepository,
  connectGitHubSetup,
  readGitHubSetupState,
  readSetupStatus,
  retryGitHubSetup,
  selectGitHubRepository,
  type GitHubOnboardingSnapshot,
  type SetupStatus,
} from "./setup-http";

export interface SetupViewProps {
  readonly status: SetupStatus;
  readonly layoutMode: LayoutMode;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function SetupBenefits({
  mobile,
}: Readonly<{ mobile: boolean }>): React.ReactElement {
  const benefits = mobile
    ? [
        {
          icon: "check" as const,
          title: "Saved on this device",
          detail: "Your plan remains usable locally.",
        },
        {
          icon: "viewColumns" as const,
          title: "Same plan across devices",
          detail: "Keep planning continuity between desktop and Android.",
        },
        {
          icon: "externalLink" as const,
          title: "You stay in control",
          detail: "GitHub authorization stays on GitHub.",
        },
      ]
    : [
        {
          icon: "check" as const,
          title: "Local first",
          detail: "Your plan remains available on this computer.",
        },
        {
          icon: "viewColumns" as const,
          title: "Portable",
          detail: "Use the same planning data on another Jig installation.",
        },
        {
          icon: "externalLink" as const,
          title: "Your repository",
          detail: "GitHub authorization stays on GitHub.",
        },
      ];

  return (
    <div
      className="jig-setup-benefits"
      aria-label="How Jig keeps your plan"
    >
      {benefits.map((benefit) => (
        <div className="jig-setup-benefit" key={benefit.title}>
          <span className="jig-setup-benefit-icon" aria-hidden="true">
            <Icon icon={benefit.icon} size="sm" color="inherit" />
          </span>
          <span className="jig-setup-benefit-copy">
            <strong>{benefit.title}</strong>
            <span>{benefit.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function SetupView({
  status,
  layoutMode,
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

  const openProvider = (): void => {
    if (github?.provider_url !== null && github?.provider_url !== undefined) {
      window.open(
        github.provider_url,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <div className="jig-setup" aria-labelledby="jig-setup-title">
      <div className="jig-setup-layout">
        {layoutMode === "narrow" && initial && !showLocalRepository ? (
          <section className="jig-setup-value">
            <div className="jig-setup-heading">
              <span className="jig-setup-eyebrow">Welcome to Jig</span>
              <h1 id="jig-setup-title">Plan your week. Keep the data yours.</h1>
              <p>
                Jig keeps planning data local and uses Git to carry the same
                plan between Jig installations.
              </p>
            </div>

            <SetupBenefits mobile />
          </section>
        ) : layoutMode === "desktop" ? (
          <section className="jig-setup-value">
            <div className="jig-setup-heading">
              <span className="jig-setup-eyebrow">Welcome to Jig</span>
              <h1 id="jig-setup-title">
                Plan your week. Keep the data yours.
              </h1>
              <p>
                Jig keeps planning data local and uses Git to carry the same
                plan between Jig installations.
              </p>
            </div>
            <SetupBenefits mobile={false} />
          </section>
        ) : null}

        <section className="jig-setup-pane" aria-label="Set up planning data">
          {error === null ? null : (
            <JigAttentionBanner
              status="error"
              title="Jig needs attention"
              description={error}
            />
          )}

          {initial && showLocalRepository ? (
            <Section
              className="jig-setup-card"
              padding={5}
              dividers={["top", "bottom", "start", "end"]}
            >
              <VStack gap={3}>
                <div className="jig-setup-state-heading">
                  {layoutMode === "narrow" ? (
                    <span className="jig-setup-eyebrow">
                      Existing repository
                    </span>
                  ) : null}
                  <h2 id={layoutMode === "narrow" ? "jig-setup-title" : undefined}>Use an existing local repository</h2>
                  <p>
                    Enter the absolute path to the repository that already
                    carries your planning data.
                  </p>
                </div>
                <TextInput
                  label="Repository path"
                  value={repositoryPath}
                  onChange={setRepositoryPath}
                  width="100%"
                  placeholder="/home/you/planning"
                  isRequired
                  controlClassName="jig-mobile-touch-control"
                />
                <Button
                  label="Use this repository"
                  variant="primary"
                  isLoading={isOperating}
                  onClick={() => {
                    void completeLocalSetup();
                  }}
                />
                <Button
                  label="Back"
                  variant="secondary"
                  isDisabled={isOperating}
                  onClick={() => {
                    setShowLocalRepository(false);
                    setError(null);
                  }}
                />
              </VStack>
            </Section>
          ) : initial ? (
            <div
              className={[
                "jig-setup-choice",
                layoutMode === "narrow"
                  ? "jig-setup-choice-narrow"
                  : "jig-setup-choice-desktop",
              ].join(" ")}
            >
              <VStack gap={3}>
                {layoutMode === "desktop" ? (
                  <div className="jig-setup-state-heading">
                    <h2>Choose where Jig keeps your plan</h2>
                    <p>
                      Connect GitHub for continuity between Jig installations
                      {status.local_repository_available
                        ? ", or use a repository already on this computer."
                        : "."}
                    </p>
                  </div>
                ) : null}

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
                      setShowLocalRepository(true);
                      setError(null);
                    }}
                  />
                ) : null}

                <small className="jig-secondary-copy">
                  Jig continues automatically after GitHub authorization.
                </small>
              </VStack>
            </div>
          ) : null}

          {connecting ? (
            <Section
              className="jig-setup-card"
              padding={5}
              dividers={["top", "bottom", "start", "end"]}
            >
              <VStack gap={3}>
                <div className="jig-setup-state-heading">
                  {layoutMode === "narrow" ? (
                    <span className="jig-setup-eyebrow">
                      Connect your planning data
                    </span>
                  ) : null}
                  <h2
                    id={layoutMode === "narrow" ? "jig-setup-title" : undefined}
                  >
                    {github.authorization !== null
                      ? "Authorize Jig on GitHub"
                      : github.provider_url !== null
                        ? "Repository access on GitHub"
                        : "Getting your plan ready…"}
                  </h2>
                  <p>
                    {github.authorization !== null
                      ? "Enter the code on GitHub. Jig will continue automatically after authorization."
                      : github.provider_url !== null
                        ? "Review repository access on GitHub. Jig will check again automatically when you return."
                        : "Jig is connecting your planning data. No additional action is required."}
                  </p>
                </div>

                <GitHubDeviceFlowPanel
                  authorization={github.authorization}
                  purpose="continue"
                />

                {github.provider_url === null ? null : (
                  <Button
                    label="Open GitHub"
                    variant="primary"
                    onClick={openProvider}
                  />
                )}

                {github.authorization === null &&
                github.provider_url === null ? (
                  <p className="jig-secondary-copy">
                    You’ll go straight to Planner when it’s ready.
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
                <div className="jig-setup-state-heading">
                  {layoutMode === "narrow" ? (
                    <span className="jig-setup-eyebrow">
                      Connect your planning data
                    </span>
                  ) : null}
                  <h2 id={layoutMode === "narrow" ? "jig-setup-title" : undefined}>Choose your planning repository</h2>
                  <p>
                    Choose the repository that carries your Jig planning data.
                  </p>
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
                    onClick={openProvider}
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
                <div className="jig-setup-state-heading">
                  {layoutMode === "narrow" ? (
                    <span className="jig-setup-eyebrow">
                      Connection needs attention
                    </span>
                  ) : null}
                  <h2 id={layoutMode === "narrow" ? "jig-setup-title" : undefined}>Connection needs attention</h2>
                  <p>
                    {github.error ??
                      "Jig cannot continue until the connection is available."}
                  </p>
                </div>
                {github.provider_url === null ? null : (
                  <Button
                    label="Open GitHub"
                    variant="primary"
                    onClick={openProvider}
                  />
                )}
                <Button
                  label="Try again"
                  variant={github.provider_url === null ? "primary" : "secondary"}
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
        </section>
      </div>
    </div>
  );
}
