import { Button } from "@astryxdesign/core";
import { useEffect, useRef } from "react";
import type { GitHubAuthorizationPresentation } from "../../src/github";

export interface GitHubDeviceFlowPanelProps {
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly isOperating: boolean;
  readonly purpose: "continue" | "reconnect";
  readonly refreshLabel: string;
  readonly onRefresh: () => Promise<void>;
}

export function GitHubDeviceFlowPanel({
  authorization,
  isOperating,
  purpose,
  refreshLabel,
  onRefresh,
}: GitHubDeviceFlowPanelProps): React.ReactElement | null {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (authorization === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshRef.current();
    }, authorization.retry_after_seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [
    authorization?.retry_after_seconds,
    authorization?.user_code,
  ]);

  if (authorization === null) {
    return null;
  }

  return (
    <div className="jig-setup-github-state">
      <p>
        Enter code <strong>{authorization.user_code}</strong>{" "}
        at GitHub&apos;s device authorization page to {purpose}.
      </p>
      <Button
        label="Open GitHub device authorization"
        variant="secondary"
        onClick={() => {
          window.open(
            authorization.verification_uri,
            "_blank",
            "noopener,noreferrer",
          );
        }}
      />
      <Button
        label={refreshLabel}
        variant="secondary"
        isLoading={isOperating}
        onClick={() => {
          void onRefresh();
        }}
      />
    </div>
  );
}
