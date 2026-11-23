import { beforeEach, describe, expect, it, vi } from "vitest";

type ListenerPayload = {
  readonly isActive?: boolean;
  readonly canGoBack?: boolean;
};

type Listener = (payload: ListenerPayload) => void;

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  addListener: vi.fn(),
  exitApp: vi.fn(async () => undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addListener,
    exitApp: mocks.exitApp,
  },
}));

import {
  installNativeActiveListener,
  installNativeBackButtonListener,
} from "../../ui/src/native/app-lifecycle";

describe("native app lifecycle adapter", () => {
  let appStateListener: Listener | null;
  let backListener: Listener | null;
  let remove: ReturnType<typeof vi.fn>;
  let historyBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    appStateListener = null;
    backListener = null;
    remove = vi.fn(async () => undefined);
    historyBack = vi.fn();

    mocks.isNativePlatform.mockReturnValue(true);
    mocks.exitApp.mockClear();
    mocks.addListener.mockReset();
    mocks.addListener.mockImplementation(
      async (eventName: string, listener: Listener) => {
        if (eventName === "appStateChange") {
          appStateListener = listener;
        } else if (eventName === "backButton") {
          backListener = listener;
        } else {
          throw new Error(`unexpected App listener: ${eventName}`);
        }
        return { remove };
      },
    );

    vi.stubGlobal("window", {
      history: {
        back: historyBack,
      },
    });
  });

  it("does not register Capacitor lifecycle listeners outside native runtime", async () => {
    mocks.isNativePlatform.mockReturnValue(false);

    const removeActive = await installNativeActiveListener(() => undefined);
    const removeBack = await installNativeBackButtonListener(() => false);

    expect(mocks.addListener).not.toHaveBeenCalled();
    await removeActive();
    await removeBack();
  });

  it("delivers one configured activation only when the app becomes active", async () => {
    const onActive = vi.fn();
    const cleanup = await installNativeActiveListener(onActive);

    expect(mocks.addListener).toHaveBeenCalledTimes(1);
    expect(mocks.addListener).toHaveBeenCalledWith(
      "appStateChange",
      expect.any(Function),
    );
    if (appStateListener === null) {
      throw new Error("appStateChange listener was not installed");
    }

    appStateListener({ isActive: false });
    expect(onActive).not.toHaveBeenCalled();

    appStateListener({ isActive: true });
    expect(onActive).toHaveBeenCalledTimes(1);

    await cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("lets the shared Jig Back owner consume Back before platform history", async () => {
    const onBack = vi.fn(() => true);
    const cleanup = await installNativeBackButtonListener(onBack);

    if (backListener === null) {
      throw new Error("backButton listener was not installed");
    }
    backListener({ canGoBack: true });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(historyBack).not.toHaveBeenCalled();
    expect(mocks.exitApp).not.toHaveBeenCalled();

    await cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("delegates unconsumed Back to WebView history before native exit", async () => {
    const cleanup = await installNativeBackButtonListener(() => false);

    if (backListener === null) {
      throw new Error("backButton listener was not installed");
    }
    backListener({ canGoBack: true });

    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(mocks.exitApp).not.toHaveBeenCalled();

    await cleanup();
  });

  it("exits only when Jig and WebView history cannot consume Back", async () => {
    const cleanup = await installNativeBackButtonListener(() => false);

    if (backListener === null) {
      throw new Error("backButton listener was not installed");
    }
    backListener({ canGoBack: false });

    expect(historyBack).not.toHaveBeenCalled();
    expect(mocks.exitApp).toHaveBeenCalledTimes(1);

    await cleanup();
  });
});
