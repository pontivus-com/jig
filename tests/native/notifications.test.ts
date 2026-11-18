import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  androidReminderFingerprint,
  isFutureAndroidReminder,
  readAndroidReminderPermission,
  scheduleAndroidTaskReminder,
  type AndroidLocalNotificationsPort,
} from "../../ui/src/native/notifications";

function task(
  reminderTime: string | null = "10:00",
): Task {
  return {
    id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f5001",
    title: "Native reminder",
    scheduled_date: "2026-11-19",
    position: 0,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: reminderTime,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-18T01:00:00.000Z",
    updated_at: "2026-11-18T01:00:00.000Z",
  };
}

function port(options: {
  readonly permission?: "granted" | "denied" | "prompt";
  readonly exact?: "granted" | "denied";
  readonly scheduleFails?: boolean;
  readonly warning?: boolean;
} = {}): {
  readonly port: AndroidLocalNotificationsPort;
  readonly scheduled: unknown[];
} {
  const scheduled: unknown[] = [];
  const permission = options.permission ?? "granted";
  const exact = options.exact ?? "granted";
  return {
    scheduled,
    port: {
      schedule: async (request) => {
        if (options.scheduleFails === true) {
          throw new Error("schedule failed");
        }
        scheduled.push(request);
        return {
          notifications: request.notifications.map(
            (notification) => ({ id: notification.id }),
          ),
          ...(options.warning === true
            ? {
                warning: {
                  code: "OS-PLUG-LNOT-0017",
                  message: "scheduled inexactly",
                },
              }
            : {}),
        };
      },
      getPending: async () => ({ notifications: [] }),
      cancel: async () => undefined,
      checkPermissions: async () => ({
        display: permission,
      }),
      requestPermissions: async () => ({
        display: permission,
      }),
      checkExactNotificationSetting: async () => ({
        exact_alarm: exact,
      }),
      changeExactNotificationSetting: async () => ({
        exact_alarm: exact,
      }),
    },
  };
}

describe("Android reminder scheduling adapter", () => {
  it("reports exact scheduling only when permission and exact settings allow it", async () => {
    const fixture = port();
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100001,
        new Date("2026-11-18T09:00:00"),
        fixture.port,
      ),
    ).resolves.toBe("scheduled-exact");

    expect(fixture.scheduled).toHaveLength(1);
    expect(fixture.scheduled[0]).toMatchObject({
      notifications: [
        {
          id: 100001,
          isExactNotification: true,
          isExactMandatory: false,
          extra: {
            jig_task_id:
              "018f47f0-7b5c-7d4d-8e2b-9c3aa11f5001",
            jig_reminder_fingerprint:
              "2026-11-19|10:00",
          },
        },
      ],
    });
  });

  it("uses honest inexact scheduling when exact alarms are unavailable", async () => {
    const fixture = port({ exact: "denied" });
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100002,
        new Date("2026-11-18T09:00:00"),
        fixture.port,
      ),
    ).resolves.toBe("scheduled-inexact");

    expect(fixture.scheduled[0]).toMatchObject({
      notifications: [
        {
          id: 100002,
          isExactNotification: false,
        },
      ],
    });
  });

  it("treats an exact-fallback plugin warning as scheduled-inexact", async () => {
    const fixture = port({ warning: true });
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100003,
        new Date("2026-11-18T09:00:00"),
        fixture.port,
      ),
    ).resolves.toBe("scheduled-inexact");
  });

  it("returns permission-required or denied without scheduling", async () => {
    const prompt = port({ permission: "prompt" });
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100004,
        new Date("2026-11-18T09:00:00"),
        prompt.port,
      ),
    ).resolves.toBe("permission-required");
    expect(prompt.scheduled).toEqual([]);

    const denied = port({ permission: "denied" });
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100005,
        new Date("2026-11-18T09:00:00"),
        denied.port,
      ),
    ).resolves.toBe("denied");
    expect(denied.scheduled).toEqual([]);
  });

  it("returns failed for plugin rejection and past-due reminders", async () => {
    const failing = port({ scheduleFails: true });
    await expect(
      scheduleAndroidTaskReminder(
        task(),
        100006,
        new Date("2026-11-18T09:00:00"),
        failing.port,
      ),
    ).resolves.toBe("failed");

    const past = task("08:00");
    const today: Task = {
      ...past,
      scheduled_date: "2026-11-18",
    };
    expect(
      isFutureAndroidReminder(
        today,
        new Date("2026-11-18T09:00:00"),
      ),
    ).toBe(false);
    await expect(
      scheduleAndroidTaskReminder(
        today,
        100007,
        new Date("2026-11-18T09:00:00"),
        port().port,
      ),
    ).resolves.toBe("failed");
  });

  it("reports permission and exact-alarm capability independently", async () => {
    await expect(
      readAndroidReminderPermission(
        port({
          permission: "granted",
          exact: "denied",
        }).port,
      ),
    ).resolves.toStrictEqual({
      permission: "granted",
      exact_alarm: "unavailable",
    });
    expect(androidReminderFingerprint(task())).toBe(
      "2026-11-19|10:00",
    );
  });
});
