import { registerPlugin, Capacitor } from "@capacitor/core";
import { useTheme } from "@astryxdesign/core/theme";
import { useEffect } from "react";

interface NativeSystemBarsPort {
  readonly setAppearance: (options: {
    readonly mode: "light" | "dark";
    readonly backgroundColor: string;
  }) => Promise<void>;
}

const nativeSystemBars = registerPlugin<NativeSystemBarsPort>(
  "JigSystemBars",
);

export function NativeSystemBars(): null {
  const { mode, token } = useTheme();
  const backgroundColor = token("--jig-chrome-surface");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    void nativeSystemBars.setAppearance({
      mode,
      backgroundColor,
    }).catch(() => undefined);
  }, [backgroundColor, mode]);

  return null;
}
