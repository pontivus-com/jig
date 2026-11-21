import { Icon, IconButton } from "@astryxdesign/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export type JigAttentionStatus = "error" | "warning";
export type JigAttentionContainer = "card" | "section";

export interface JigAttentionBannerProps {
  readonly status: JigAttentionStatus;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly endContent?: ReactNode;
  readonly container?: JigAttentionContainer;
  readonly onDismiss?: () => void;
  readonly autoDismissMs?: number;
}

export function JigAttentionBanner({
  status,
  title,
  description,
  endContent,
  container = "card",
  onDismiss,
  autoDismissMs = 10_000,
}: JigAttentionBannerProps): React.ReactElement {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [status, title, description]);

  useEffect(() => {
    if (autoDismissMs <= 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setDismissed(true);
      onDismiss?.();
    }, autoDismissMs);
    return () => window.clearTimeout(timeout);
  }, [autoDismissMs, status, title, description]);

  if (dismissed) {
    return <></>;
  }

  const dismiss = (): void => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <section
      className={[
        "jig-attention-banner",
        "jig-attention-banner-" + status,
        "jig-attention-banner-" + container,
      ].join(" ")}
      data-jig-attention-status={status}
    >
      <span className="jig-attention-banner-icon" aria-hidden="true">
        <Icon
          icon={status === "error" ? "error" : "warning"}
          size="md"
          color="inherit"
        />
      </span>
      <div className="jig-attention-banner-message">
        <strong className="jig-attention-banner-title">{title}</strong>
        <span className="jig-attention-banner-description">
          {description}
        </span>
      </div>
      {endContent === undefined ? null : (
        <div className="jig-attention-banner-action">{endContent}</div>
      )}
      <div className="jig-attention-banner-dismiss">
        <IconButton
          label="Dismiss notification"
          icon={<Icon icon="close" color="inherit" />}
          variant="ghost"
          size="sm"
          onClick={dismiss}
        />
      </div>
    </section>
  );
}
