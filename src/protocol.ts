import type { Task } from "./core/task";

/**
 * Architecture-neutral API/envelope contracts shared by the imperative shell
 * and browser adapter. These wrap canonical core values; they are not DTOs and
 * do not define a second Task or command schema.
 */
export type LocalGitSnapshotState =
  | "pending"
  | "committed"
  | "issue";

export type RemoteGitSynchronization =
  | {
      readonly state: "not-configured";
      readonly remote_name: null;
      readonly remote_location: null;
    }
  | {
      readonly state:
        | "pending"
        | "retrying"
        | "synchronized"
        | "sync-issue";
      readonly remote_name: string;
      readonly remote_location: string;
    };

export interface RepositorySynchronizationStatus {
  readonly local_git: LocalGitSnapshotState;
  readonly remote: RemoteGitSynchronization;
}

export interface CanonicalState {
  readonly revision: number;
  readonly tasks: readonly Task[];
}

export type CommandResult =
  | { readonly revision: number; readonly task: Task }
  | { readonly revision: number; readonly deleted_task_id: string };

export interface ServiceStatus {
  readonly ready: true;
  readonly repository_path: string;
  readonly repository_status: RepositorySynchronizationStatus;
}

export interface Diagnostics {
  readonly service_healthy: boolean;
  readonly sqlite_available: boolean;
  readonly sqlite_schema_version: number;
  readonly repository_path: string;
  readonly portable_format_version: number;
  readonly repository_adapter_healthy: boolean;
}
