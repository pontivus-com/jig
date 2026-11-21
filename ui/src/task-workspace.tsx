import {
  BottomSheet,
  Button,
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from "@astryxdesign/core";
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

interface TaskWorkspaceContentProps {
  readonly editorFormId?: string;
  readonly workspaceSession: number;
  readonly showEditorActions?: boolean;
  readonly workspace: TaskWorkspacePresentation;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onClose: () => void;
}

function workspaceTask(
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

function useWorkspaceSession(
  workspace: TaskWorkspacePresentation | null,
): {
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  readonly session: number;
} {
  const [session, setSession] = useState(0);
  const identity = workspaceIdentity(workspace);
  const previousIdentity = useRef(identity);
  const wasOpen = useRef(identity !== null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  return { contentRef, session };
}

function TaskWorkspaceContent({
  editorFormId,
  workspaceSession,
  showEditorActions = true,
  workspace,
  externalError,
  isSaving,
  recurrenceSeries,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceContentProps): React.ReactElement {
  const task = workspaceTask(workspace);

  return (
    <div className="jig-task-workspace-form">
      <TaskEditor
        key={`${workspaceSession}:${workspace.mode}:${task?.id ?? "create"}`}
        {...(editorFormId === undefined ? {} : { formId: editorFormId })}
        showActions={showEditorActions}
        task={task}
        recurrenceSeries={recurrenceSeries}
        draft={workspace.draft}
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
            onClick={() => {
              void onToggleComplete(task);
            }}
            isDisabled={isSaving}
          />
          <Button
            label="Delete…"
            variant="ghost"
            className="jig-workspace-delete"
            onClick={() => onDelete(task)}
            isDisabled={isSaving}
          />
        </div>
      )}
    </div>
  );
}

function workspaceTitle(
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

function workspaceSubtitle(
  workspace: TaskWorkspacePresentation,
): string {
  return formatCivilDate(workspaceDate(workspace), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export interface TaskWorkspaceOverlayProps
  extends Omit<TaskWorkspaceContentProps, "workspace" | "workspaceSession"> {
  readonly workspace: TaskWorkspacePresentation | null;
}

export function TaskWorkspaceDrawer({
  workspace,
  externalError,
  isSaving,
  recurrenceSeries,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const { contentRef, session: workspaceSession } =
    useWorkspaceSession(workspace);
  const [retainedWorkspace, setRetainedWorkspace] =
    useState<TaskWorkspacePresentation | null>(workspace);
  useEffect(() => {
    if (workspace !== null) {
      setRetainedWorkspace(workspace);
    }
  }, [workspace]);

  const renderedWorkspace = workspace ?? retainedWorkspace;
  const title = renderedWorkspace === null ? "Task" : workspaceTitle(renderedWorkspace);

  return (
    <Drawer
      isOpen={workspace !== null}
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
      {renderedWorkspace === null ? null : (
        <Layout
          height="fill"
          header={
            <DrawerHeader
              title={title}
              subtitle={workspaceSubtitle(renderedWorkspace)}
              onOpenChange={() => {
                if (!isSaving) {
                  onClose();
                }
              }}
              hasDivider
            />
          }
          content={
            <LayoutContent ref={contentRef}>
              <TaskWorkspaceContent
                workspace={renderedWorkspace}
                workspaceSession={workspaceSession}
                externalError={externalError}
                isSaving={isSaving}
                recurrenceSeries={recurrenceSeries}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
                onClose={onClose}
              />
            </LayoutContent>
          }
        />
      )}
    </Drawer>
  );
}

export function TaskWorkspaceBottomSheet({
  workspace,
  externalError,
  isSaving,
  recurrenceSeries,
  onDraftChange,
  onSave,
  onDelete,
  onToggleComplete,
  onClose,
}: TaskWorkspaceOverlayProps): React.ReactElement {
  const { contentRef, session: workspaceSession } =
    useWorkspaceSession(workspace);
  const [retainedWorkspace, setRetainedWorkspace] =
    useState<TaskWorkspacePresentation | null>(workspace);
  useEffect(() => {
    if (workspace !== null) {
      setRetainedWorkspace(workspace);
    }
  }, [workspace]);

  const renderedWorkspace = workspace ?? retainedWorkspace;
  const title = renderedWorkspace === null ? "Task" : workspaceTitle(renderedWorkspace);

  return (
    <BottomSheet
      isOpen={workspace !== null}
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
      {renderedWorkspace === null ? null : (
        <Layout
          height="fill"
          header={
            <LayoutHeader hasDivider>
              <div className="jig-task-sheet-header">
                <div>
                  <strong>{title}</strong>
                  <span>{workspaceSubtitle(renderedWorkspace)}</span>
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
            </LayoutHeader>
          }
          content={
            <LayoutContent ref={contentRef}>
              <TaskWorkspaceContent
                editorFormId="jig-task-bottom-sheet-form"
                showEditorActions={false}
                workspace={renderedWorkspace}
                workspaceSession={workspaceSession}
                externalError={externalError}
                isSaving={isSaving}
                recurrenceSeries={recurrenceSeries}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
                onClose={onClose}
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <div className="jig-editor-actions jig-task-workspace-footer-actions">
                <div className="jig-editor-primary-actions">
                  <Button
                    type="button"
                    label="Cancel"
                    variant="secondary"
                    onClick={onClose}
                    isDisabled={isSaving}
                  />
                  <Button
                    type="submit"
                    form="jig-task-bottom-sheet-form"
                    label={renderedWorkspace.mode === "create" ? "Add task" : "Save"}
                    variant="primary"
                    isLoading={isSaving}
                  />
                </div>
              </div>
            </LayoutFooter>
          }
        />
      )}
    </BottomSheet>
  );
}
