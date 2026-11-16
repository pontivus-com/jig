import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { RuntimeConfigurationError } from "./config";

export interface WriterLease {
  readonly path: string;
  readonly release: () => Promise<void>;
}

async function processIsAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function acquireWriterLease(
  repositoryPath: string,
): Promise<WriterLease> {
  const localPath = resolve(repositoryPath, ".jig", "local");
  const leasePath = resolve(localPath, "writer.lock");
  await mkdir(localPath, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(leasePath);
      await writeFile(
        resolve(leasePath, "pid"),
        `${process.pid}\n`,
        "utf8",
      );
      return {
        path: leasePath,
        release: async () => {
          await rm(leasePath, { recursive: true, force: true });
        },
      };
    } catch {
      let stale = false;
      try {
        const pid = Number(
          (await readFile(resolve(leasePath, "pid"), "utf8")).trim(),
        );
        stale = !Number.isInteger(pid) || !(await processIsAlive(pid));
      } catch {
        stale = true;
      }

      if (stale && attempt === 0) {
        await rm(leasePath, { recursive: true, force: true });
        continue;
      }

      throw new RuntimeConfigurationError(
        "Another Jig writer is already active for this data root",
      );
    }
  }

  throw new RuntimeConfigurationError(
    "Unable to acquire the Jig writer lease",
  );
}
