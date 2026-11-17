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

export type TaskWorkspaceMode = "task" | "create";

export interface TaskWorkspaceContentProps {
  readonly mode: TaskWorkspaceMode;
  readonly task: Task | null;
  readonly initiatingDate: string;
  readonly draft: TaskDraft;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onClose: () => void;
}

export function TaskWorkspaceContent({
  task,
  initiatingDate,
  draft,
  externalError,
  isSaving,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceContentProps): React.ReactElement {
  return (
    <div className="jig-task-workspace-form">
      <TaskEditor
        task={task}
        initiatingDate={initiatingDate}
        draft={draft}
        externalError={externalError}
        isSaving={isSaving}
        onDraftChange={onDraftChange}
        onCancel={onClose}
        onSave={onSave}
      />
      {task === null ? null : (
        <div className="jig-task-workspace-actions">
          <Button
            label={task.completed_at === null ? "Mark complete" : "Reopen"}
            variant="secondary"
            size="sm"
            onClick={() => {
              void onToggleComplete(task);
            }}
            isDisabled={isSaving}
          />
          <Button
            label="Delete…"
            variant="ghost"
            size="sm"
            className="jig-inspector-delete"
            onClick={() => onDelete(task)}
            isDisabled={isSaving}
          />
        </div>
      )}
    </div>
  );
}

function workspaceTitle(
  mode: TaskWorkspaceMode,
  task: Task | null,
): string {
  return mode === "create" ? "Add task" : task?.title ?? "Task";
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
  extends Omit<TaskWorkspaceContentProps, "mode"> {
  readonly mode: TaskWorkspaceMode | null;
}

export function TaskWorkspaceDrawer({
  mode,
  task,
  initiatingDate,
  draft,
  externalError,
  isSaving,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const effectiveMode = mode ?? "task";
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
      purpose="form"
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
              onDraftChange={onDraftChange}
              onSave={onSave}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
              onClose={onClose}
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
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const effectiveMode = mode ?? "task";
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
      height="tall"
      hasScrim={false}
      purpose="form"
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
        onDraftChange={onDraftChange}
        onSave={onSave}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
        onClose={onClose}
      />
    </BottomSheet>
  );
}
