import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
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
import {
  clearGitHubCredential,
  loadCurrentGitHubCredential,
  loadGitHubCredential,
  storeGitHubCredential,
} from "../../src/shell/secret-service";

const roots: string[] = [];
const originalPath = process.env.PATH;
const originalStore = process.env.JIG_SECRET_STORE;

afterEach(async () => {
  process.env.PATH = originalPath;
  if (originalStore === undefined) {
    delete process.env.JIG_SECRET_STORE;
  } else {
    process.env.JIG_SECRET_STORE = originalStore;
  }
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function installFakeSecretTool(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-secret-tool-"));
  roots.push(root);
  const bin = join(root, "bin");
  await mkdir(bin);
  const executable = join(bin, "secret-tool");
  await writeFile(
    executable,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'case "${1:-}" in',
      '  store) cat > "${JIG_SECRET_STORE:?}" ;;',
      '  lookup) [[ -f "${JIG_SECRET_STORE:?}" ]] && cat "${JIG_SECRET_STORE}" ;;',
      '  clear) rm -f "${JIG_SECRET_STORE:?}" ;;',
      "  *) exit 2 ;;",
      "esac",
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(executable, 0o700);
  process.env.PATH = bin + ":" + (originalPath ?? "");
  process.env.JIG_SECRET_STORE = join(root, "stored.json");
  return root;
}

describe("Linux GitHub Secret Service adapter", () => {
  it("stores only the governed GitHub credential payload and can load/clear it", async () => {
    const root = await installFakeSecretTool();
    const credential = {
      user_id: 123,
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      access_token_expires_at: "2030-01-01T00:00:00Z",
      refresh_token_expires_at: "2030-02-01T00:00:00Z",
    } as const;

    await storeGitHubCredential(credential);

    const stored = JSON.parse(
      await readFile(join(root, "stored.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual([
      "access_token",
      "access_token_expires_at",
      "refresh_token",
      "refresh_token_expires_at",
      "user_id",
    ]);
    await expect(loadGitHubCredential(123)).resolves.toStrictEqual(
      credential,
    );
    await expect(loadCurrentGitHubCredential()).resolves.toStrictEqual(
      credential,
    );

    await clearGitHubCredential(123);
    await expect(loadGitHubCredential(123)).resolves.toBeNull();
  });
});
