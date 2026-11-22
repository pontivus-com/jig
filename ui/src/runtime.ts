import { Capacitor } from "@capacitor/core";
import type { Task } from "../../src/core/task";
import type { CanonicalState } from "../../src/protocol";
import * as webRuntime from "./http";

async function androidRuntime() {
  return import("./runtime-native");
}

export const readCanonicalTasks: typeof webRuntime.readCanonicalTasks =
  (...args) =>
    Capacitor.isNativePlatform()
      ? androidRuntime().then((runtime) =>
          runtime.readCanonicalTasks(...args),
        )
      : webRuntime.readCanonicalTasks(...args);

export const readStatus: typeof webRuntime.readStatus =
  (...args) =>
    Capacitor.isNativePlatform()
      ? androidRuntime().then((runtime) =>
          runtime.readStatus(...args),
        )
      : webRuntime.readStatus(...args);

export const readDiagnostics: typeof webRuntime.readDiagnostics =
  (...args) =>
    Capacitor.isNativePlatform()
      ? androidRuntime().then((runtime) =>
          runtime.readDiagnostics(...args),
        )
      : webRuntime.readDiagnostics(...args);

export const submitTaskCommand: typeof webRuntime.submitTaskCommand =
  (...args) =>
    Capacitor.isNativePlatform()
      ? androidRuntime().then((runtime) =>
          runtime.submitTaskCommand(...args),
        )
      : webRuntime.submitTaskCommand(...args);

export const triggerSync: typeof webRuntime.triggerSync =
  (...args) =>
    Capacitor.isNativePlatform()
      ? androidRuntime().then((runtime) =>
          runtime.triggerSync(...args),
        )
      : webRuntime.triggerSync(...args);


export function usesNativeReminderDelivery(): boolean {
  return Capacitor.isNativePlatform();
}

export async function installRuntimeReminderDisplayObserver(
  onReceived: (taskId: string, fingerprint: string) => void,
): Promise<(() => Promise<void>) | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  const capability = await import("./native/reminder-capability");
  return capability.installAndroidReminderDisplayObserver(onReceived);
}

export async function requestRuntimeDueReminderDisplay(
  task: Task,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  const capability = await import("./native/reminder-capability");
  return (
    await capability.requestAndroidDueReminderDisplay(task)
  ) === "display-requested";
}

export async function rollForwardRuntimeLocalDay(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  return (await androidRuntime()).rollForwardRuntimeLocalDay();
}

export async function readCanonicalTasksAfterActivationRollover():
Promise<CanonicalState> {
  if (!Capacitor.isNativePlatform()) {
    return webRuntime.readCanonicalTasks();
  }
  return (await androidRuntime()).readCanonicalTasksAfterActivationRollover();
}

export async function reconcileRuntimeReminders(
  tasks: CanonicalState["tasks"],
  now: Date,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  await (await androidRuntime()).reconcileRuntimeReminders(tasks, now);
}
