import {
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
} from "@astryxdesign/core";
import type { Task, TaskCommand } from "../../src/core/task";
import { formatCivilDate } from "./dates";
import { TaskEditor } from "./task-editor";
import { TaskInspector } from "./task-inspector";

export type TaskWorkspaceMode = "view" | "edit" | "create";

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
  onDelete,
  onToggleComplete,
}: TaskWorkspaceContentProps): React.ReactElement {
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
      onDelete={onDelete}
    />
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
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
            />
          </LayoutContent>
        }
      />
    </Drawer>
  );
}
