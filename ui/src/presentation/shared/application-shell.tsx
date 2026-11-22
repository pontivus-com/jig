import { AppShell } from "@astryxdesign/core";
import {
  useEffect,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { RecurrenceSeries } from "../../../src/core/recurrence";
import type { Task, TaskCommand } from "../../../src/core/task";
import type { Destination } from "../../navigation";
import type { PlannerHeaderProps } from "../../planner-header";
import type {
  TaskWorkspaceOverlayProps,
  TaskWorkspacePresentation,
} from "../../task-workspace";
import type { TaskDraft } from "../../task-editor";

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
  extends Omit<PlannerHeaderProps, "layoutMode">,
    Omit<TaskWorkspaceOverlayProps, "workspace"> {
  readonly content: ReactNode;
  readonly durableFeedback: ReactNode;
  readonly transientFeedback: ReactNode;
  readonly workspace: TaskWorkspacePresentation | null;
  readonly destinationTransition: Destination | null;
  readonly todayScrollRequest: number;
  readonly onContentPointerDown: (
    event: PointerEvent<HTMLDivElement>,
  ) => void;
}

// Compile-time anchors: these fields deliberately remain the existing
// canonical/component types rather than a desktop/narrow view-model layer.
type _CanonicalWorkspaceDraft = TaskDraft;
type _CanonicalTask = Task;
type _CanonicalTaskCommand = TaskCommand;
type _CanonicalRecurrence = RecurrenceSeries;
void (0 as unknown as _CanonicalWorkspaceDraft);
void (0 as unknown as _CanonicalTask);
void (0 as unknown as _CanonicalTaskCommand);
void (0 as unknown as _CanonicalRecurrence);
