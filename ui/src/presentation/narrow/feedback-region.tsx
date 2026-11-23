import type { ReactNode } from "react";

export interface NarrowFeedbackRegionProps {
  readonly durable: ReactNode;
  readonly transient: ReactNode;
}

export function NarrowFeedbackRegion({
  durable,
  transient,
}: NarrowFeedbackRegionProps): React.ReactElement {
  return (
    <>
      {durable === null ? null : (
        <div className="jig-feedback-durable-region jig-feedback-durable-narrow">
          {durable}
        </div>
      )}
      {transient === null ? null : (
        <div
          className="jig-feedback-transient-region jig-feedback-transient-narrow"
          aria-label="Recent activity"
        >
          <div className="jig-feedback-transient-stack">{transient}</div>
        </div>
      )}
    </>
  );
}
