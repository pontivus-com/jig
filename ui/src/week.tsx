import {
  Button,
  List,
} from "@astryxdesign/core";
import type { Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { formatCivilDate, todayCivilDate } from "./dates";
import { SortableTaskRow } from "./task-row";

export interface WeekViewProps {
  readonly tasks: readonly Task[];
  readonly displayedDates: readonly string[];
  readonly selectedDate: string;
  readonly selectedTask: Task | null;
  readonly onSelectDate: (date: string) => void;
  readonly onSelectTask: (task: Task) => void;
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

function WeekTaskRow({
  task,
  tasks,
  isSelected,
  onSelect,
  onEdit,
  onToggleComplete,
  onMove,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  isSelected: boolean;
  onSelect: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<boolean>;
  onMove: WeekViewProps["onMove"];
}>): React.ReactElement {
  const position = task.position ?? 0;
  const sequence = outstandingForDate(tasks, task.scheduled_date);

  return (
    <SortableTaskRow
      task={task}
      index={position}
      group={task.scheduled_date}
      isSelected={isSelected}
      onSelect={() => onSelect(task)}
      onToggleComplete={() => {
        void onToggleComplete(task);
      }}
      onEdit={() => onEdit(task)}
      {...(position > 0
        ? {
            onMoveUp: () => {
              void onMove(task.id, task.scheduled_date, position - 1);
            },
          }
        : {})}
      {...(position < sequence.length - 1
        ? {
            onMoveDown: () => {
              void onMove(task.id, task.scheduled_date, position + 1);
            },
          }
        : {})}
    />
  );
}

export function WeekView({
  tasks,
  displayedDates,
  selectedDate,
  selectedTask,
  onSelectDate,
  onSelectTask,
  onAdd,
  onEdit,
  onToggleComplete,
  onMove,
}: WeekViewProps): React.ReactElement {
  const today = todayCivilDate();

  return (
    <TaskDragProvider tasks={tasks} onMove={onMove}>
      <div className="jig-week-board" role="group" aria-label="Planner week">
        {displayedDates.map((date) => {
          const dateTasks = outstandingForDate(tasks, date);
          return (
            <DateDropZone
              key={date}
              date={date}
              className={[
                "jig-week-column",
                date === selectedDate ? "jig-week-column-selected" : "",
                date === today ? "jig-week-column-today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <section aria-labelledby={`week-date-${date}`}>
                <header className="jig-week-column-header">
                  <Button
                    label={formatCivilDate(date, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                    variant="ghost"
                    size="sm"
                    className="jig-date-heading-button"
                    onClick={() => onSelectDate(date)}
                    aria-current={date === selectedDate ? "date" : undefined}
                  >
                    <strong id={`week-date-${date}`}>
                      {formatCivilDate(date, { weekday: "short" })}{" "}
                      {formatCivilDate(date, { day: "numeric" })}
                    </strong>
                  </Button>
                  <span
                    className="jig-task-count"
                    aria-label={`${dateTasks.length} outstanding tasks`}
                  >
                    {dateTasks.length}
                  </span>
                </header>

                {dateTasks.length === 0 ? null : (
                  <List
                    density="compact"
                    edge="padded"
                    className="jig-task-card-list"
                  >
                    {dateTasks.map((task) => (
                      <WeekTaskRow
                        key={task.id}
                        task={task}
                        tasks={tasks}
                        isSelected={selectedTask?.id === task.id}
                        onSelect={onSelectTask}
                        onEdit={onEdit}
                        onToggleComplete={onToggleComplete}
                        onMove={onMove}
                      />
                    ))}
                  </List>
                )}
                <Button
                  label="Add task"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelectDate(date);
                    onAdd(date);
                  }}
                  aria-label={`Add task on ${formatCivilDate(date)}`}
                  className="jig-week-add-task"
                />
              </section>
            </DateDropZone>
          );
        })}
      </div>
    </TaskDragProvider>
  );
}
