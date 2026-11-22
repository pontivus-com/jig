import {
  Button,
  Section,
  Selector,
  SegmentedControl,
  SegmentedControlItem,
  VStack,
} from "@astryxdesign/core";

import { useEffect, useState } from "react";
import {
  formatSynchronizationDiagnostics,
  type Diagnostics,
  type ServiceStatus,
} from "../../src/protocol/runtime";
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
import { NotificationSettingsContent } from "./notification-settings-content";
import { copyText } from "./native/clipboard";
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
  readonly isOperating: boolean;
  readonly githubReconnectAvailable: boolean;
  readonly githubReconnect: GitHubReconnectSnapshot | null;
  readonly onThemePresetChange: (value: ThemePreset) => void;
  readonly onAppearanceModeChange: (value: AppearanceMode) => void;
  readonly onSync: () => Promise<void>;
  readonly onReconnectGitHub: () => Promise<void>;
  readonly showDiagnostics: boolean;
  readonly onShowDiagnosticsChange: (value: boolean) => void;
}

export function SettingsView({
  themePreset,
  appearanceMode,
  status,
  diagnostics,
  isOperating,
  githubReconnectAvailable,
  githubReconnect,
  onThemePresetChange,
  onAppearanceModeChange,
  onSync,
  onReconnectGitHub,
  showDiagnostics,
  onShowDiagnosticsChange,
}: SettingsViewProps): React.ReactElement {
  const [notificationState, setNotificationState] =
    useState<NotificationSettingsState | null>(null);
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
      <div className="jig-settings-sections">
        <section
          className="jig-settings-section"
          aria-labelledby="data-sync-heading"
        >
          <h2 id="data-sync-heading">Data &amp; sync</h2>
          <div className="jig-settings-group">
            <div className="jig-settings-row">
              <div>
                <strong>Planning data</strong>
                <p>{planningDataHome.label}</p>
                <small>{planningDataHome.detail}</small>
              </div>
            </div>

            <div className="jig-settings-row">
              <div>
                <strong>Saved on this device</strong>
                <p>{status === null ? "Status unavailable" : "Yes"}</p>
                <small>
                  Your current planning data remains available locally.
                </small>
              </div>
            </div>

            <div className="jig-settings-row">
              <div>
                <strong>Synchronization</strong>
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
              <div className="jig-settings-row-actions">
                <Button
                  label="Try reconnecting GitHub"
                  variant="secondary"
                  isLoading={isOperating}
                  onClick={() => {
                    void onReconnectGitHub();
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="jig-settings-section"
          aria-labelledby="appearance-heading"
        >
          <h2 id="appearance-heading">Appearance</h2>
          <div className="jig-settings-group jig-settings-control-stack">
            <Selector
              label="Theme"
              value={themePreset}
              options={THEME_OPTIONS}
              presentation="adaptive"
              controlClassName="jig-mobile-touch-control"
              renderOption={(option) => (
                <span className="jig-mobile-selector-option">
                  {option.label}
                </span>
              )}
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
                style={{ minHeight: "48px" }}
              />
              <SegmentedControlItem
                value="light"
                label="Light"
                style={{ minHeight: "48px" }}
              />
              <SegmentedControlItem
                value="dark"
                label="Dark"
                style={{ minHeight: "48px" }}
              />
            </SegmentedControl>
          </div>
        </section>

        <section
          className="jig-settings-section"
          aria-labelledby="notifications-heading"
        >
          <h2 id="notifications-heading">Notifications</h2>
          <div className="jig-settings-group">
            <NotificationSettingsContent
              state={notificationState}
              onEnable={() => {
                void requestNotificationPermission().then(
                  setNotificationState,
                );
              }}
              onOpenExactTimingSettings={() => {
                void openExactReminderSettings().then(
                  setNotificationState,
                );
              }}
            />
          </div>
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
              onClick={() => onShowDiagnosticsChange(!showDiagnostics)}
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
                  <div>
                    <dt>Synchronization phase</dt>
                    <dd>{diagnostics?.synchronization.phase ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Failure reason</dt>
                    <dd>{diagnostics?.synchronization.reason ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Retryable</dt>
                    <dd>
                      {diagnostics?.synchronization.retryable === null ||
                      diagnostics === null
                        ? "—"
                        : diagnostics.synchronization.retryable
                          ? "Yes"
                          : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt>Attempt count</dt>
                    <dd>{diagnostics?.synchronization.attempt_count ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Last attempt</dt>
                    <dd>{diagnostics?.synchronization.last_attempt_at ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Next retry</dt>
                    <dd>{diagnostics?.synchronization.next_retry_at ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Local Jig head</dt>
                    <dd>{diagnostics?.synchronization.local_head ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Remote Jig head</dt>
                    <dd>{diagnostics?.synchronization.remote_head ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Last adopted head</dt>
                    <dd>{diagnostics?.synchronization.last_adopted_head ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Lineage</dt>
                    <dd>{diagnostics?.synchronization.lineage ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Recovery</dt>
                    <dd>
                      {diagnostics?.synchronization.recovery_attempted
                        ? diagnostics.synchronization.recovery_outcome ??
                          "In progress"
                        : "Not attempted"}
                    </dd>
                  </div>
                  <div>
                    <dt>Adapter summary</dt>
                    <dd>{diagnostics?.synchronization.error_summary ?? "—"}</dd>
                  </div>
                </dl>
                <div className="jig-settings-diagnostics-actions">
                  <Button
                    label="Copy diagnostics"
                    variant="secondary"
                    isDisabled={diagnostics === null}
                    onClick={() => {
                      if (diagnostics === null) return;
                      void copyText(
                        formatSynchronizationDiagnostics(
                          diagnostics.synchronization,
                        ),
                      );
                    }}
                  />
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
