import {
  CompactApplicationNavigation,
  PlannerHeader,
} from "../../planner-header";
import { TaskWorkspaceBottomSheet } from "../../task-workspace";
import {
  ApplicationShell,
  type ConfiguredPresentationProps,
} from "../shared/application-shell";

export function NarrowConfiguredApplication(
  props: ConfiguredPresentationProps,
): React.ReactElement {
  const {
    content,
    durableFeedback,
    transientFeedback,
    workspace,
    destinationTransition,
    todayScrollRequest,
    onContentPointerDown,
    ...componentProps
  } = props;

  return (
    <ApplicationShell
      topNav={<PlannerHeader {...componentProps} layoutMode="narrow" />}
    >
      {durableFeedback}
      {transientFeedback}
      <div
        data-jig-configured-presentation="narrow"
        className={[
          "jig-content-frame",
          todayScrollRequest > 0
            ? "jig-content-frame-today-smooth"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
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
      <TaskWorkspaceBottomSheet
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
      {workspace === null ? (
        <CompactApplicationNavigation
          destination={props.destination}
          showAdd
          onAdd={componentProps.onAdd}
          onNavigate={componentProps.onNavigate}
        />
      ) : null}
    </ApplicationShell>
  );
}
