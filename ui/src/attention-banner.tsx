import { Icon } from "@astryxdesign/core";
import type { ReactNode } from "react";

export type JigAttentionStatus = "error" | "warning";
export type JigAttentionContainer = "card" | "section";

export interface JigAttentionBannerProps {
  readonly status: JigAttentionStatus;
  readonly title: ReactNode;
  readonly description: ReactNode;
  readonly endContent?: ReactNode;
  readonly container?: JigAttentionContainer;
}

export function JigAttentionBanner({
  status,
  title,
  description,
  endContent,
  container = "card",
}: JigAttentionBannerProps): React.ReactElement {
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
    </section>
  );
}
