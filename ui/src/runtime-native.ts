import type { TaskCommand } from "../../src/core/task";
import type {
  CanonicalState,
  CommandResult,
  Diagnostics,
  RepositorySynchronizationStatus,
  ServiceStatus,
} from "../../src/protocol";

export class NativeRuntimeUnavailableError extends Error {
  constructor(operation: string) {
    super(
      `${operation} is unavailable until the governed Android persistence and Git capabilities are installed`,
    );
    this.name = "NativeRuntimeUnavailableError";
  }
}

function unavailable(operation: string): never {
  throw new NativeRuntimeUnavailableError(operation);
}

export async function readCanonicalTasks(): Promise<CanonicalState> {
  return unavailable("Task reading");
}

export async function readStatus(): Promise<ServiceStatus> {
  return unavailable("Repository status");
}

export async function readDiagnostics(): Promise<Diagnostics> {
  return unavailable("Diagnostics");
}

export async function submitTaskCommand(
  _command: TaskCommand,
  _expectedRevision: number,
): Promise<CommandResult> {
  return unavailable("Task mutation");
}

export async function triggerSync(): Promise<RepositorySynchronizationStatus> {
  return unavailable("Synchronization");
}
