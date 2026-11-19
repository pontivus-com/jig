import type { GitHubReconnectSnapshot } from "./github";
import {
  GitHubDeviceFlowSession,
  GitHubFlowWakeup,
} from "./github-device-flow";

type Sleep = (milliseconds: number) => Promise<void>;

export interface GitHubReconnectDependencies {
  readonly sleep?: Sleep;
  readonly on_connected?: () => Promise<void> | void;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class GitHubReconnectController {
  private state: GitHubReconnectSnapshot["state"] = "initial";
  private error: string | null = null;
  private worker: Promise<void> | null = null;
  private readonly wakeup = new GitHubFlowWakeup();

  constructor(
    private readonly deviceFlow: GitHubDeviceFlowSession,
    private readonly dependencies: GitHubReconnectDependencies = {},
  ) {}

  available(): boolean {
    return this.deviceFlow.available();
  }

  snapshot(): GitHubReconnectSnapshot {
    return {
      available: this.available(),
      state: this.state,
      authorization:
        this.state === "connecting"
          ? this.deviceFlow.snapshot().authorization
          : null,
      error: this.error,
    };
  }

  async start(): Promise<GitHubReconnectSnapshot> {
    this.state = "connecting";
    this.error = null;
    await this.deviceFlow.start();
    this.ensureWorker();
    return this.snapshot();
  }

  async retry(): Promise<GitHubReconnectSnapshot> {
    if (this.state !== "attention") {
      return this.snapshot();
    }
    return this.start();
  }

  resume(): void {
    this.wakeup.resume();
    if (this.state === "connecting") {
      this.ensureWorker();
    }
  }

  private ensureWorker(): void {
    if (this.worker !== null) {
      return;
    }
    this.worker = this.run()
      .catch((error: unknown) => {
        this.state = "attention";
        this.error = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        this.worker = null;
        if (this.state === "connecting") {
          this.ensureWorker();
        }
      });
  }

  private async run(): Promise<void> {
    const authorization = await this.deviceFlow.runUntilSettled(
      (milliseconds) => this.wait(milliseconds),
    );
    if (this.state !== "connecting") {
      return;
    }

    if (this.deviceFlow.credential() === null) {
      this.state = "attention";
      this.error =
        authorization.error ??
        "GitHub authorization did not complete. Try reconnecting GitHub.";
      return;
    }

    if (this.dependencies.on_connected !== undefined) {
      await this.dependencies.on_connected();
    }
    this.state = "initial";
    this.error = null;
  }

  private wait(milliseconds: number): Promise<void> {
    return this.wakeup.wait(
      milliseconds,
      this.dependencies.sleep ?? defaultSleep,
    );
  }
}
