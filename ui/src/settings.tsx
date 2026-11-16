import {
  Banner,
  Button,
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/shell/http";

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
      return "Saved locally. No repository remote is configured.";
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

export function SettingsView({
  themePreference,
  status,
  diagnostics,
  operationError,
  isOperating,
  onThemePreferenceChange,
  onSync,
}: SettingsViewProps): React.ReactElement {
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
      </section>

      <section className="jig-settings-section" aria-labelledby="sync-heading">
        <h2 id="sync-heading">Repository synchronization</h2>
        <p>{statusMessage(status)}</p>
        <dl className="jig-diagnostics">
          <div>
            <dt>Repository</dt>
            <dd>{status?.repository_path ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Remote</dt>
            <dd>{status?.remote_configured ? "Configured" : "Not configured"}</dd>
          </div>
          <div>
            <dt>Local database</dt>
            <dd>{diagnostics?.sqlite_available ? "Available" : "Unavailable"}</dd>
          </div>
          <div>
            <dt>Repository adapter</dt>
            <dd>
              {diagnostics?.repository_adapter_healthy
                ? "Healthy"
                : "Needs attention"}
            </dd>
          </div>
        </dl>
        <Button
          label="Sync now"
          variant="secondary"
          isLoading={isOperating}
          onClick={() => {
            void onSync();
          }}
        />
      </section>

    </div>
  );
}
