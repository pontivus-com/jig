import { Capacitor } from "@capacitor/core";
import * as nativeRuntime from "./runtime-native";
import * as webRuntime from "./http";

const configuredRuntime = Capacitor.isNativePlatform()
  ? nativeRuntime
  : webRuntime;

export const readCanonicalTasks: typeof webRuntime.readCanonicalTasks =
  (...args) => configuredRuntime.readCanonicalTasks(...args);

export const readStatus: typeof webRuntime.readStatus =
  (...args) => configuredRuntime.readStatus(...args);

export const readDiagnostics: typeof webRuntime.readDiagnostics =
  (...args) => configuredRuntime.readDiagnostics(...args);

export const submitTaskCommand: typeof webRuntime.submitTaskCommand =
  (...args) => configuredRuntime.submitTaskCommand(...args);

export const triggerSync: typeof webRuntime.triggerSync =
  (...args) => configuredRuntime.triggerSync(...args);
