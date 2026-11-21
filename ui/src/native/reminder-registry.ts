import { registerPlugin } from "@capacitor/core";

export interface AndroidReminderRegistryEntry {
  readonly task_id: string;
  readonly notification_id: number;
  readonly fingerprint: string;
}

export interface AndroidReminderRegistryPort {
  readonly list: () => Promise<{
    readonly entries: readonly unknown[];
  }>;
  readonly allocate: () => Promise<{
    readonly notification_id: number;
  }>;
  readonly put: (entry: AndroidReminderRegistryEntry) => Promise<void>;
  readonly remove: (options: {
    readonly task_id: string;
  }) => Promise<void>;
}

const nativeReminderRegistry =
  registerPlugin<AndroidReminderRegistryPort>(
    "JigNotificationRegistry",
  );

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function parseEntry(
  value: unknown,
): AndroidReminderRegistryEntry {
  const object = recordValue(value);
  if (
    object === null ||
    typeof object.task_id !== "string" ||
    object.task_id.length === 0 ||
    typeof object.notification_id !== "number" ||
    !Number.isInteger(object.notification_id) ||
    typeof object.fingerprint !== "string" ||
    object.fingerprint.length === 0
  ) {
    throw new Error(
      "Stored Android reminder registry entry is invalid",
    );
  }
  return {
    task_id: object.task_id,
    notification_id: object.notification_id,
    fingerprint: object.fingerprint,
  };
}

export async function readAndroidReminderRegistry(
  port: AndroidReminderRegistryPort = nativeReminderRegistry,
): Promise<readonly AndroidReminderRegistryEntry[]> {
  const result = await port.list();
  return result.entries.map(parseEntry);
}

export async function allocateAndroidReminderId(
  port: AndroidReminderRegistryPort = nativeReminderRegistry,
): Promise<number> {
  const result = await port.allocate();
  if (
    !Number.isInteger(result.notification_id) ||
    result.notification_id < -2147483648 ||
    result.notification_id > 2147483647
  ) {
    throw new Error(
      "Android reminder registry returned an invalid notification id",
    );
  }
  return result.notification_id;
}

export async function writeAndroidReminderRegistry(
  entry: AndroidReminderRegistryEntry,
  port: AndroidReminderRegistryPort = nativeReminderRegistry,
): Promise<void> {
  await port.put(entry);
}

export async function removeAndroidReminderRegistry(
  taskId: string,
  port: AndroidReminderRegistryPort = nativeReminderRegistry,
): Promise<void> {
  await port.remove({ task_id: taskId });
}
