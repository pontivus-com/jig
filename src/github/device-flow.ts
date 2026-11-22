import {
  applyGitHubDevicePollResult,
  githubAuthorizationPresentation,
  githubDevicePollDecision,
  startGitHubDeviceSession,
  type GitHubAppRegistration,
  type GitHubAuthorizationSnapshot,
  type GitHubCredential,
  type GitHubDeviceSessionState,
} from "./model";
import {
  pollGitHubDeviceAuthorization,
  startGitHubDeviceAuthorization,
} from "./auth";

export type GitHubFlowSleep = (
  milliseconds: number,
) => Promise<void>;

export class GitHubFlowWakeup {
  private wake: (() => void) | null = null;

  async wait(
    milliseconds: number,
    sleep: GitHubFlowSleep,
  ): Promise<void> {
    let wakeCurrent: (() => void) | null = null;
    const wakePromise = new Promise<void>((resolve) => {
      wakeCurrent = resolve;
      this.wake = resolve;
    });
    await Promise.race([
      sleep(milliseconds),
      wakePromise,
    ]);
    if (this.wake === wakeCurrent) {
      this.wake = null;
    }
  }

  resume(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }
}

export interface GitHubDeviceFlowDependencies {
  readonly registration: GitHubAppRegistration | null;
  readonly assert_credential_store: () => Promise<void>;
  readonly load_credential: () => Promise<GitHubCredential | null>;
  readonly store_credential: (credential: GitHubCredential) => Promise<void>;
  readonly start_device_authorization?: typeof startGitHubDeviceAuthorization;
  readonly poll_device_authorization?: typeof pollGitHubDeviceAuthorization;
  readonly now?: () => Date;
}

export class GitHubDeviceFlowSession {
  private state: GitHubDeviceSessionState | null = null;
  private currentCredential: GitHubCredential | null = null;
  private error: string | null = null;

  constructor(
    private readonly dependencies: GitHubDeviceFlowDependencies,
  ) {}

  available(): boolean {
    return this.dependencies.registration !== null;
  }

  credential(): GitHubCredential | null {
    return this.currentCredential;
  }

  async restoreCredential(): Promise<boolean> {
    await this.dependencies.assert_credential_store();
    const credential = await this.dependencies.load_credential();
    this.state = null;
    this.error = null;
    this.currentCredential = credential;
    return credential !== null;
  }

  nextPollDelayMs(): number | null {
    if (this.state === null) {
      return null;
    }
    const decision = githubDevicePollDecision(
      this.state,
      this.now().getTime(),
    );
    if (decision.status === "expired" || decision.status === "poll") {
      return 0;
    }
    return decision.state.retry_after_seconds * 1000;
  }

  snapshot(): GitHubAuthorizationSnapshot {
    return {
      available: this.available(),
      phase: this.state === null ? "idle" : "authorizing",
      authorization: githubAuthorizationPresentation(this.state),
      error: this.error,
    };
  }

  async start(): Promise<GitHubAuthorizationSnapshot> {
    const registration = this.requireRegistration();
    await this.dependencies.assert_credential_store();

    const authorization = await (
      this.dependencies.start_device_authorization ??
      startGitHubDeviceAuthorization
    )(registration);
    this.state = startGitHubDeviceSession(
      authorization,
      this.now().getTime(),
    );
    this.currentCredential = null;
    this.error = null;
    return this.snapshot();
  }

  async runUntilSettled(
    sleep: GitHubFlowSleep,
  ): Promise<GitHubAuthorizationSnapshot> {
    while (this.state !== null) {
      const delay = this.nextPollDelayMs();
      if (delay !== null && delay > 0) {
        await sleep(delay);
      }
      await this.poll();
    }
    return this.snapshot();
  }

  async poll(): Promise<GitHubAuthorizationSnapshot> {
    const registration = this.requireRegistration();
    if (this.state === null) {
      return this.snapshot();
    }

    const nowMs = this.now().getTime();
    const decision = githubDevicePollDecision(this.state, nowMs);
    if (decision.status === "expired") {
      this.state = null;
      this.error = "GitHub device authorization expired";
      return this.snapshot();
    }
    if (decision.status === "wait") {
      this.state = decision.state;
      return this.snapshot();
    }

    const result = await (
      this.dependencies.poll_device_authorization ??
      pollGitHubDeviceAuthorization
    )(
      registration,
      decision.state.authorization,
      decision.state.retry_after_seconds,
      this.now(),
    );
    const transition = applyGitHubDevicePollResult(
      decision.state,
      result,
      this.now().getTime(),
    );

    if (transition.status === "authorized") {
      await this.dependencies.store_credential(transition.credential);
      this.currentCredential = transition.credential;
      this.state = null;
      this.error = null;
      return this.snapshot();
    }
    if (transition.status === "denied") {
      this.state = null;
      this.error = "GitHub device authorization was denied";
      return this.snapshot();
    }
    if (transition.status === "expired") {
      this.state = null;
      this.error = "GitHub device authorization expired";
      return this.snapshot();
    }

    this.state = transition.state;
    this.error = null;
    return this.snapshot();
  }

  private requireRegistration(): GitHubAppRegistration {
    if (this.dependencies.registration === null) {
      throw new Error(
        "Connect GitHub is unavailable until the Jig GitHub App registration is configured",
      );
    }
    return this.dependencies.registration;
  }

  private now(): Date {
    return (this.dependencies.now ?? (() => new Date()))();
  }
}
