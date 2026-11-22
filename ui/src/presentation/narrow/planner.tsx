import { useEffect, useRef } from "react";
import { TaskDragProvider } from "../../drag";
import { todayCivilDate } from "../../dates";
import {
  PlannerDateSection,
  PlannerEmptyState,
  type PlannerPresenterProps,
} from "../shared/planner-date-section";

export function NarrowPlanner(
  props: PlannerPresenterProps,
): React.ReactElement {
  const today = todayCivilDate();
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const initialTodayFocusHandledRef = useRef(false);
  const handledTodayScrollRequestRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialTodayFocusHandledRef.current) {
      return;
    }
    initialTodayFocusHandledRef.current = true;
    if (
      !props.focusCurrentDayOnMount ||
      !props.displayedDates.includes(today)
    ) {
      props.onInitialTodayFocusHandled();
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      });
      props.onInitialTodayFocusHandled();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    props.displayedDates,
    props.focusCurrentDayOnMount,
    props.onInitialTodayFocusHandled,
    today,
  ]);

  useEffect(() => {
    if (
      props.todayScrollRequest === null ||
      handledTodayScrollRequestRef.current === props.todayScrollRequest ||
      !props.displayedDates.includes(today)
    ) {
      return;
    }
    handledTodayScrollRequestRef.current = props.todayScrollRequest;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
      props.onTodayScrollHandled();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    props.displayedDates,
    props.onTodayScrollHandled,
    props.todayScrollRequest,
    today,
  ]);

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
          className="jig-week-board jig-planner-board-narrow"
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
              todaySectionRef={todaySectionRef}
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
