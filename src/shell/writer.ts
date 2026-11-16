import {
  link,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
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

interface LeaseOwner {
  readonly pid: number;
  readonly token: string | null;
}

function parseLeaseOwner(value: string): LeaseOwner | null {
  const [pidValue, tokenValue] = value.trim().split(":", 2);
  const pid = Number(pidValue);
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }
  return {
    pid,
    token: tokenValue?.length ? tokenValue : null,
  };
}

async function readLeaseOwner(leasePath: string): Promise<LeaseOwner | null> {
  try {
    const contents = await readFile(leasePath, "utf8");
    return parseLeaseOwner(contents);
  } catch {
    // Backward compatibility for an already-running pre-hardening service,
    // whose lease was a directory containing a pid file.
    try {
      const contents = await readFile(resolve(leasePath, "pid"), "utf8");
      return parseLeaseOwner(contents);
    } catch {
      return null;
    }
  }
}

async function removeStaleLease(leasePath: string): Promise<void> {
  await rm(leasePath, { recursive: true, force: true });
}

export async function acquireWriterLease(
  repositoryPath: string,
): Promise<WriterLease> {
  const localPath = resolve(repositoryPath, ".jig", "local");
  const leasePath = resolve(localPath, "writer.lock");
  const token = randomUUID();
  const candidatePath = resolve(
    localPath,
    `writer.lock.${process.pid}.${token}.candidate`,
  );
  const ownerValue = `${process.pid}:${token}\n`;

  await mkdir(localPath, { recursive: true });
  await writeFile(candidatePath, ownerValue, {
    encoding: "utf8",
    flag: "wx",
  });

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // The candidate is fully written before this atomic hard-link publish.
        // A competing process therefore observes either no lease or a complete
        // owner record; there is no partially initialized stale-lock window.
        await link(candidatePath, leasePath);
        await unlink(candidatePath);

        return {
          path: leasePath,
          release: async () => {
            const current = await readLeaseOwner(leasePath);
            if (
              current?.pid === process.pid &&
              current.token === token
            ) {
              await unlink(leasePath).catch(() => undefined);
            }
          },
        };
      } catch {
        const current = await readLeaseOwner(leasePath);
        const stale =
          current !== null && !(await processIsAlive(current.pid));

        if (stale && attempt === 0) {
          await removeStaleLease(leasePath);
          continue;
        }

        throw new RuntimeConfigurationError(
          "Another Jig writer is already active for this data root",
        );
      }
    }
  } finally {
    await unlink(candidatePath).catch(() => undefined);
  }

  throw new RuntimeConfigurationError(
    "Unable to acquire the Jig writer lease",
  );
}
