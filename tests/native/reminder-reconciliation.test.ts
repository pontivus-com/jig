import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  reconcileAndroidReminders,
} from "../../ui/src/native/reminder-reconciliation";
import type {
  AndroidReminderRegistryEntry,
  AndroidReminderRegistryPort,
} from "../../ui/src/native/reminder-registry";
import type {
  AndroidLocalNotificationsPort,
} from "../../ui/src/native/notifications";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f5101",
    title: "Reconcile me",
    scheduled_date: "2026-11-19",
    position: 0,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-18T01:00:00.000Z",
    updated_at: "2026-11-18T01:00:00.000Z",
    ...overrides,
  };
}

function registryFixture(): {
  readonly port: AndroidReminderRegistryPort;
  readonly entries: Map<string, AndroidReminderRegistryEntry>;
} {
  const entries = new Map<string, AndroidReminderRegistryEntry>();
  let next = 100000;
  return {
    entries,
    port: {
      list: async () => ({
        entries: [...entries.values()],
      }),
      allocate: async () => ({
        notification_id: next++,
      }),
      put: async (entry) => {
        entries.set(entry.task_id, entry);
      },
      remove: async ({ task_id }) => {
        entries.delete(task_id);
      },
    },
  };
}

function notificationFixture(options: {
  readonly permission?: "granted" | "denied" | "prompt";
  readonly exact?: "granted" | "denied";
} = {}): {
  readonly port: AndroidLocalNotificationsPort;
  readonly pending: Map<
    number,
    {
      readonly id: number;
      readonly title: string;
      readonly body: string;
      readonly extra: {
        readonly jig_task_id: string;
        readonly jig_reminder_fingerprint: string | null;
      };
    }
  >;
  readonly cancelled: number[];
} {
  const pending = new Map<
    number,
    {
      readonly id: number;
      readonly title: string;
      readonly body: string;
      readonly extra: {
        readonly jig_task_id: string;
        readonly jig_reminder_fingerprint: string | null;
      };
    }
  >();
  const cancelled: number[] = [];
  const permission = options.permission ?? "granted";
  const exact = options.exact ?? "granted";
  return {
    pending,
    cancelled,
    port: {
      schedule: async ({ notifications }) => {
        for (const notification of notifications) {
          const extra =
            notification.extra !== null &&
            typeof notification.extra === "object" &&
            !Array.isArray(notification.extra)
              ? Object.fromEntries(
                  Object.entries(notification.extra),
                )
              : {};
          pending.set(notification.id, {
            id: notification.id,
            title: notification.title,
            body: notification.body ?? "",
            extra: {
              jig_task_id:
                typeof extra.jig_task_id === "string"
                  ? extra.jig_task_id
                  : "",
              jig_reminder_fingerprint:
                typeof extra.jig_reminder_fingerprint === "string"
                  ? extra.jig_reminder_fingerprint
                  : null,
            },
          });
        }
        return {
          notifications: notifications.map(({ id }) => ({ id })),
        };
      },
      getPending: async () => ({
        notifications: [...pending.values()],
      }),
      cancel: async ({ notifications }) => {
        for (const notification of notifications) {
          cancelled.push(notification.id);
          pending.delete(notification.id);
        }
      },
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

const NOW = new Date("2026-11-18T09:00:00");

describe("Android reminder reconciliation", () => {
  it("schedules a future canonical reminder and records its side-effect fingerprint", async () => {
    const registry = registryFixture();
    const notifications = notificationFixture();

    const result = await reconcileAndroidReminders(
      [task()],
      NOW,
      notifications.port,
      registry.port,
    );

    expect(result.scheduled).toStrictEqual({
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f5101":
        "scheduled-exact",
    });
    expect(registry.entries.get(task().id)).toStrictEqual({
      task_id: task().id,
      notification_id: 100000,
      fingerprint: "2026-11-19|10:00",
    });
    expect(notifications.pending.has(100000)).toBe(true);
  });

  it("cancels and replaces a stale schedule after reminder edit", async () => {
    const registry = registryFixture();
    const notifications = notificationFixture();

    await reconcileAndroidReminders(
      [task()],
      NOW,
      notifications.port,
      registry.port,
    );
    const edited = task({
      reminder_time: "11:30",
      updated_at: "2026-11-18T02:00:00.000Z",
    });
    const result = await reconcileAndroidReminders(
      [edited],
      NOW,
      notifications.port,
      registry.port,
    );

    expect(result.cancelled_task_ids).toEqual([edited.id]);
    expect(notifications.cancelled).toContain(100000);
    expect(registry.entries.get(edited.id)).toStrictEqual({
      task_id: edited.id,
      notification_id: 100001,
      fingerprint: "2026-11-19|11:30",
    });
    expect(notifications.pending.has(100001)).toBe(true);
  });

  it("cancels a pending notification after completion without rolling canonical state", async () => {
    const registry = registryFixture();
    const notifications = notificationFixture();
    const original = task();
    await reconcileAndroidReminders(
      [original],
      NOW,
      notifications.port,
      registry.port,
    );

    const completed = task({
      position: null,
      completed_at: "2026-11-18T10:00:00.000Z",
      updated_at: "2026-11-18T10:00:00.000Z",
    });
    const result = await reconcileAndroidReminders(
      [completed],
      NOW,
      notifications.port,
      registry.port,
    );

    expect(result.scheduled).toStrictEqual({});
    expect(result.cancelled_task_ids).toEqual([completed.id]);
    expect(registry.entries.size).toBe(0);
    expect(notifications.pending.size).toBe(0);
  });

  it("repairs missing registry state by cancelling orphan Jig reminders and rescheduling", async () => {
    const registry = registryFixture();
    const notifications = notificationFixture();
    notifications.pending.set(77, {
      id: 77,
      title: "Jig reminder",
      body: "Reconcile me",
      extra: {
        jig_task_id: task().id,
        jig_reminder_fingerprint: "2026-11-19|10:00",
      },
    });

    await reconcileAndroidReminders(
      [task()],
      NOW,
      notifications.port,
      registry.port,
    );

    expect(notifications.cancelled).toContain(77);
    expect(registry.entries.get(task().id)?.notification_id)
      .toBe(100000);
    expect(notifications.pending.has(100000)).toBe(true);
  });

  it("does not persist a registry entry when permission is missing", async () => {
    const registry = registryFixture();
    const notifications = notificationFixture({
      permission: "prompt",
    });

    const result = await reconcileAndroidReminders(
      [task()],
      NOW,
      notifications.port,
      registry.port,
    );

    expect(result.scheduled[task().id]).toBe(
      "permission-required",
    );
    expect(registry.entries.size).toBe(0);
    expect(notifications.pending.size).toBe(0);
  });
});
