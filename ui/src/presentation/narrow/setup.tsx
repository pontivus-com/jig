import type { ReactNode } from "react";

export function NarrowSetupPresentation({
  value,
  pane,
}: Readonly<{
  readonly value: ReactNode;
  readonly pane: ReactNode;
}>): React.ReactElement {
  return (
    <div
      className="jig-setup jig-setup-narrow"
      aria-labelledby="jig-setup-title"
      data-jig-setup-presentation="narrow"
    >
      <div className="jig-setup-layout jig-setup-layout-narrow">
        {value}
        {pane}
      </div>
    </div>
  );
}
