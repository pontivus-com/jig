import {
  Banner,
  Button,
  Section,
  Selector,
  SegmentedControl,
  SegmentedControlItem,
  VStack,
} from "@astryxdesign/core";
import { useEffect, useState } from "react";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/protocol";
import { repositoryStatusPresentation } from "./repository-status";
import type { GitHubReconnectSnapshot } from "./setup-http";
import { GitHubDeviceFlowPanel } from "./github-device-flow";
import {
  browserNotificationState,
  requestBrowserNotificationPermission,
  type BrowserNotificationState,
} from "./browser-notifications";
import {
  THEME_DEFINITIONS,
  THEME_GROUPS,
  isAppearanceMode,
  isThemePreset,
  type AppearanceMode,
  type ThemePreset,
} from "./appearance";

const THEME_OPTIONS = THEME_GROUPS.map((group) => ({
  type: "section" as const,
  title: group,
  options: THEME_DEFINITIONS
    .filter((definition) => definition.group === group)
    .map((definition) => ({
      value: definition.id,
      label: definition.label,
    })),
}));

export interface SettingsViewProps {
  readonly themePreset: ThemePreset;
  readonly appearanceMode: AppearanceMode;
  readonly status: ServiceStatus | null;
  readonly diagnostics: Diagnostics | null;
  readonly operationError: string | null;
  readonly isOperating: boolean;
  readonly githubReconnectAvailable: boolean;
  readonly githubReconnect: GitHubReconnectSnapshot | null;
  readonly onThemePresetChange: (value: ThemePreset) => void;
  readonly onAppearanceModeChange: (value: AppearanceMode) => void;
  readonly onSync: () => Promise<void>;
  readonly onReconnectGitHub: () => Promise<void>;
  readonly onRefreshGitHubReconnect: () => Promise<void>;
}

function notificationStatusMessage(
  state: BrowserNotificationState,
): string {
  switch (state) {
    case "unsupported":
      return "Not supported by this browser";
    case "default":
      return "Not enabled";
    case "granted":
      return "Enabled";
    case "denied":
      return "Blocked in browser settings";
  }
}

export function SettingsView({
  themePreset,
  appearanceMode,
  status,
  diagnostics,
  operationError,
  isOperating,
  githubReconnectAvailable,
  githubReconnect,
  onThemePresetChange,
  onAppearanceModeChange,
  onSync,
  onReconnectGitHub,
  onRefreshGitHubReconnect,
}: SettingsViewProps): React.ReactElement {
  const [notificationState, setNotificationState] =
    useState<BrowserNotificationState>(browserNotificationState);
  const repositoryStatus = repositoryStatusPresentation(status);

  useEffect(() => {
    const refresh = (): void => {
      setNotificationState(browserNotificationState());
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return (
    <div className="jig-settings-view">
      <div className="jig-reference-heading">
        <div>
          <h1>Settings</h1>
          <p>Repository, synchronization, appearance and diagnostics</p>
        </div>
      </div>

      {operationError === null ? null : (
        <Banner
          status="error"
          title="Operation failed"
          description={operationError}
          collapsible={false}
        />
      )}

      <div className="jig-settings-grid">
        <section
          className="jig-settings-panel jig-settings-planning"
          aria-labelledby="planning-data-heading"
        >
          <h2 id="planning-data-heading">Planning data</h2>
          <Section
            className="jig-settings-card"
            minHeight={200}
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <strong>Repository</strong>
              <p>{status?.repository_path ?? "Unavailable"}</p>
              <small>Selected planning-data home · informational only</small>
            </VStack>
          </Section>
        </section>

        <section
          className="jig-settings-panel jig-settings-sync"
          aria-labelledby="sync-heading"
        >
          <h2 id="sync-heading">Synchronization</h2>
          <Section
            className="jig-settings-card jig-settings-sync-card"
            minHeight={200}
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3} height="100%">
              <strong>
                {status?.repository_status === "synchronized"
                  ? "Synced"
                  : "Synchronization"}
              </strong>
              <p>{repositoryStatus.message}</p>
              <dl className="jig-diagnostics">
                <div>
                  <dt>Service</dt>
                  <dd>{status?.ready ? "Running" : "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Local save</dt>
                  <dd>{diagnostics?.sqlite_available ? "Safe" : "Unavailable"}</dd>
                </div>
              </dl>
              <div className="jig-settings-sync-action">
                <Button
                  label="Sync now"
                  variant="secondary"
                  width={190}
                  isLoading={isOperating}
                  onClick={() => {
                    void onSync();
                  }}
                />
                {githubReconnectAvailable &&
                status?.repository_status === "sync-issue" &&
                githubReconnect === null ? (
                  <Button
                    label="Reconnect GitHub"
                    variant="secondary"
                    width={190}
                    isLoading={isOperating}
                    onClick={() => {
                      void onReconnectGitHub();
                    }}
                  />
                ) : null}
              </div>
              <GitHubDeviceFlowPanel
                authorization={githubReconnect?.authorization ?? null}
                isOperating={isOperating}
                purpose="reconnect"
                refreshLabel="Refresh GitHub authorization"
                onRefresh={onRefreshGitHubReconnect}
              />
            </VStack>
          </Section>
        </section>

        <section
          className="jig-settings-panel jig-settings-appearance"
          aria-labelledby="appearance-heading"
        >
          <h2 id="appearance-heading">Appearance</h2>
          <Section
            className="jig-settings-card"
            minHeight={130}
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <Selector
                label="Theme"
                value={themePreset}
                options={THEME_OPTIONS}
                onChange={(value) => {
                  if (isThemePreset(value)) {
                    onThemePresetChange(value);
                  }
                }}
              />
              <SegmentedControl
                label="Appearance"
                value={appearanceMode}
                onChange={(value) => {
                  if (isAppearanceMode(value)) {
                    onAppearanceModeChange(value);
                  }
                }}
                layout="fill"
              >
                <SegmentedControlItem value="system" label="System" />
                <SegmentedControlItem value="light" label="Light" />
                <SegmentedControlItem value="dark" label="Dark" />
              </SegmentedControl>

              <div className="jig-settings-notifications">
                <div>
                  <strong>Browser notifications</strong>
                  <p>{notificationStatusMessage(notificationState)}</p>
                </div>
                {notificationState === "default" ? (
                  <Button
                    label="Enable"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void requestBrowserNotificationPermission().then(
                        setNotificationState,
                      );
                    }}
                  />
                ) : null}
              </div>
            </VStack>
          </Section>
        </section>

        <section
          className="jig-settings-panel jig-settings-diagnostics"
          aria-labelledby="diagnostics-heading"
        >
          <h2 id="diagnostics-heading">Diagnostics</h2>
          <Section
            className="jig-settings-card"
            minHeight={185}
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <dl className="jig-diagnostics">
              <div>
                <dt>Jig service</dt>
                <dd>{status?.ready ? "Healthy" : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Local database</dt>
                <dd>{diagnostics?.sqlite_available ? "Available" : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Portable data</dt>
                <dd>
                  {diagnostics?.repository_adapter_healthy
                    ? "Healthy"
                    : "Needs attention"}
                </dd>
              </div>
            </dl>
          </Section>
        </section>
      </div>

      <Section
        className="jig-local-first-note"
        variant="muted"
        padding={5}
        dividers={["top", "bottom", "start", "end"]}
      >
        <VStack gap={1.5}>
          <strong>Local-first behavior</strong>
          <p>Local planning remains usable when synchronization is unavailable.</p>
          <p>
            Browser notifications require explicit permission; unrelated repository
            content is never touched.
          </p>
        </VStack>
      </Section>
    </div>
  );
}
