import { Capacitor } from "@capacitor/core";
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
