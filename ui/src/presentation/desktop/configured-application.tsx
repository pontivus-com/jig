import { DesktopConfiguredHeader } from "./header";
import { DesktopFeedbackRegion } from "./feedback-region";
import { DesktopPlanner } from "./planner";
import { DesktopTaskWorkspace } from "./task-workspace";
import { DesktopSyncConflictWorkspace } from "./sync-conflict-workspace";
import {
  ApplicationShell,
  type ConfiguredPresentationProps,
} from "../shared/application-shell";

export function DesktopConfiguredApplication(
  props: ConfiguredPresentationProps,
): React.ReactElement {
  const {
    content,
    planner,
    durableFeedback,
    transientFeedback,
    workspace,
    syncConflictWorkspace,
    destinationTransition,
    onContentPointerDown,
    ...componentProps
  } = props;

  return (
    <div
      data-jig-configured-presentation="desktop"
      className="jig-configured-root jig-configured-desktop"
    >
      <ApplicationShell
        topNav={<DesktopConfiguredHeader {...componentProps} />}
      >
        <div className="jig-configured-body">
          <DesktopFeedbackRegion
            durable={durableFeedback}
            transient={transientFeedback}
          />
          <div className="jig-content-frame">
        <div
          key={props.destination}
          className={[
            "jig-content",
            "jig-content-configured",
            props.destination === "planner"
              ? "jig-content-configured-planner"
              : "",
            destinationTransition === props.destination
              ? "jig-content-configured-transition"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onPointerDown={onContentPointerDown}
        >
          {props.destination === "planner" && planner !== null ? (
            <DesktopPlanner {...planner} />
          ) : (
            content
          )}
        </div>
          </div>
          <DesktopSyncConflictWorkspace
            workspace={syncConflictWorkspace}
          />
          <DesktopTaskWorkspace
            workspace={props.destination === "settings" ? null : workspace}
            externalError={componentProps.externalError}
            isSaving={componentProps.isSaving}
            recurrenceSeries={componentProps.recurrenceSeries}
            onDraftChange={componentProps.onDraftChange}
            onSave={componentProps.onSave}
            onDelete={componentProps.onDelete}
            onToggleComplete={componentProps.onToggleComplete}
            onClose={componentProps.onClose}
          />
        </div>
      </ApplicationShell>
    </div>
  );
}
