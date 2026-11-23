import {
  BottomSheet,
  Button,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from "@astryxdesign/core";

import {
  SyncConflictActions,
  SyncConflictContent,
  type SyncConflictWorkspaceProps,
} from "../shared/sync-conflict-content";

export function NarrowSyncConflictWorkspace({
  workspace,
}: Readonly<{
  workspace: SyncConflictWorkspaceProps | null;
}>): React.ReactElement {
  const isOpen = workspace !== null && workspace.isOpen;

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && workspace !== null && !workspace.isResolving) {
          workspace.onCancel();
        }
      }}
      label="Resolve sync conflict"
      height="tall"
      hasScrim
      purpose="form"
      padding={4}
    >
      {workspace === null ? null : (
        <Layout
          height="fill"
          header={
            <LayoutHeader hasDivider>
              <div className="jig-sync-conflict-sheet-header">
                <div>
                  <strong>Resolve sync conflict</strong>
                  <span>Choose which planning changes Jig should keep.</span>
                </div>
                <Button
                  label="Close"
                  variant="ghost"
                  size="sm"
                  isDisabled={workspace.isResolving}
                  onClick={workspace.onCancel}
                />
              </div>
            </LayoutHeader>
          }
          content={
            <LayoutContent>
              <SyncConflictContent
                state={workspace.state}
                error={workspace.error}
                isResolving={workspace.isResolving}
                onAction={workspace.onAction}
                onCopyTechnicalDetails={
                  workspace.onCopyTechnicalDetails
                }
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <SyncConflictActions
                state={workspace.state}
                isResolving={workspace.isResolving}
                onCancel={workspace.onCancel}
                onResolve={workspace.onResolve}
              />
            </LayoutFooter>
          }
        />
      )}
    </BottomSheet>
  );
}
