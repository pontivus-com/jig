import { Button } from "@astryxdesign/core";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { GitHubAuthorizationPresentation } from "../../src/github";
import {
  copyText,
  nativeClipboardAvailable,
} from "./native/clipboard";

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
  const [copyError, setCopyError] = useState(false);

  const copyCode = async (code: string): Promise<void> => {
    try {
      await copyText(code);
      setCopiedCode(code);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  useEffect(() => {
    if (
      authorization === null ||
      openedCode.current === authorization.user_code
    ) {
      return;
    }
    openedCode.current = authorization.user_code;
    void (async (): Promise<void> => {
      if (nativeClipboardAvailable()) {
        await copyCode(authorization.user_code);
      }
      window.open(
        authorization.verification_uri,
        "_blank",
        "noopener,noreferrer",
      );
    })();
  }, [authorization]);

  if (authorization === null) {
    return null;
  }

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
              : copyError
                ? "Retry copy"
                : "Copy code"
          }
          variant="secondary"
          onClick={() => {
            void copyCode(authorization.user_code);
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
