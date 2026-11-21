import {
  Capacitor,
  registerPlugin,
} from "@capacitor/core";

interface NativeClipboardPort {
  readonly write: (options: {
    readonly text: string;
  }) => Promise<void>;
}

const nativeClipboard = registerPlugin<NativeClipboardPort>(
  "JigClipboard",
);

export async function copyText(
  text: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await nativeClipboard.write({ text });
    return;
  }

  if (typeof navigator.clipboard?.writeText !== "function") {
    throw new Error("Clipboard access is unavailable");
  }
  await navigator.clipboard.writeText(text);
}

export function nativeClipboardAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
