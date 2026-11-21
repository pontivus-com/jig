import {
  Capacitor,
  registerPlugin,
} from "@capacitor/core";

interface NativeBrowserPort {
  readonly openChrome: (options: {
    readonly url: string;
  }) => Promise<void>;
}

const nativeBrowser = registerPlugin<NativeBrowserPort>(
  "JigBrowser",
);

export async function openVerificationUri(
  url: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await nativeBrowser.openChrome({ url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
