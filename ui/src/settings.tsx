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
import {
  localGitStatusPresentation,
  planningDataHomePresentation,
  remoteGitStatusPresentation,
  repositoryStatusPresentation,
} from "./repository-status";
import type { GitHubReconnectSnapshot } from "./setup-http";
import { GitHubDeviceFlowPanel } from "./github-device-flow";
import {
  openExactReminderSettings,
  readNotificationSettings,
  requestNotificationPermission,
  type NotificationSettingsState,
} from "./notification-settings";
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
}

function notificationStatusMessage(
  state: NotificationSettingsState | null,
): string {
  if (state === null) {
    return "Checking notification settings";
  }
  if (state.platform === "android") {
    switch (state.permission) {
      case "granted":
        return state.exact_alarm === "granted"
          ? "Enabled · exact timing available"
          : "Enabled · exact timing unavailable";
      case "permission-required":
        return "Notification permission required";
      case "denied":
        return "Blocked in Android settings";
    }
  }

  switch (state.permission) {
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
}: SettingsViewProps): React.ReactElement {
  const [notificationState, setNotificationState] =
    useState<NotificationSettingsState | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const repositoryStatus = repositoryStatusPresentation(status);
  const planningDataHome = planningDataHomePresentation(status);
  const localGitStatus = localGitStatusPresentation(status);
  const remoteGitStatus = remoteGitStatusPresentation(status);
  const synchronizationNeedsAttention =
    repositoryStatus.key === "sync-issue";

  useEffect(() => {
    let disposed = false;
    const refresh = (): void => {
      void readNotificationSettings()
        .then((next) => {
          if (!disposed) {
            setNotificationState(next);
          }
        })
        .catch(() => {
          if (!disposed) {
            setNotificationState(null);
          }
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <div className="jig-settings-view">
      {operationError === null ? null : (
        <Banner
          status="error"
          title="Operation failed"
          description={operationError}
          collapsible={false}
        />
      )}

      <div className="jig-settings-sections">
        <section
          className="jig-settings-section"
          aria-labelledby="data-sync-heading"
        >
          <h2 id="data-sync-heading">Data &amp; sync</h2>
          <Section
            className="jig-settings-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={4}>
              <div className="jig-settings-row">
                <div>
                  <strong>Planning-data home</strong>
                  <p>{planningDataHome.label}</p>
                  <small>{planningDataHome.detail}</small>
                </div>
              </div>

              <div className="jig-settings-row">
                <div>
                  <strong>Continuity</strong>
                  <p>{repositoryStatus.label}</p>
                  <small>{repositoryStatus.message}</small>
                </div>
                {synchronizationNeedsAttention &&
                githubReconnectAvailable &&
                githubReconnect === null ? (
                  <Button
                    label="Reconnect GitHub"
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void onReconnectGitHub();
                    }}
                  />
                ) : synchronizationNeedsAttention &&
                  !githubReconnectAvailable ? (
                  <Button
                    label="Try again"
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void onSync();
                    }}
                  />
                ) : null}
              </div>

              <GitHubDeviceFlowPanel
                authorization={githubReconnect?.authorization ?? null}
                purpose="reconnect"
              />

              {githubReconnect?.state === "attention" ? (
                <Button
                  label="Try reconnecting GitHub"
                  variant="secondary"
                  isLoading={isOperating}
                  onClick={() => {
                    void onReconnectGitHub();
                  }}
                />
              ) : null}

              <p className="jig-settings-safety-copy">
                Planning remains usable locally while synchronization is
                unavailable.
              </p>
            </VStack>
          </Section>
        </section>

        <section
          className="jig-settings-section"
          aria-labelledby="appearance-heading"
        >
          <h2 id="appearance-heading">Appearance</h2>
          <Section
            className="jig-settings-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <VStack gap={3}>
              <Selector
                label="Theme"
                value={themePreset}
                options={THEME_OPTIONS}
                controlClassName="jig-mobile-touch-control"
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
                <SegmentedControlItem
                  value="system"
                  label="System"
                  className="jig-mobile-touch-control"
                />
                <SegmentedControlItem
                  value="light"
                  label="Light"
                  className="jig-mobile-touch-control"
                />
                <SegmentedControlItem
                  value="dark"
                  label="Dark"
                  className="jig-mobile-touch-control"
                />
              </SegmentedControl>
            </VStack>
          </Section>
        </section>

        <section
          className="jig-settings-section"
          aria-labelledby="notifications-heading"
        >
          <h2 id="notifications-heading">Notifications</h2>
          <Section
            className="jig-settings-card"
            padding={5}
            dividers={["top", "bottom", "start", "end"]}
          >
            <div className="jig-settings-notifications">
              <div>
                <strong>
                  {notificationState?.platform === "android"
                    ? "Android notifications"
                    : "Browser notifications"}
                </strong>
                <p>{notificationStatusMessage(notificationState)}</p>
                {notificationState?.platform === "android" &&
                notificationState.permission === "granted" &&
                notificationState.exact_alarm === "unavailable" ? (
                  <small>
                    Future reminders are scheduled inexactly until exact
                    alarms are enabled in Android settings.
                  </small>
                ) : null}
              </div>

              <div className="jig-settings-row-actions">
                {notificationState?.permission === "default" ||
                (notificationState?.platform === "android" &&
                  notificationState.permission ===
                    "permission-required") ? (
                  <Button
                    label="Enable"
                    variant="secondary"
                    onClick={() => {
                      void requestNotificationPermission().then(
                        setNotificationState,
                      );
                    }}
                  />
                ) : null}
                {notificationState?.platform === "android" &&
                notificationState.permission === "granted" &&
                notificationState.exact_alarm === "unavailable" ? (
                  <Button
                    label="Exact timing settings"
                    variant="secondary"
                    onClick={() => {
                      void openExactReminderSettings().then(
                        setNotificationState,
                      );
                    }}
                  />
                ) : null}
              </div>
            </div>
          </Section>
        </section>

        <section
          className="jig-settings-section jig-settings-diagnostics"
          aria-labelledby="diagnostics-heading"
        >
          <div className="jig-settings-section-heading">
            <div>
              <h2 id="diagnostics-heading">Diagnostics</h2>
              <p>Technical repository and runtime details.</p>
            </div>
            <Button
              label={showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
              variant="ghost"
              onClick={() => setShowDiagnostics((current) => !current)}
            />
          </div>

          {showDiagnostics ? (
            <Section
              className="jig-settings-card"
              padding={5}
              dividers={["top", "bottom", "start", "end"]}
            >
              <VStack gap={3}>
                <dl className="jig-diagnostics">
                  <div>
                    <dt>Repository path</dt>
                    <dd>{status?.repository_path ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Jig service</dt>
                    <dd>{status?.ready ? "Healthy" : "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Local database</dt>
                    <dd>
                      {diagnostics?.sqlite_available
                        ? "Available"
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Portable data</dt>
                    <dd>
                      {diagnostics?.repository_adapter_healthy
                        ? "Healthy"
                        : "Needs attention"}
                    </dd>
                  </div>
                  <div>
                    <dt>Local Git</dt>
                    <dd title={localGitStatus.message}>
                      {localGitStatus.label}
                    </dd>
                  </div>
                  <div>
                    <dt>Remote Git</dt>
                    <dd title={remoteGitStatus.message}>
                      {remoteGitStatus.label}
                    </dd>
                  </div>
                  {remoteGitStatus.remoteLocation === null ? null : (
                    <div>
                      <dt>Remote repository</dt>
                      <dd>
                        <span>{remoteGitStatus.remoteLocation}</span>
                        <small className="jig-settings-remote-name">
                          Git remote: {remoteGitStatus.remoteName}
                        </small>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="jig-settings-diagnostics-actions">
                  <Button
                    label="Sync now"
                    variant="secondary"
                    isLoading={isOperating}
                    onClick={() => {
                      void onSync();
                    }}
                  />
                </div>
              </VStack>
            </Section>
          ) : null}
        </section>
      </div>
    </div>
  );
}
