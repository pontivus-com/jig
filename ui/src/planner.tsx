import type { Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import type {
  WeekPagerHandle,
  WeekPagingDirection,
} from "./week-pager";
import { WeekView } from "./week";

export type WeekTransitionDirection = "today";

export interface PlannerProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly weekPagerRef: Ref<WeekPagerHandle>;
  readonly onCommitWeek: (direction: WeekPagingDirection) => void;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly displayedDates: readonly string[];
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
}

export function Planner(props: PlannerProps): React.ReactElement {
  return (
    <div className="jig-planner-surface">
      <WeekView
        focusCurrentDayOnMount={props.focusCurrentDayOnMount}
        todayScrollRequest={props.todayScrollRequest}
        weekTransitionDirection={props.weekTransitionDirection}
        weekPagerRef={props.weekPagerRef}
        onCommitWeek={props.onCommitWeek}
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        displayedDates={props.displayedDates}
        selectedTask={props.selectedTask}
        onSelectTask={props.onSelectTask}
        onAdd={props.onAdd}
        onEdit={props.onEdit}
        onToggleComplete={props.onToggleComplete}
        onSetPriority={props.onSetPriority}
        onDelete={props.onDelete}
        onMove={props.onMove}
      />
    </div>
  );
}
