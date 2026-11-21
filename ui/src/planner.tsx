import type { Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import {
  WeekCarousel,
  type WeekCarouselHandle,
} from "./week-carousel";
export type { WeekTransitionDirection } from "./week";

export type PlannerHandle = WeekCarouselHandle;

export interface PlannerProps {
  readonly handleRef: Ref<PlannerHandle>;
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: import("./week").WeekTransitionDirection | null;
  readonly displayedWeekStart: string;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onSetPriority: (task: Task, priority: Priority) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
  readonly onShiftWeek: (direction: -1 | 1) => void;
}

export function Planner(props: PlannerProps): React.ReactElement {
  return (
    <div className="jig-planner-surface">
      <WeekCarousel
        handleRef={props.handleRef}
        focusCurrentDayOnMount={props.focusCurrentDayOnMount}
        todayScrollRequest={props.todayScrollRequest}
        weekTransitionDirection={props.weekTransitionDirection}
        displayedWeekStart={props.displayedWeekStart}
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        selectedTask={props.selectedTask}
        onSelectTask={props.onSelectTask}
        onAdd={props.onAdd}
        onEdit={props.onEdit}
        onToggleComplete={props.onToggleComplete}
        onSetPriority={props.onSetPriority}
        onDelete={props.onDelete}
        onMove={props.onMove}
        onShiftWeek={props.onShiftWeek}
      />
    </div>
  );
}
