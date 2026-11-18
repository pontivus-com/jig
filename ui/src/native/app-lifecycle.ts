import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

export type ActiveListenerCleanup = () => Promise<void>;

export async function installNativeActiveListener(
  onActive: () => void,
): Promise<ActiveListenerCleanup> {
  if (!Capacitor.isNativePlatform()) {
    return async () => undefined;
  }

  const handle: PluginListenerHandle = await App.addListener(
    "appStateChange",
    (state) => {
      if (state.isActive) {
        onActive();
      }
    },
  );

  return async () => handle.remove();
}
