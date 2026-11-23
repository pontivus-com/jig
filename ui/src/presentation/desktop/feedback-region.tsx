import type { ReactNode } from "react";

export interface DesktopFeedbackRegionProps {
  readonly durable: ReactNode;
  readonly transient: ReactNode;
}

export function DesktopFeedbackRegion({
  durable,
  transient,
}: DesktopFeedbackRegionProps): React.ReactElement {
  return (
    <>
      {transient === null ? null : (
        <div
          className="jig-feedback-transient-region jig-feedback-transient-desktop"
          aria-label="Recent activity"
        >
          <div className="jig-feedback-transient-stack">{transient}</div>
        </div>
      )}
      {durable === null ? null : (
        <div className="jig-feedback-durable-region jig-feedback-durable-desktop">
          {durable}
        </div>
      )}
    </>
  );
}
