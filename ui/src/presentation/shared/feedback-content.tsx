import { Icon, IconButton } from "@astryxdesign/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";

export type FeedbackStatus = "error" | "warning" | "success";

interface FeedbackContentProps {
  readonly status: FeedbackStatus;
  readonly title?: ReactNode;
  readonly message: ReactNode;
  readonly action?: ReactNode;
  readonly onDismiss?: () => void;
  readonly className: string;
  readonly dismissLabel: string;
  readonly role: "alert" | "status";
  readonly ariaLive: "assertive" | "polite";
  readonly onAnimationEnd?: (event: AnimationEvent<HTMLElement>) => void;
}

function FeedbackContent({
  status,
  title,
  message,
  action,
  onDismiss,
  className,
  dismissLabel,
  role,
  ariaLive,
  onAnimationEnd,
}: FeedbackContentProps): React.ReactElement {
  const icon =
    status === "success" ? "check" : status === "error" ? "error" : "warning";

  return (
    <section
      className={className}
      data-jig-feedback-status={status}
      role={role}
      aria-live={ariaLive}
      onAnimationEnd={onAnimationEnd}
    >
      <span className="jig-feedback-icon" aria-hidden="true">
        <Icon icon={icon} size={status === "success" ? "sm" : "md"} color="inherit" />
      </span>
      <div className="jig-feedback-message">
        {title === undefined ? null : (
          <strong className="jig-feedback-title">{title}</strong>
        )}
        <span className="jig-feedback-description">{message}</span>
      </div>
      {action === undefined ? null : (
        <div className="jig-feedback-action">{action}</div>
      )}
      {onDismiss === undefined ? null : (
        <div className="jig-feedback-dismiss">
          <IconButton
            label={dismissLabel}
            icon={<Icon icon="close" color="inherit" />}
            variant="ghost"
            size="sm"
            onClick={onDismiss}
          />
        </div>
      )}
    </section>
  );
}

export interface AttentionFeedbackContentProps {
  readonly status: Exclude<FeedbackStatus, "success">;
  readonly title: ReactNode;
  readonly message: ReactNode;
  readonly action?: ReactNode;
  readonly onDismiss?: () => void;
  readonly container?: "card" | "section";
}

export function AttentionFeedbackContent({
  status,
  title,
  message,
  action,
  onDismiss,
  container = "card",
}: AttentionFeedbackContentProps): React.ReactElement {
  return (
    <FeedbackContent
      status={status}
      title={title}
      message={message}
      action={action}
      onDismiss={onDismiss}
      className={[
        "jig-attention-banner",
        `jig-attention-banner-${status}`,
        `jig-attention-banner-${container}`,
      ].join(" ")}
      dismissLabel="Dismiss notification"
      role={status === "error" ? "alert" : "status"}
      ariaLive={status === "error" ? "assertive" : "polite"}
    />
  );
}

export interface SuccessFeedbackContentProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export function SuccessFeedbackContent({
  message,
  onDismiss,
}: SuccessFeedbackContentProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);
  const dismissalRequested = useRef(false);
  const dismissalCompleted = useRef(false);

  const completeDismissal = useCallback((): void => {
    if (dismissalCompleted.current) {
      return;
    }
    dismissalCompleted.current = true;
    onDismiss();
  }, [onDismiss]);

  const requestDismissal = useCallback((): void => {
    if (dismissalRequested.current) {
      return;
    }
    dismissalRequested.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completeDismissal();
      return;
    }

    setIsExiting(true);
  }, [completeDismissal]);

  useEffect(() => {
    dismissalRequested.current = false;
    dismissalCompleted.current = false;
    setIsExiting(false);
    const timeout = window.setTimeout(requestDismissal, 3500);
    return () => window.clearTimeout(timeout);
  }, [message, requestDismissal]);

  const handleAnimationEnd = (
    event: AnimationEvent<HTMLElement>,
  ): void => {
    if (
      isExiting &&
      event.currentTarget === event.target &&
      event.animationName === "jig-success-confirmation-exit"
    ) {
      completeDismissal();
    }
  };

  return (
    <FeedbackContent
      status="success"
      message={message}
      onDismiss={requestDismissal}
      className={[
        "jig-success-confirmation",
        isExiting ? "jig-success-confirmation-exiting" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      dismissLabel="Dismiss confirmation"
      role="status"
      ariaLive="polite"
      onAnimationEnd={handleAnimationEnd}
    />
  );
}
