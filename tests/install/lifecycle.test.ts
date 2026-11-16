import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { runGit } from "../../src/shell/git";
import { acquireWriterLease } from "../../src/shell/writer";

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

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("installed lifecycle boundaries", () => {
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
