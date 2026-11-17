import {
  Button,
  List,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import type { Task } from "../../src/core/task";
import {
  completedForScheduledDate,
  outstandingForDate,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { formatCivilDate } from "./dates";
import { DateStrip } from "./date-strip";
import { SortableTaskRow, TaskRow } from "./task-row";
import { TaskInspector } from "./task-inspector";

export interface DayViewProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly isNarrow: boolean;
  readonly onAdd: (date: string) => void;
  readonly onSelectDate: (date: string) => void;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  readonly statusControl: ReactNode;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onDelete: (task: Task) => void;
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
  isSelected,
  onSelect,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  isSelected: boolean;
  onSelect?: ((task: Task) => void) | undefined;
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
      isSelected={isSelected}
      {...(onSelect === undefined
        ? {}
        : { onSelect: () => onSelect(task) })}
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

export interface DayTaskListsProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly selectedTask?: Task | null;
  readonly onSelectTask?: ((task: Task) => void) | undefined;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: DayViewProps["onMove"];
}

export function DayTaskLists({
  tasks,
  selectedDate,
  selectedTask = null,
  onSelectTask,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: DayTaskListsProps): React.ReactElement {
  const active = outstandingForDate(tasks, selectedDate);
  const completed = completedForScheduledDate(tasks, selectedDate);

  return (
    <TaskDragProvider tasks={tasks} onMove={onMove}>
      <div className="jig-day-lists">
        <DateDropZone
          date={selectedDate}
          className="jig-day-scheduled-section"
        >
          <section aria-labelledby="day-attention-heading">
            <div className="jig-section-heading">
              <h2 id="day-attention-heading">Attention</h2>
              <span className="jig-task-count">
                {active.length} {active.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            {active.length === 0 ? (
              <p className="jig-empty-state">
                Nothing scheduled for this date.
              </p>
            ) : (
              <List density="balanced" edge="flush" className="jig-task-card-list">
                {active.map((task) => (
                  <ActiveRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    isSelected={selectedTask?.id === task.id}
                    {...(onSelectTask === undefined
                      ? {}
                      : { onSelect: onSelectTask })}
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
          <section
            className="jig-completed-section"
            aria-labelledby="day-completed-heading"
          >
            <div className="jig-section-heading">
              <h2 id="day-completed-heading">Completed</h2>
              <span className="jig-task-count">
                {completed.length} {completed.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            <List density="compact" edge="flush" className="jig-task-card-list">
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTask?.id === task.id}
                  {...(onSelectTask === undefined
                    ? {}
                    : { onSelect: () => onSelectTask(task) })}
                  onToggleComplete={() => {
                    void onToggleComplete(task);
                  }}
                  onEdit={() => onEdit(task)}
                />
              ))}
            </List>
          </section>
        )}
      </div>
    </TaskDragProvider>
  );
}

export function DayView({
  tasks,
  selectedDate,
  isNarrow,
  onAdd,
  onSelectDate,
  onPrevious,
  onToday,
  onNext,
  statusControl,
  selectedTask,
  onSelectTask,
  onDelete,
  ...listProps
}: DayViewProps): React.ReactElement {
  if (isNarrow) {
    return (
      <div className="jig-day-view jig-day-view-narrow">
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        <div className="jig-mobile-day-heading">
          <h1>
            {formatCivilDate(selectedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p>Your ordered plan</p>
        </div>

        <DayTaskLists
          tasks={tasks}
          selectedDate={selectedDate}
          selectedTask={selectedTask}
          onSelectTask={onSelectTask}
          {...listProps}
        />

        <Button
          label="+"
          aria-label="Add task"
          variant="primary"
          className="jig-mobile-quick-add"
          onClick={() => onAdd(selectedDate)}
        />
      </div>
    );
  }

  return (
    <div className="jig-day-view">
      <div className="jig-reference-heading jig-day-desktop-heading">
        <div>
          <h1>
            {formatCivilDate(selectedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p>Selected date view · Today is a shortcut, not a destination</p>
        </div>
        {statusControl}
      </div>

      <div className="jig-day-toolbar">
        <div className="jig-date-step-group">
          <Button
            label="‹"
            aria-label="Previous day"
            variant="ghost"
            size="sm"
            className="jig-date-step"
            onClick={onPrevious}
          />
          <Button
            label="›"
            aria-label="Next day"
            variant="ghost"
            size="sm"
            className="jig-date-step"
            onClick={onNext}
          />
        </div>
        <div className="jig-reference-toolbar-actions">
          <Button
            label="Today"
            variant="secondary"
            size="sm"
            className="jig-today-control"
            onClick={onToday}
          />
          <Button
            label="+ Add task"
            variant="primary"
            className="jig-header-add"
            onClick={() => onAdd(selectedDate)}
          />
        </div>
      </div>

      <div className="jig-day-layout">
        <div className="jig-day-primary">
          <DateStrip
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />

          <DayTaskLists
            tasks={tasks}
            selectedDate={selectedDate}
            selectedTask={selectedTask}
            onSelectTask={onSelectTask}
            {...listProps}
          />
        </div>
        <TaskInspector
          task={selectedTask}
          onToggleComplete={listProps.onToggleComplete}
          onEdit={listProps.onEdit}
          onMoveToDate={listProps.onMoveToDate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
