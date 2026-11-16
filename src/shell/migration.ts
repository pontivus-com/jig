import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Database } from "bun:sqlite";
import {
  commitSnapshot,
  ensureJigDataWorktree,
  ensureJigLocalExclude,
  runGit,
  serializeSnapshot,
  type GitAdapterConfig,
  type PortableSnapshot,
} from "./git";
import {
  adoptCanonicalSnapshot,
  DATA_REF,
  initializeDatabase,
  markExported,
  openDatabase,
  readCanonicalState,
  readMetadata,
  type RepositoryStatus,
} from "./sqlite";
import {
  inspectLocalCandidate,
  inspectRemoteCandidate,
  InstallationError,
  selectRemote,
  validateSelectedRepository,
} from "./setup";
import {
  writeConfigAtomic,
  type JigConfig,
} from "./config";
import { acquireWriterLease } from "./writer";

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function sameSnapshot(
  left: PortableSnapshot,
  right: PortableSnapshot,
): boolean {
  if (left.files.size !== right.files.size) {
    return false;
  }
  for (const [path, content] of left.files) {
    if (right.files.get(path) !== content) {
      return false;
    }
  }
  return true;
}

export async function migrateRepository(options: {
  readonly source_db: Database;
  readonly source_config: JigConfig;
  readonly destination_path: string;
  readonly flush_source: () => Promise<RepositoryStatus>;
  readonly config_path?: string;
}): Promise<JigConfig> {
  const sourcePath = options.source_config.repository_path;
  const destinationPath = await validateSelectedRepository(
    options.destination_path,
  );

  if (destinationPath === sourcePath) {
    return options.source_config;
  }

  await options.flush_source();
  const sourceMetadata = readMetadata(options.source_db);
  const sourceState = readCanonicalState(options.source_db);
  if (
    sourceMetadata.last_exported_revision !== sourceState.revision ||
    sourceMetadata.pending_sync
  ) {
    throw new MigrationError(
      "Latest local state could not be exported before migration",
    );
  }

  const datasetId = sourceMetadata.dataset_id;
  const sourceSnapshot = serializeSnapshot(
    sourceState.tasks,
    datasetId,
  );
  const destinationRemote = await selectRemote(destinationPath);
  await ensureJigLocalExclude(destinationPath);

  let local;
  let remote;
  try {
    [local, remote] = await Promise.all([
      inspectLocalCandidate(destinationPath),
      inspectRemoteCandidate(destinationPath, destinationRemote),
    ]);
  } catch (error) {
    throw new MigrationError(
      `Destination Jig snapshot could not be validated: ${String(error)}`,
    );
  }

  if (local !== null && remote !== null && local.head !== remote.head) {
    throw new MigrationError(
      "Destination local and remote jig-data refs differ; reconcile them with ordinary Git tooling first",
    );
  }

  const candidate = local ?? remote;
  if (candidate !== null) {
    if (candidate.snapshot.dataset_id !== datasetId) {
      throw new MigrationError(
        "Destination belongs to a different Jig dataset",
      );
    }
    if (!sameSnapshot(candidate.snapshot, sourceSnapshot)) {
      throw new MigrationError(
        "Destination Jig snapshot differs from the current complete source snapshot",
      );
    }
  }

  if (local === null && remote !== null) {
    const update = await runGit(destinationPath, [
      "update-ref",
      DATA_REF,
      remote.head,
    ]);
    if (update.exit_code !== 0) {
      throw new MigrationError(
        update.stderr || "Unable to adopt the validated destination remote snapshot",
      );
    }
  }

  const destinationLease = await acquireWriterLease(destinationPath);
  try {
    const sqlitePath = resolve(
      destinationPath,
      ".jig",
      "local",
      "jig.sqlite",
    );
    const databaseExists = await exists(sqlitePath);

    if (databaseExists) {
      const destinationDb = openDatabase(sqlitePath);
      try {
        const metadata = readMetadata(destinationDb);
        if (metadata.dataset_id !== datasetId) {
          throw new MigrationError(
            "Destination SQLite database belongs to a different Jig dataset",
          );
        }
        const destinationSnapshot = serializeSnapshot(
          readCanonicalState(destinationDb).tasks,
          datasetId,
        );
        if (!sameSnapshot(destinationSnapshot, sourceSnapshot)) {
          throw new MigrationError(
            "Destination SQLite state differs from the current source state",
          );
        }
      } finally {
        destinationDb.close();
      }
    }

    const adapter: GitAdapterConfig = {
      repository_path: destinationPath,
      worktree_path: resolve(destinationPath, ".jig", "git"),
      remote_name: destinationRemote,
    };
    await ensureJigDataWorktree(adapter, datasetId);

    const destinationDb = databaseExists
      ? openDatabase(sqlitePath)
      : initializeDatabase(sqlitePath, datasetId);
    try {
      if (!databaseExists) {
        adoptCanonicalSnapshot(
          destinationDb,
          sourceState.tasks,
          candidate?.head ?? null,
        );
      }

      const destinationState = readCanonicalState(destinationDb);
      const committedHead = await commitSnapshot(
        adapter,
        serializeSnapshot(destinationState.tasks, datasetId),
        destinationState.revision,
      );
      markExported(
        destinationDb,
        destinationState.revision,
        committedHead,
      );
    } finally {
      destinationDb.close();
    }

    const migratedConfig: JigConfig = {
      version: 1,
      repository_path: destinationPath,
      remote_name: destinationRemote,
      data_ref: DATA_REF,
      http_port: options.source_config.http_port,
    };

    await writeConfigAtomic(migratedConfig, options.config_path);
    return migratedConfig;
  } catch (error) {
    if (
      error instanceof MigrationError ||
      error instanceof InstallationError
    ) {
      throw error;
    }
    throw new MigrationError(String(error));
  } finally {
    await destinationLease.release();
  }
}
