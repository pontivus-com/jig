import { describe, expect, it } from "vitest";
import {
  notificationSettingsPresentation,
  type NotificationSettingsPresentation,
} from "../../ui/src/notification-settings-content";
import type { NotificationSettingsState } from "../../ui/src/notification-settings";

describe("notification Settings capability presentation", () => {
  const cases: readonly {
    readonly name: string;
    readonly state: NotificationSettingsState;
    readonly expected: NotificationSettingsPresentation;
  }[] = [
    {
      name: "browser unsupported",
      state: {
        platform: "browser",
        permission: "unsupported",
        exact_alarm: null,
      },
      expected: {
        label: "Browser notifications",
        status: "Not supported by this browser",
        detail: null,
        action: null,
      },
    },
    {
      name: "browser permission required",
      state: {
        platform: "browser",
        permission: "default",
        exact_alarm: null,
      },
      expected: {
        label: "Browser notifications",
        status: "Not enabled",
        detail: null,
        action: "enable",
      },
    },
    {
      name: "browser granted",
      state: {
        platform: "browser",
        permission: "granted",
        exact_alarm: null,
      },
      expected: {
        label: "Browser notifications",
        status: "Enabled",
        detail: null,
        action: null,
      },
    },
    {
      name: "browser denied",
      state: {
        platform: "browser",
        permission: "denied",
        exact_alarm: null,
      },
      expected: {
        label: "Browser notifications",
        status: "Blocked in browser settings",
        detail: null,
        action: null,
      },
    },
    {
      name: "Android permission required",
      state: {
        platform: "android",
        permission: "permission-required",
        exact_alarm: "unavailable",
      },
      expected: {
        label: "Android notifications",
        status: "Notification permission required",
        detail: null,
        action: "enable",
      },
    },
    {
      name: "Android denied",
      state: {
        platform: "android",
        permission: "denied",
        exact_alarm: "unavailable",
      },
      expected: {
        label: "Android notifications",
        status: "Blocked in Android settings",
        detail: null,
        action: null,
      },
    },
    {
      name: "Android exact timing granted",
      state: {
        platform: "android",
        permission: "granted",
        exact_alarm: "granted",
      },
      expected: {
        label: "Android notifications",
        status: "Enabled · exact timing available",
        detail: null,
        action: null,
      },
    },
    {
      name: "Android exact timing unavailable",
      state: {
        platform: "android",
        permission: "granted",
        exact_alarm: "unavailable",
      },
      expected: {
        label: "Android notifications",
        status: "Enabled · exact timing unavailable",
        detail:
          "Future reminders are scheduled inexactly until exact alarms are enabled in Android settings.",
        action: "exact-settings",
      },
    },
  ];

  for (const fixture of cases) {
    it(fixture.name, () => {
      expect(notificationSettingsPresentation(fixture.state)).toStrictEqual(
        fixture.expected,
      );
    });
  }

  it("keeps loading state platform-neutral", () => {
    expect(notificationSettingsPresentation(null)).toStrictEqual({
      label: "Notifications",
      status: "Checking notification settings",
      detail: null,
      action: null,
    });
  });
});
