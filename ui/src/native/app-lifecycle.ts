import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

export type ActiveListenerCleanup = () => Promise<void>;
export type NativeBackButtonCleanup = () => Promise<void>;

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

export async function installNativeBackButtonListener(
  onBack: () => boolean,
): Promise<NativeBackButtonCleanup> {
  if (!Capacitor.isNativePlatform()) {
    return async () => undefined;
  }

  const handle: PluginListenerHandle = await App.addListener(
    "backButton",
    (event) => {
      if (onBack()) {
        return;
      }
      if (event.canGoBack) {
        window.history.back();
        return;
      }
      void App.exitApp();
    },
  );

  return async () => handle.remove();
}
