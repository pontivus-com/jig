import { TaskDragProvider } from "../../drag";
import { todayCivilDate } from "../../dates";
import {
  PlannerDateSection,
  PlannerEmptyState,
  type PlannerPresenterProps,
} from "../shared/planner-date-section";

export function DesktopPlanner(
  props: PlannerPresenterProps,
): React.ReactElement {
  const today = todayCivilDate();

  return (
    <div className="jig-planner-surface">
      <TaskDragProvider
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        onMove={props.onMove}
      >
        <PlannerEmptyState
          dates={props.displayedDates}
          tasks={props.tasks}
          onAdd={props.onAdd}
        />
        <div
          className={[
            "jig-week-board",
            "jig-planner-board-desktop",
            props.weekTransitionDirection === "today"
              ? "jig-week-board-today"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="group"
          aria-label="Planner week"
        >
          {props.displayedDates.map((date) => (
            <PlannerDateSection
              key={date}
              tasks={props.tasks}
              recurrences={props.recurrences}
              now={props.now}
              date={date}
              today={today}
              selectedTask={props.selectedTask}
              onSelectTask={props.onSelectTask}
              onAdd={props.onAdd}
              onEdit={props.onEdit}
              onToggleComplete={props.onToggleComplete}
              onSetPriority={props.onSetPriority}
              onDelete={props.onDelete}
              onMove={props.onMove}
            />
          ))}
        </div>
      </TaskDragProvider>
    </div>
  );
}
