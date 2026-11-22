import {
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
  LayoutFooter,
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

export function DesktopTaskWorkspace({
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
                className="jig-task-workspace-actions-desktop"
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
    </Drawer>
  );
}
