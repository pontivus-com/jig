import { Button } from "@astryxdesign/core";
import type { NotificationSettingsState } from "./notification-settings";

export interface NotificationSettingsPresentation {
  readonly label: "Notifications" | "Browser notifications" | "Android notifications";
  readonly status: string;
  readonly detail: string | null;
  readonly action: "enable" | "exact-settings" | null;
}

export function notificationSettingsPresentation(
  state: NotificationSettingsState | null,
): NotificationSettingsPresentation {
  if (state === null) {
    return {
      label: "Notifications",
      status: "Checking notification settings",
      detail: null,
      action: null,
    };
  }

  if (state.platform === "browser") {
    switch (state.permission) {
      case "unsupported":
        return {
          label: "Browser notifications",
          status: "Not supported by this browser",
          detail: null,
          action: null,
        };
      case "default":
        return {
          label: "Browser notifications",
          status: "Not enabled",
          detail: null,
          action: "enable",
        };
      case "granted":
        return {
          label: "Browser notifications",
          status: "Enabled",
          detail: null,
          action: null,
        };
      case "denied":
        return {
          label: "Browser notifications",
          status: "Blocked in browser settings",
          detail: null,
          action: null,
        };
    }
  }

  switch (state.permission) {
    case "permission-required":
      return {
        label: "Android notifications",
        status: "Notification permission required",
        detail: null,
        action: "enable",
      };
    case "denied":
      return {
        label: "Android notifications",
        status: "Blocked in Android settings",
        detail: null,
        action: null,
      };
    case "granted":
      return state.exact_alarm === "granted"
        ? {
            label: "Android notifications",
            status: "Enabled · exact timing available",
            detail: null,
            action: null,
          }
        : {
            label: "Android notifications",
            status: "Enabled · exact timing unavailable",
            detail:
              "Future reminders are scheduled inexactly until exact alarms are enabled in Android settings.",
            action: "exact-settings",
          };
  }
}

export interface NotificationSettingsContentProps {
  readonly state: NotificationSettingsState | null;
  readonly onEnable: () => void;
  readonly onOpenExactTimingSettings: () => void;
}

export function NotificationSettingsContent({
  state,
  onEnable,
  onOpenExactTimingSettings,
}: NotificationSettingsContentProps): React.ReactElement {
  const presentation = notificationSettingsPresentation(state);

  return (
    <div className="jig-settings-notifications">
      <div>
        <strong>{presentation.label}</strong>
        <p>{presentation.status}</p>
        {presentation.detail === null ? null : (
          <small>{presentation.detail}</small>
        )}
      </div>
      <div className="jig-settings-row-actions">
        {presentation.action === "enable" ? (
          <Button
            label="Enable"
            variant="secondary"
            onClick={onEnable}
          />
        ) : presentation.action === "exact-settings" ? (
          <Button
            label="Exact timing settings"
            variant="secondary"
            onClick={onOpenExactTimingSettings}
          />
        ) : null}
      </div>
    </div>
  );
}
