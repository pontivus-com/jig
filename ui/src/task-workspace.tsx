import {
  Button,
  DateInput,
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
} from "@astryxdesign/core";
import type { ISODateString } from "@astryxdesign/core/utils";
import { useEffect, useState } from "react";
import type { Task, TaskCommand } from "../../src/core/task";
import { formatCivilDate } from "./dates";
import { TaskEditor } from "./task-editor";
import { TaskInspector } from "./task-inspector";

export type TaskWorkspaceMode = "view" | "edit" | "create" | "move";

export interface TaskWorkspaceContentProps {
  readonly mode: TaskWorkspaceMode;
  readonly task: Task | null;
  readonly initiatingDate: string;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly surface: "docked" | "drawer";
  readonly showHeading: boolean;
  readonly onModeChange: (mode: TaskWorkspaceMode | null) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onMove: (task: Task, destinationDate: string) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
}

export function TaskWorkspaceContent({
  mode,
  task,
  initiatingDate,
  externalError,
  isSaving,
  surface,
  showHeading,
  onModeChange,
  onSave,
  onMove,
  onDelete,
  onToggleComplete,
}: TaskWorkspaceContentProps): React.ReactElement {
  if (mode === "move" && task !== null) {
    return (
      <TaskMovePanel
        task={task}
        externalError={externalError}
        isSaving={isSaving}
        surface={surface}
        showHeading={showHeading}
        onCancel={() => onModeChange("view")}
        onMove={async (destinationDate) => {
          const moved = await onMove(task, destinationDate);
          if (moved) {
            onModeChange("view");
          }
          return moved;
        }}
      />
    );
  }

  if (mode === "create" || mode === "edit") {
    const editorTask = mode === "edit" ? task : null;
    return (
      <TaskEditor
        task={editorTask}
        initiatingDate={initiatingDate}
        externalError={externalError}
        isSaving={isSaving}
        surface={surface}
        showHeading={showHeading}
        onCancel={() => onModeChange(editorTask === null ? null : "view")}
        onSave={async (command) => {
          const saved = await onSave(command);
          if (saved) {
            onModeChange("view");
          }
          return saved;
        }}
      />
    );
  }

  return (
    <TaskInspector
      task={task}
      surface={surface}
      showHeading={showHeading}
      onToggleComplete={onToggleComplete}
      onEdit={() => onModeChange("edit")}
      onMoveToDate={() => onModeChange("move")}
      onDelete={onDelete}
    />
  );
}

function TaskMovePanel({
  task,
  externalError,
  isSaving,
  surface,
  showHeading,
  onCancel,
  onMove,
}: Readonly<{
  task: Task;
  externalError: string | null;
  isSaving: boolean;
  surface: "docked" | "drawer";
  showHeading: boolean;
  onCancel: () => void;
  onMove: (destinationDate: string) => Promise<boolean>;
}>): React.ReactElement {
  const [destinationDate, setDestinationDate] = useState(task.scheduled_date);

  useEffect(() => {
    setDestinationDate(task.scheduled_date);
  }, [task.id, task.scheduled_date]);

  return (
    <section
      className={[
        "jig-task-inspector",
        "jig-task-editor-surface",
        surface === "drawer" ? "jig-task-inspector-drawer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Move task ${task.title}`}
    >
      {showHeading ? (
        <div className="jig-task-inspector-heading">
          <p className="jig-eyebrow">Move task</p>
          <h2>{task.title}</h2>
        </div>
      ) : null}

      {externalError === null ? null : (
        <div className="jig-form-error" role="alert">
          {externalError}
        </div>
      )}

      <DateInput
        label="Destination date"
        value={destinationDate as ISODateString}
        onChange={(value) => {
          if (value !== undefined) {
            setDestinationDate(value);
          }
        }}
        isRequired
        weekStartsOn="mon"
      />

      <p className="jig-secondary-copy">
        Move to date appends the task on that date using the exact-position
        move operation. Editing the task date uses priority-guided insertion.
      </p>

      <div className="jig-editor-primary-actions">
        <Button
          label="Cancel"
          variant="secondary"
          onClick={onCancel}
          isDisabled={isSaving}
        />
        <Button
          label="Move task"
          variant="primary"
          isLoading={isSaving}
          onClick={() => {
            void onMove(destinationDate);
          }}
        />
      </div>
    </section>
  );
}

export interface TaskWorkspaceDrawerProps
  extends Omit<
    TaskWorkspaceContentProps,
    "surface" | "showHeading" | "mode"
  > {
  readonly mode: TaskWorkspaceMode | null;
  readonly onClose: () => void;
}

export function TaskWorkspaceDrawer({
  mode,
  task,
  initiatingDate,
  externalError,
  isSaving,
  onModeChange,
  onSave,
  onMove,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceDrawerProps): React.ReactElement {
  const effectiveMode = mode ?? "view";
  const title =
    effectiveMode === "create"
      ? "Add task"
      : effectiveMode === "edit"
        ? "Edit task"
        : effectiveMode === "move"
          ? "Move task"
          : (task?.title ?? "Task details");
  const subtitle =
    effectiveMode === "create"
      ? formatCivilDate(initiatingDate, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : task === null
        ? undefined
        : formatCivilDate(task.scheduled_date, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

  return (
    <Drawer
      isOpen={mode !== null}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
      label={title}
      side="end"
      width="30rem"
      hasScrim={false}
      purpose={effectiveMode === "view" ? "info" : "form"}
      padding={4}
    >
      <Layout
        height="fill"
        header={
          <DrawerHeader
            title={title}
            subtitle={subtitle}
            onOpenChange={() => {
              if (!isSaving) {
                onClose();
              }
            }}
            hasDivider
          />
        }
        content={
          <LayoutContent>
            <TaskWorkspaceContent
              mode={effectiveMode}
              task={task}
              initiatingDate={initiatingDate}
              externalError={externalError}
              isSaving={isSaving}
              surface="drawer"
              showHeading={false}
              onModeChange={onModeChange}
              onSave={onSave}
              onMove={onMove}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
            />
          </LayoutContent>
        }
      />
    </Drawer>
  );
}
