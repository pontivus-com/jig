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
import {
  loadConfig,
  loadConfigIfPresent,
  RuntimeConfigurationError,
} from "../../src/shell/config";

const roots: string[] = [];

async function fixturePath(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-config-"));
  roots.push(root);
  return join(root, name);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("runtime configuration mode", () => {
  it("treats a missing config as bootstrap state", async () => {
    const path = await fixturePath("missing.json");
    await expect(loadConfigIfPresent(path)).resolves.toBeNull();
    await expect(loadConfig(path)).rejects.toThrow(
      /configuration does not exist/,
    );
  });

  it("does not treat malformed config as bootstrap state", async () => {
    const path = await fixturePath("config.json");
    await writeFile(path, "{not-json}\n", "utf8");

    await expect(loadConfigIfPresent(path)).rejects.toBeInstanceOf(
      RuntimeConfigurationError,
    );
  });

  it("loads a complete version-1 config unchanged", async () => {
    const path = await fixturePath("config.json");
    const value = {
      version: 1,
      repository_path: "/tmp/planning",
      http_port: 47831,
    } as const;
    await writeFile(path, JSON.stringify(value), "utf8");

    await expect(loadConfigIfPresent(path)).resolves.toStrictEqual(value);
  });
});
