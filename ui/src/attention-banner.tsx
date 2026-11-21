import { Icon, IconButton } from "@astryxdesign/core";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type JigAttentionStatus = "error" | "warning";
export type JigAttentionContainer = "card" | "section";

export interface JigAttentionBannerProps {
  readonly status: JigAttentionStatus;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly endContent?: ReactNode;
  readonly container?: JigAttentionContainer;
  readonly onDismiss?: () => void;
}

export function JigAttentionBanner({
  status,
  title,
  description,
  endContent,
  container = "card",
  onDismiss,
}: JigAttentionBannerProps): React.ReactElement {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [status, title, description]);

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

export interface JigSuccessConfirmationProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

/**
 * Short-lived operation confirmation. This is deliberately an inline
 * application status, not a second toast/snackbar system or a source of
 * domain state.
 */
export function JigSuccessConfirmation({
  message,
  onDismiss,
}: JigSuccessConfirmationProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);
  const hasDismissed = useRef(false);

  const dismiss = useCallback((): void => {
    if (hasDismissed.current) {
      return;
    }
    hasDismissed.current = true;
    setIsExiting(true);
    window.setTimeout(onDismiss, 175);
  }, [onDismiss]);

  useEffect(() => {
    hasDismissed.current = false;
    setIsExiting(false);
    const timeout = window.setTimeout(dismiss, 3500);
    return () => window.clearTimeout(timeout);
  }, [dismiss, message]);

  return (
    <div
      className={[
        "jig-success-confirmation",
        isExiting ? "jig-success-confirmation-exiting" : "",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <Icon icon="check" size="sm" color="inherit" />
      <span>{message}</span>
      <IconButton
        label="Dismiss confirmation"
        icon={<Icon icon="close" color="inherit" />}
        variant="ghost"
        size="sm"
        onClick={dismiss}
      />
    </div>
  );
}
