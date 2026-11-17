import { Button } from "@astryxdesign/core";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { DateStrip } from "./date-strip";
import { formatCivilDate } from "./dates";
import { PlannerTaskList } from "./planner-list";
import type { LayoutMode } from "./use-layout-mode";
import { WeekView } from "./week";

export interface PlannerProps {
  readonly tasks: readonly Task[];
  readonly displayedDates: readonly string[];
  readonly selectedDate: string;
  readonly layoutMode: LayoutMode;
  readonly selectedTask: Task | null;
  readonly onSelectDate: (date: string) => void;
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

export function Planner({
  tasks,
  displayedDates,
  selectedDate,
  layoutMode,
  selectedTask,
  onSelectDate,
  onSelectTask,
  onAdd,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMove,
}: PlannerProps): React.ReactElement {
  if (layoutMode === "desktop") {
    return (
      <WeekView
        tasks={tasks}
        displayedDates={displayedDates}
        selectedDate={selectedDate}
        selectedTask={selectedTask}
        onSelectDate={onSelectDate}
        onSelectTask={onSelectTask}
        onAdd={onAdd}
        onEdit={onEdit}
        onToggleComplete={onToggleComplete}
        onSetPriority={onSetPriority}
        onDelete={onDelete}
        onMove={onMove}
      />
    );
  }

  const outstanding = outstandingForDate(tasks, selectedDate);

  return (
    <div className="jig-planner-narrow">
      <DateStrip
        dates={displayedDates}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
      />
      <div className="jig-planner-selected-date-heading">
        <h1>
          {formatCivilDate(selectedDate, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h1>
        <span className="jig-task-count">
          {outstanding.length} {outstanding.length === 1 ? "task" : "tasks"}
        </span>
      </div>
      <PlannerTaskList
        tasks={tasks}
        selectedDate={selectedDate}
        selectedTask={selectedTask}
        onSelectTask={onSelectTask}
        onEdit={onEdit}
        onToggleComplete={onToggleComplete}
        onSetPriority={onSetPriority}
        onDelete={onDelete}
        onMove={onMove}
      />
      <Button
        label="Add task"
        variant="primary"
        size="lg"
        elevation="med"
        className="jig-mobile-quick-add"
        onClick={() => onAdd(selectedDate)}
      />
    </div>
  );
}
