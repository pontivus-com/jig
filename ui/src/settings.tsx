import {
  Banner,
  Button,
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core";
import { useEffect, useState } from "react";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/shell/http";
import {
  browserNotificationState,
  requestBrowserNotificationPermission,
  type BrowserNotificationState,
} from "./browser-notifications";

export type ThemePreference = "system" | "light" | "dark";

export interface SettingsViewProps {
  readonly themePreference: ThemePreference;
  readonly status: ServiceStatus | null;
  readonly diagnostics: Diagnostics | null;
  readonly operationError: string | null;
  readonly isOperating: boolean;
  readonly onThemePreferenceChange: (value: ThemePreference) => void;
  readonly onSync: () => Promise<void>;
}

function statusMessage(status: ServiceStatus | null): string {
  switch (status?.repository_status) {
    case "local-only":
      return "Saved locally. Repository synchronization is not currently available.";
    case "pending":
      return "Saved locally. Repository synchronization is pending.";
    case "retrying":
      return "Saved locally. Repository synchronization is retrying.";
    case "synchronized":
      return "Local planning data and the configured repository are synchronized.";
    case "sync-issue":
      return "Local planning data is safe. Repository synchronization currently has an operational issue.";
    default:
      return "Repository status is unavailable.";
  }
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
  themePreference,
  status,
  diagnostics,
  operationError,
  isOperating,
  onThemePreferenceChange,
  onSync,
}: SettingsViewProps): React.ReactElement {
  const [notificationState, setNotificationState] =
    useState<BrowserNotificationState>(browserNotificationState);

  useEffect(() => {
    const refresh = (): void => {
      setNotificationState(browserNotificationState());
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return (
    <div className="jig-settings-view">
      <div className="jig-view-heading">
        <div>
          <p className="jig-eyebrow">Settings</p>
          <h1>Jig settings</h1>
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

      <section className="jig-settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <SegmentedControl
          label="Appearance"
          value={themePreference}
          onChange={(value) =>
            onThemePreferenceChange(value as ThemePreference)
          }
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
      </section>

      <section className="jig-settings-section" aria-labelledby="planning-data-heading">
        <h2 id="planning-data-heading">Planning data</h2>
        <dl className="jig-diagnostics">
          <div>
            <dt>Repository</dt>
            <dd>{status?.repository_path ?? "Unavailable"}</dd>
          </div>
        </dl>
      </section>

      <section className="jig-settings-section" aria-labelledby="sync-heading">
        <h2 id="sync-heading">Synchronization</h2>
        <p>{statusMessage(status)}</p>
        <Button
          label="Sync now"
          variant="secondary"
          isLoading={isOperating}
          onClick={() => {
            void onSync();
          }}
        />
      </section>

      <section className="jig-settings-section" aria-labelledby="diagnostics-heading">
        <h2 id="diagnostics-heading">Diagnostics</h2>
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
      </section>>

    </div>
  );
}
