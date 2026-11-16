import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";

export interface JigConfig {
  readonly version: 1;
  readonly repository_path: string;
  readonly http_port: number;
}

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

export function defaultConfigPath(): string {
  return resolve(homedir(), ".config", "jig", "config.json");
}

export function validateConfig(value: unknown): JigConfig {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new RuntimeConfigurationError("Jig configuration must be an object");
  }

  const object = value as Record<string, unknown>;
  const expectedKeys = [
    "version",
    "repository_path",
    "http_port",
  ].sort();
  const actualKeys = Object.keys(object).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new RuntimeConfigurationError(
      "Jig configuration has missing or unknown keys",
    );
  }

  if (object.version !== 1) {
    throw new RuntimeConfigurationError("Unsupported Jig configuration version");
  }
  if (
    typeof object.repository_path !== "string" ||
    !isAbsolute(object.repository_path)
  ) {
    throw new RuntimeConfigurationError(
      "repository_path must be an absolute path",
    );
  }
  if (
    typeof object.http_port !== "number" ||
    !Number.isInteger(object.http_port) ||
    object.http_port < 1024 ||
    object.http_port > 65535
  ) {
    throw new RuntimeConfigurationError(
      "http_port must be an integer from 1024 through 65535",
    );
  }

  return {
    version: 1,
    repository_path: object.repository_path,
    http_port: object.http_port,
  };
}

export async function loadConfig(
  path = defaultConfigPath(),
): Promise<JigConfig> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new RuntimeConfigurationError(
      `Unable to read Jig configuration at ${path}: ${String(error)}`,
    );
  }
  return validateConfig(parsed);
}

export async function writeConfigAtomic(
  config: JigConfig,
  path = defaultConfigPath(),
): Promise<void> {
  const validated = validateConfig(config);
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;

  try {
    await writeFile(
      temporary,
      `${JSON.stringify(validated, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
