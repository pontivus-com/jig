import {
  BottomSheet,
  Button,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from "@astryxdesign/core";
import {
  TASK_WORKSPACE_FORM_ID,
  TaskWorkspaceActions,
  TaskWorkspaceContent,
  useTaskWorkspacePresentation,
  workspaceSubtitle,
  workspaceTitle,
  type TaskWorkspaceOverlayProps,
} from "../../task-workspace";

export function NarrowTaskWorkspace({
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
  const {
    contentRef,
    session: workspaceSession,
    renderedWorkspace,
  } = useTaskWorkspacePresentation(workspace);
  const title =
    renderedWorkspace === null ? "Task" : workspaceTitle(renderedWorkspace);

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
                editorFormId={TASK_WORKSPACE_FORM_ID}
                workspace={renderedWorkspace}
                workspaceSession={workspaceSession}
                externalError={externalError}
                isSaving={isSaving}
                recurrenceSeries={recurrenceSeries}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onClose={onClose}
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <TaskWorkspaceActions
                className="jig-task-workspace-actions-narrow"
                formId={TASK_WORKSPACE_FORM_ID}
                workspace={renderedWorkspace}
                isSaving={isSaving}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
                onClose={onClose}
              />
            </LayoutFooter>
          }
        />
      )}
    </BottomSheet>
  );
}
