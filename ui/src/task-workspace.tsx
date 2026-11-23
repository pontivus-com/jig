import { Button } from "@astryxdesign/core";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Task, TaskCommand } from "../../src/core/task";
import { formatCivilDate } from "./dates";
import { TaskEditor, type TaskDraft } from "./task-editor";
import { useEffect, useRef, useState } from "react";

export type TaskWorkspaceState =
  | { readonly mode: "closed" }
  | {
      readonly mode: "task";
      readonly taskId: string;
      readonly draft: TaskDraft;
    }
  | {
      readonly mode: "create";
      readonly originatingDate: string;
      readonly draft: TaskDraft;
    };

export type TaskWorkspacePresentation =
  | {
      readonly mode: "task";
      readonly task: Task;
      readonly draft: TaskDraft;
    }
  | {
      readonly mode: "create";
      readonly originatingDate: string;
      readonly draft: TaskDraft;
    };

export const TASK_WORKSPACE_FORM_ID = "jig-task-workspace-form";

export interface TaskWorkspaceContentProps {
  readonly editorFormId: string;
  readonly workspaceSession: number;
  readonly workspace: TaskWorkspacePresentation;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onClose: () => void;
}

export interface TaskWorkspaceOverlayProps
  extends Omit<
    TaskWorkspaceContentProps,
    "editorFormId" | "workspace" | "workspaceSession"
  > {
  readonly workspace: TaskWorkspacePresentation | null;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
}

export function workspaceTask(
  workspace: TaskWorkspacePresentation,
): Task | null {
  return workspace.mode === "task" ? workspace.task : null;
}

function workspaceIdentity(
  workspace: TaskWorkspacePresentation | null,
): string | null {
  if (workspace === null) {
    return null;
  }
  return workspace.mode === "task"
    ? `task:${workspace.task.id}`
    : `create:${workspace.originatingDate}`;
}

export function workspaceTitle(
  workspace: TaskWorkspacePresentation,
): string {
  return workspace.mode === "create" ? "Add task" : workspace.task.title;
}

function workspaceDate(
  workspace: TaskWorkspacePresentation,
): string {
  return workspace.mode === "create"
    ? workspace.originatingDate
    : workspace.task.scheduled_date;
}

export function workspaceSubtitle(
  workspace: TaskWorkspacePresentation,
): string {
  return formatCivilDate(workspaceDate(workspace), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function useTaskWorkspacePresentation(
  workspace: TaskWorkspacePresentation | null,
): {
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  readonly session: number;
  readonly renderedWorkspace: TaskWorkspacePresentation | null;
} {
  const [session, setSession] = useState(0);
  const [retainedWorkspace, setRetainedWorkspace] =
    useState<TaskWorkspacePresentation | null>(workspace);
  const identity = workspaceIdentity(workspace);
  const previousIdentity = useRef(identity);
  const wasOpen = useRef(identity !== null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workspace !== null) {
      setRetainedWorkspace(workspace);
    }
  }, [workspace]);

  useEffect(() => {
    if (identity !== null && identity !== previousIdentity.current) {
      contentRef.current?.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
    previousIdentity.current = identity;

    if (identity !== null && !wasOpen.current) {
      setSession((current) => current + 1);
    }
    wasOpen.current = identity !== null;
  }, [identity]);

  return {
    contentRef,
    session,
    renderedWorkspace: workspace ?? retainedWorkspace,
  };
}

export function TaskWorkspaceContent({
  editorFormId,
  workspaceSession,
  workspace,
  externalError,
  isSaving,
  recurrenceSeries,
  onDraftChange,
  onSave,
  onClose,
}: TaskWorkspaceContentProps): React.ReactElement {
  const task = workspaceTask(workspace);

  return (
    <div className="jig-task-workspace-form">
      <TaskEditor
        key={`${workspaceSession}:${workspace.mode}:${task?.id ?? "create"}`}
        formId={editorFormId}
        showActions={false}
        task={task}
        recurrenceSeries={recurrenceSeries}
        draft={workspace.draft}
        externalError={externalError}
        isSaving={isSaving}
        onDraftChange={onDraftChange}
        onCancel={onClose}
        onSave={onSave}
      />
    </div>
  );
}

export interface TaskWorkspaceActionsProps {
  readonly className: string;
  readonly formId: string;
  readonly workspace: TaskWorkspacePresentation;
  readonly isSaving: boolean;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onClose: () => void;
}

export function TaskWorkspaceActions({
  className,
  formId,
  workspace,
  isSaving,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceActionsProps): React.ReactElement {
  const task = workspaceTask(workspace);

  return (
    <div className={["jig-task-workspace-actions", className].join(" ")}>
      {task === null ? null : (
        <div className="jig-task-workspace-lifecycle-actions">
          <Button
            type="button"
            label={task.completed_at === null ? "Mark complete" : "Reopen"}
            variant="secondary"
            onClick={() => {
              void onToggleComplete(task);
            }}
            isDisabled={isSaving}
          />
          <Button
            type="button"
            label="Delete…"
            variant="ghost"
            className="jig-workspace-delete"
            onClick={() => onDelete(task)}
            isDisabled={isSaving}
          />
        </div>
      )}
      <div className="jig-task-workspace-primary-actions">
        <Button
          type="button"
          label="Cancel"
          variant="secondary"
          onClick={onClose}
          isDisabled={isSaving}
        />
        <Button
          type="submit"
          form={formId}
          label={workspace.mode === "create" ? "Add task" : "Save"}
          variant="primary"
          isLoading={isSaving}
        />
      </div>
    </div>
  );
}
