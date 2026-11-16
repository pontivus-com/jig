import {
  Button,
  List,
} from "@astryxdesign/core";
import type { Task } from "../../src/core/task";
import {
  completedForScheduledDate,
  dayAttention,
  outstandingForDate,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { formatCivilDate } from "./dates";
import { DateStrip } from "./date-strip";
import { SortableTaskRow, TaskRow } from "./task-row";

export interface DayViewProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

function ActiveRow({
  task,
  tasks,
  selectedDate,
  carriedOver,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  selectedDate: string;
  carriedOver: boolean;
  onEdit: (task: Task) => void;
  onMoveToDate: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<boolean>;
  onMove: DayViewProps["onMove"];
}>): React.ReactElement {
  const sequence = outstandingForDate(tasks, task.scheduled_date);
  const position = task.position ?? 0;

  return (
    <SortableTaskRow
      task={task}
      index={position}
      group={task.scheduled_date}
      carriedOverFrom={carriedOver ? task.scheduled_date : undefined}
      onToggleComplete={() => {
        void onToggleComplete(task);
      }}
      onEdit={() => onEdit(task)}
      onMoveUp={
        position <= 0
          ? undefined
          : () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position - 1,
              );
            }
      }
      onMoveDown={
        position >= sequence.length - 1
          ? undefined
          : () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position + 1,
              );
            }
      }
      onMoveToDate={() => onMoveToDate(task)}
    />
  );
}

export function DayTaskLists({
  tasks,
  selectedDate,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: Omit<DayViewProps, "onAdd">): React.ReactElement {
  const attention = dayAttention(tasks, selectedDate);
  const completed = completedForScheduledDate(tasks, selectedDate);

  return (
    <TaskDragProvider tasks={tasks} onMove={onMove}>
      <div className="jig-day-lists">
        {attention.carried_over.length === 0 ? null : (
          <section
            className="jig-carry-over-section"
            aria-labelledby="carry-over-heading"
          >
            <h2 id="carry-over-heading">Carried over</h2>
            <p className="jig-secondary-copy">
              Earlier unfinished work. Original dates remain unchanged until you explicitly move a task.
            </p>
            <List density="compact" hasDividers edge="flush">
              {attention.carried_over.map((task) => (
                <ActiveRow
                  key={task.id}
                  task={task}
                  tasks={tasks}
                  selectedDate={selectedDate}
                  carriedOver
                  onEdit={onEdit}
                  onMoveToDate={onMoveToDate}
                  onToggleComplete={onToggleComplete}
                  onMove={onMove}
                />
              ))}
            </List>
          </section>
        )}

        <DateDropZone
          date={selectedDate}
          className="jig-day-scheduled-section"
        >
          <section aria-labelledby="day-scheduled-heading">
            <h2 id="day-scheduled-heading">
              {formatCivilDate(selectedDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h2>
            {attention.scheduled.length === 0 ? (
              <p className="jig-empty-state">
                Nothing scheduled for this date.
              </p>
            ) : (
              <List density="balanced" hasDividers edge="flush">
                {attention.scheduled.map((task) => (
                  <ActiveRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    selectedDate={selectedDate}
                    carriedOver={false}
                    onEdit={onEdit}
                    onMoveToDate={onMoveToDate}
                    onToggleComplete={onToggleComplete}
                    onMove={onMove}
                  />
                ))}
              </List>
            )}
          </section>
        </DateDropZone>

        {completed.length === 0 ? null : (
          <details className="jig-completed-section">
            <summary>Completed ({completed.length})</summary>
            <List density="compact" hasDividers edge="flush">
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggleComplete={() => {
                    void onToggleComplete(task);
                  }}
                  onEdit={() => onEdit(task)}
                />
              ))}
            </List>
          </details>
        )}
      </div>
    </TaskDragProvider>
  );
}

export function DayView({
  tasks,
  selectedDate,
  onAdd,
  ...listProps
}: DayViewProps): React.ReactElement {
  return (
    <div className="jig-day-view">
      <div className="jig-view-heading">
        <div>
          <p className="jig-eyebrow">Day</p>
          <h1>
            {formatCivilDate(selectedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h1>
        </div>
        <Button
          label="Add task"
          variant="primary"
          onClick={() => onAdd(selectedDate)}
        />
      </div>

      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={() => undefined}
      />

      <DayTaskLists
        tasks={tasks}
        selectedDate={selectedDate}
        {...listProps}
      />
    </div>
  );
}
