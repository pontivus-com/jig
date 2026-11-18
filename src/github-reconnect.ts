import type { GitHubReconnectSnapshot } from "./github";
import { GitHubDeviceFlowSession } from "./github-device-flow";

export class GitHubReconnectController {
  constructor(private readonly deviceFlow: GitHubDeviceFlowSession) {}

  available(): boolean {
    return this.deviceFlow.available();
  }

  snapshot(): GitHubReconnectSnapshot {
    return this.deviceFlow.snapshot();
  }

  async start(): Promise<GitHubReconnectSnapshot> {
    return this.deviceFlow.start();
  }

  async refresh(): Promise<GitHubReconnectSnapshot> {
    return this.deviceFlow.poll();
  }
}
