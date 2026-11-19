import { Button } from "@astryxdesign/core";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { GitHubAuthorizationPresentation } from "../../src/github";

export interface GitHubDeviceFlowPanelProps {
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly purpose: "continue" | "reconnect";
}

export function GitHubDeviceFlowPanel({
  authorization,
  purpose,
}: GitHubDeviceFlowPanelProps): React.ReactElement | null {
  const openedCode = useRef<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (
      authorization === null ||
      openedCode.current === authorization.user_code
    ) {
      return;
    }
    openedCode.current = authorization.user_code;
    window.open(
      authorization.verification_uri,
      "_blank",
      "noopener,noreferrer",
    );
  }, [authorization]);

  if (authorization === null) {
    return null;
  }

  const copyCode = async (): Promise<void> => {
    await navigator.clipboard.writeText(authorization.user_code);
    setCopiedCode(authorization.user_code);
  };

  return (
    <div className="jig-setup-github-state">
      <p>
        {purpose === "reconnect"
          ? "Reconnect Jig on GitHub using this code."
          : "Connect Jig on GitHub using this code."}
      </p>
      <strong className="jig-github-device-code">
        {authorization.user_code}
      </strong>
      <div className="jig-setup-github-actions">
        <Button
          label={
            copiedCode === authorization.user_code
              ? "Code copied"
              : "Copy code"
          }
          variant="secondary"
          onClick={() => {
            void copyCode();
          }}
        />
        <Button
          label="Open GitHub"
          variant="secondary"
          onClick={() => {
            window.open(
              authorization.verification_uri,
              "_blank",
              "noopener,noreferrer",
            );
          }}
        />
      </div>
      <small>
        Enter the code on GitHub. Jig continues automatically after GitHub
        authorizes this connection.
      </small>
    </div>
  );
}
