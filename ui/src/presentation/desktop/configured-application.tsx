import { PlannerHeader } from "../../planner-header";
import { TaskWorkspaceDrawer } from "../../task-workspace";
import {
  ApplicationShell,
  type ConfiguredPresentationProps,
} from "../shared/application-shell";

export function DesktopConfiguredApplication(
  props: ConfiguredPresentationProps,
): React.ReactElement {
  const {
    content,
    durableFeedback,
    transientFeedback,
    workspace,
    destinationTransition,
    todayScrollRequest: _todayScrollRequest,
    onContentPointerDown,
    ...componentProps
  } = props;

  return (
    <div
      data-jig-configured-presentation="desktop"
      className="jig-configured-root jig-configured-desktop"
    >
      <ApplicationShell
        topNav={<PlannerHeader {...componentProps} layoutMode="desktop" />}
      >
        <div className="jig-configured-body">
          {durableFeedback}
          {transientFeedback}
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
          {content}
        </div>
          </div>
          <TaskWorkspaceDrawer
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
