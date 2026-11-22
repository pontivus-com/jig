import { NarrowBottomNavigation } from "./bottom-navigation";
import { NarrowConfiguredHeader } from "./header";
import { NarrowFeedbackRegion } from "./feedback-region";
import { NarrowPlanner } from "./planner";
import { NarrowTaskWorkspace } from "./task-workspace";
import { NarrowSyncConflictWorkspace } from "./sync-conflict-workspace";
import {
  ApplicationShell,
  type ConfiguredPresentationProps,
} from "../shared/application-shell";

export function NarrowConfiguredApplication(
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
      data-jig-configured-presentation="narrow"
      className="jig-configured-root jig-configured-narrow"
    >
      <ApplicationShell
        topNav={<NarrowConfiguredHeader {...componentProps} />}
      >
        <div className="jig-configured-body">
          <NarrowFeedbackRegion
            durable={durableFeedback}
            transient={transientFeedback}
          />
          <div
            className={[
              "jig-content-frame",
          planner !== null && planner.todayScrollRequest !== null
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
          {props.destination === "planner" && planner !== null ? (
            <NarrowPlanner {...planner} />
          ) : (
            content
          )}
        </div>
          </div>
          <NarrowSyncConflictWorkspace
            workspace={syncConflictWorkspace}
          />
          <NarrowTaskWorkspace
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
            <NarrowBottomNavigation
              destination={props.destination}
              showAdd
              onAdd={componentProps.onAdd}
              onNavigate={componentProps.onNavigate}
            />
          ) : null}
        </div>
      </ApplicationShell>
    </div>
  );
}
