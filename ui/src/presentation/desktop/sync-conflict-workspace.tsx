import {
  Drawer,
  DrawerHeader,
  Layout,
  LayoutContent,
  LayoutFooter,
} from "@astryxdesign/core";

import {
  SyncConflictActions,
  SyncConflictContent,
  type SyncConflictWorkspaceProps,
} from "../shared/sync-conflict-content";

export function DesktopSyncConflictWorkspace({
  workspace,
}: Readonly<{
  workspace: SyncConflictWorkspaceProps | null;
}>): React.ReactElement {
  const isOpen = workspace !== null && workspace.isOpen;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && workspace !== null && !workspace.isResolving) {
          workspace.onCancel();
        }
      }}
      label="Resolve sync conflict"
      side="end"
      width="40rem"
      hasScrim
      purpose="form"
      padding={4}
    >
      {workspace === null ? null : (
        <Layout
          height="fill"
          header={
            <DrawerHeader
              title="Resolve sync conflict"
              subtitle="Choose which planning changes Jig should keep."
              onOpenChange={() => {
                if (!workspace.isResolving) {
                  workspace.onCancel();
                }
              }}
              hasDivider
            />
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
    </Drawer>
  );
}
