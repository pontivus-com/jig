import { AppShell } from "@astryxdesign/core";
import {
  useEffect,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { Destination } from "../../navigation";
import type { PlannerHeaderProps } from "../../planner-header";
import type {
  TaskWorkspaceOverlayProps,
  TaskWorkspacePresentation,
} from "../../task-workspace";

interface ApplicationShellProps {
  readonly topNav: ReactNode;
  readonly children: ReactNode;
}

export function ApplicationShell({
  topNav,
  children,
}: ApplicationShellProps): React.ReactElement {
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    setMotionReady(true);
  }, []);

  return (
    <AppShell
      className={
        motionReady
          ? "jig-app-shell jig-app-shell-motion-ready"
          : "jig-app-shell"
      }
      topNav={topNav}
      mobileNav={false}
      contentPadding={0}
      height="fill"
      variant="section"
    >
      {children}
    </AppShell>
  );
}

export interface ConfiguredPresentationProps
  extends PlannerHeaderProps,
    Omit<TaskWorkspaceOverlayProps, "workspace"> {
  readonly content: ReactNode;
  readonly durableFeedback: ReactNode;
  readonly transientFeedback: ReactNode;
  readonly workspace: TaskWorkspacePresentation | null;
  readonly destinationTransition: Destination | null;
  readonly onContentPointerDown: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
}

