import {
  Banner,
  Button,
  Section,
  TextInput,
  VStack,
} from "@astryxdesign/core";
import { useState } from "react";
import {
  configureLocalRepository,
  startGitHubSetup,
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

  const connectGitHub = async (): Promise<void> => {
    setError(null);
    setIsOperating(true);
    try {
      await startGitHubSetup();
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
                GitHub connection is not yet available in this implementation
                wave; existing local repositories are fully supported.
              </small>
            )}
          </VStack>
        </Section>
      </div>
    </main>
  );
}
