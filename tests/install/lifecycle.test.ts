import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Database } from "bun:sqlite";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  commitSnapshot,
  runGit,
  serializeSnapshot,
} from "../../src/shell/git";
import {
  migrateRepository,
  MigrationError,
} from "../../src/shell/migration";
import {
  initializeRepositoryInstallation,
} from "../../src/shell/setup";
import {
  applyTaskCommand,
  markExported,
  openDatabase,
  readCanonicalState,
  readMetadata,
} from "../../src/shell/sqlite";
import {
  acquireWriterLease,
} from "../../src/shell/writer";
import {
  loadConfig,
} from "../../src/shell/config";

const roots: string[] = [];

async function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

async function repository(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `jig-lifecycle-${name}-`));
  roots.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Jig Lifecycle Test"]);
  await git(root, ["config", "user.email", "jig-lifecycle@local.invalid"]);
  await writeFile(join(root, "user.txt"), `${name}\n`, "utf8");
  await git(root, ["add", "user.txt"]);
  await git(root, ["commit", "-m", "User baseline"]);
  return root;
}

async function configFile(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-lifecycle-config-"));
  roots.push(root);
  return join(root, "config.json");
}

async function createExportedTask(
  db: Database,
  repositoryPath: string,
): Promise<void> {
  applyTaskCommand(
    db,
    {
      type: "create",
      title: "Migration survives",
      scheduled_date: "2026-11-16",
      note: "canonical",
    },
    readCanonicalState(db).revision,
    "2026-11-16T01:00:00.000Z",
    () => "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0801",
  );

  const metadata = readMetadata(db);
  const state = readCanonicalState(db);
  const adapter = {
    repository_path: repositoryPath,
    worktree_path: resolve(repositoryPath, ".jig", "git"),
    remote_name: null,
  } as const;
  const head = await commitSnapshot(
    adapter,
    serializeSnapshot(state.tasks, metadata.dataset_id),
    state.revision,
  );
  markExported(db, state.revision, head);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("installed lifecycle boundaries", () => {
  it("switches configuration only after a complete destination migration", async () => {
    const source = await repository("source");
    const destination = await repository("destination");
    const configPath = await configFile();

    const installed = await initializeRepositoryInstallation({
      repository_path: source,
      http_port: 47841,
      config_path: configPath,
    });
    const sourceDb = openDatabase(installed.sqlite_path);

    try {
      await createExportedTask(sourceDb, source);

      const migrated = await migrateRepository({
        source_db: sourceDb,
        source_config: installed.config,
        destination_path: destination,
        flush_source: async () => "local-only",
        config_path: configPath,
      });

      expect(migrated.repository_path).toBe(
        await git(destination, ["rev-parse", "--show-toplevel"]),
      );
      expect((await loadConfig(configPath)).repository_path).toBe(
        migrated.repository_path,
      );

      const destinationDb = openDatabase(
        resolve(destination, ".jig", "local", "jig.sqlite"),
      );
      try {
        expect(readMetadata(destinationDb).dataset_id).toBe(
          readMetadata(sourceDb).dataset_id,
        );
        expect(readCanonicalState(destinationDb).tasks).toStrictEqual(
          readCanonicalState(sourceDb).tasks,
        );
      } finally {
        destinationDb.close();
      }

      expect(readCanonicalState(sourceDb).tasks).toHaveLength(1);
      expect(await readFile(join(source, "user.txt"), "utf8")).toBe(
        "source\n",
      );
      expect(await readFile(join(destination, "user.txt"), "utf8")).toBe(
        "destination\n",
      );
    } finally {
      sourceDb.close();
    }
  });

  it("leaves the original configuration and source dataset active on incompatible destination failure", async () => {
    const source = await repository("failure-source");
    const destination = await repository("failure-destination");
    const sourceConfigPath = await configFile();
    const destinationConfigPath = await configFile();

    const sourceInstall = await initializeRepositoryInstallation({
      repository_path: source,
      http_port: 47842,
      config_path: sourceConfigPath,
    });
    await initializeRepositoryInstallation({
      repository_path: destination,
      http_port: 47843,
      config_path: destinationConfigPath,
    });

    const sourceDb = openDatabase(sourceInstall.sqlite_path);
    try {
      await createExportedTask(sourceDb, source);
      const before = readCanonicalState(sourceDb);

      await expect(
        migrateRepository({
          source_db: sourceDb,
          source_config: sourceInstall.config,
          destination_path: destination,
          flush_source: async () => "local-only",
          config_path: sourceConfigPath,
        }),
      ).rejects.toThrow(MigrationError);

      expect((await loadConfig(sourceConfigPath)).repository_path).toBe(
        sourceInstall.config.repository_path,
      );
      expect(readCanonicalState(sourceDb)).toStrictEqual(before);
    } finally {
      sourceDb.close();
    }
  });

  it("enforces one active writer lease per repository data root", async () => {
    const data = await repository("writer");
    const first = await acquireWriterLease(data);

    await expect(acquireWriterLease(data)).rejects.toThrow(
      /Another Jig writer is already active/,
    );

    await first.release();
    const second = await acquireWriterLease(data);
    await second.release();
  });

  it("atomically admits exactly one concurrent writer", async () => {
    const data = await repository("writer-race");

    const contenders = await Promise.allSettled([
      acquireWriterLease(data),
      acquireWriterLease(data),
    ]);
    const admitted = contenders.filter(
      (result): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof acquireWriterLease>>
      > => result.status === "fulfilled",
    );
    const rejected = contenders.filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );

    expect(admitted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toMatch(
      /Another Jig writer is already active/,
    );

    await admitted[0]?.value.release();
  });
});
