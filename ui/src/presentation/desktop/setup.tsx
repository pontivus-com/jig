import type { ReactNode } from "react";

export function DesktopSetupPresentation({
  value,
  pane,
}: Readonly<{
  readonly value: ReactNode;
  readonly pane: ReactNode;
}>): React.ReactElement {
  return (
    <div
      className="jig-setup jig-setup-desktop"
      aria-labelledby="jig-setup-title"
      data-jig-setup-presentation="desktop"
    >
      <div className="jig-setup-layout jig-setup-layout-desktop">
        {value}
        {pane}
      </div>
    </div>
  );
}
