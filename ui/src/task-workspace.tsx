import {
  BottomSheet,
  Button,
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
} from "@astryxdesign/core";
import type { Task, TaskCommand } from "../../src/core/task";
import { formatCivilDate } from "./dates";
import {
  TaskEditor,
  type TaskDraft,
} from "./task-editor";
import { TaskInspector } from "./task-inspector";

export type TaskWorkspaceMode = "view" | "edit" | "create";

export interface TaskWorkspaceContentProps {
  readonly mode: TaskWorkspaceMode;
  readonly task: Task | null;
  readonly initiatingDate: string;
  readonly draft: TaskDraft;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly surface: "docked" | "drawer";
  readonly showHeading: boolean;
  readonly onModeChange: (mode: TaskWorkspaceMode | null) => void;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
}

export function TaskWorkspaceContent({
  mode,
  task,
  initiatingDate,
  draft,
  externalError,
  isSaving,
  surface,
  showHeading,
  onModeChange,
  onDraftChange,
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
        draft={draft}
        externalError={externalError}
        isSaving={isSaving}
        surface={surface}
        showHeading={showHeading}
        onDraftChange={onDraftChange}
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

function workspaceTitle(
  mode: TaskWorkspaceMode,
  task: Task | null,
): string {
  if (mode === "create") {
    return "Add task";
  }
  if (mode === "edit") {
    return "Edit task";
  }
  return task?.title ?? "Task details";
}

function workspaceSubtitle(
  mode: TaskWorkspaceMode,
  task: Task | null,
  initiatingDate: string,
): string | undefined {
  const date = mode === "create" ? initiatingDate : task?.scheduled_date;
  if (date === undefined) {
    return undefined;
  }
  return formatCivilDate(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export interface TaskWorkspaceOverlayProps
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
  draft,
  externalError,
  isSaving,
  onModeChange,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const effectiveMode = mode ?? "view";
  const title = workspaceTitle(effectiveMode, task);
  const subtitle = workspaceSubtitle(effectiveMode, task, initiatingDate);

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
              draft={draft}
              externalError={externalError}
              isSaving={isSaving}
              surface="drawer"
              showHeading={false}
              onModeChange={onModeChange}
              onDraftChange={onDraftChange}
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

export function TaskWorkspaceBottomSheet({
  mode,
  task,
  initiatingDate,
  draft,
  externalError,
  isSaving,
  onModeChange,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const effectiveMode = mode ?? "view";
  const title = workspaceTitle(effectiveMode, task);
  const subtitle = workspaceSubtitle(effectiveMode, task, initiatingDate);

  return (
    <BottomSheet
      isOpen={mode !== null}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
      label={title}
      height={effectiveMode === "view" ? "capped" : "tall"}
      hasScrim={false}
      purpose={effectiveMode === "view" ? "info" : "form"}
      padding={4}
    >
      <div className="jig-task-sheet-header">
        <div>
          <strong>{title}</strong>
          {subtitle === undefined ? null : <span>{subtitle}</span>}
        </div>
        <Button
          label="Close"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!isSaving) {
              onClose();
            }
          }}
        />
      </div>
      <TaskWorkspaceContent
        mode={effectiveMode}
        task={task}
        initiatingDate={initiatingDate}
        draft={draft}
        externalError={externalError}
        isSaving={isSaving}
        surface="drawer"
        showHeading={false}
        onModeChange={onModeChange}
        onDraftChange={onDraftChange}
        onSave={onSave}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
      />
    </BottomSheet>
  );
}
