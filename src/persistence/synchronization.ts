import type { SynchronizationLineage } from "../core/synchronization";
import {
  portableSnapshotsEqual,
  serializeSnapshot,
  type PortableSnapshot,
} from "../portable";
import {
  adoptCanonicalSnapshot,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "./sqlite";

export interface PersistedPortableSnapshot {
  readonly head: string;
  readonly snapshot: PortableSnapshot;
}

export interface PresentSynchronizationObservation {
  readonly local_head: string | null;
  readonly remote_head: string;
  readonly lineage: SynchronizationLineage;
  readonly remote_snapshot: PortableSnapshot;
}

export type InterruptedAdoptionResult =
  | "not-applicable"
  | "finished"
  | "unsafe";

export type AlignPortableHead = (
  expectedHead: string,
  targetHead: string,
) => Promise<void>;

export async function synchronizationPending(
  db: JigSqlConnection,
): Promise<boolean> {
  const metadata = await readMetadata(db);
  return (
    metadata.revision !== metadata.last_exported_revision ||
    metadata.last_exported_head === null ||
    metadata.pending_sync
  );
}

export type ReadPersistedPortableSnapshot = (
  datasetId: string,
) => Promise<PersistedPortableSnapshot | null>;

export async function reconcilePersistedPortableSnapshot(
  db: JigSqlConnection,
  readCurrent: ReadPersistedPortableSnapshot,
): Promise<void> {
  const metadata = await readMetadata(db);
  const state = await readCanonicalState(db);
  const current = await readCurrent(metadata.dataset_id);
  if (current === null) {
    return;
  }
  const canonical = serializeSnapshot(
    state.tasks,
    metadata.dataset_id,
    state.recurrences,
  );

  if (portableSnapshotsEqual(current.snapshot, canonical)) {
    if (
      metadata.last_exported_head !== current.head ||
      metadata.last_exported_revision !== state.revision
    ) {
      await markExported(db, state.revision, current.head);
    }
    return;
  }

  if (
    state.revision !== metadata.last_exported_revision ||
    metadata.pending_sync
  ) {
    return;
  }

  const adopted = await adoptCanonicalSnapshot(
    db,
    current.snapshot.tasks,
    current.snapshot.recurrences,
    null,
    state.revision,
  );
  await markExported(db, adopted.revision, current.head);
}

export async function finishInterruptedSynchronizationAdoption(
  db: JigSqlConnection,
  observation: PresentSynchronizationObservation,
  align: AlignPortableHead,
): Promise<InterruptedAdoptionResult> {
  const state = await readCanonicalState(db);
  const metadata = await readMetadata(db);

  if (metadata.last_adopted_head !== observation.remote_head) {
    return "not-applicable";
  }

  const canonical = serializeSnapshot(
    state.tasks,
    metadata.dataset_id,
    state.recurrences,
  );
  if (!portableSnapshotsEqual(canonical, observation.remote_snapshot)) {
    return "not-applicable";
  }

  if (
    observation.local_head === null ||
    (
      observation.lineage !== "equal" &&
      observation.lineage !== "remote-ahead"
    )
  ) {
    return "unsafe";
  }

  if (observation.local_head !== observation.remote_head) {
    try {
      await align(observation.local_head, observation.remote_head);
    } catch {
      return "unsafe";
    }
  }

  await markExported(db, state.revision, observation.remote_head);
  return "finished";
}

export async function adoptObservedSynchronizationRemote(
  db: JigSqlConnection,
  observation: PresentSynchronizationObservation,
  expectedRevision: number,
  align: AlignPortableHead,
): Promise<void> {
  if (observation.local_head === null) {
    throw new Error("Local jig-data head is unavailable");
  }

  const adopted = await adoptCanonicalSnapshot(
    db,
    observation.remote_snapshot.tasks,
    observation.remote_snapshot.recurrences,
    observation.remote_head,
    expectedRevision,
  );
  await align(observation.local_head, observation.remote_head);
  await markExported(db, adopted.revision, observation.remote_head);
}
