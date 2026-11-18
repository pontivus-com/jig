import {
  Directory,
  Encoding,
  Filesystem,
  type FileInfo,
  type FilesystemPlugin,
} from "@capacitor/filesystem";

export type AndroidFilesystemPort = Pick<
  FilesystemPlugin,
  | "readFile"
  | "writeFile"
  | "deleteFile"
  | "mkdir"
  | "rmdir"
  | "readdir"
  | "stat"
>;

const DEFAULT_SYMLINK_METADATA =
  "repository/.jig/local/android-fs-symlinks.json";

export interface NodeLikeStats {
  readonly size: number;
  readonly mode: number;
  readonly ctimeMs: number;
  readonly mtimeMs: number;
  readonly dev: number;
  readonly ino: number;
  readonly uid: number;
  readonly gid: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface IsomorphicGitPromiseFs {
  readonly promises: {
    readFile(
      path?: string,
      options?: string | Readonly<{ encoding?: string | null }>,
    ): Promise<Uint8Array | string>;
    writeFile(
      path: string,
      data: Uint8Array | string,
      options?: string | Readonly<{ encoding?: string | null }>,
    ): Promise<void>;
    unlink(path: string): Promise<void>;
    readdir(path: string): Promise<readonly string[]>;
    mkdir(path: string): Promise<void>;
    rmdir(
      path: string,
      options?: Readonly<{ recursive?: boolean }>,
    ): Promise<void>;
    stat(path: string): Promise<NodeLikeStats>;
    lstat(path: string): Promise<NodeLikeStats>;
    readlink(
      path: string,
      options?: string | Readonly<{ encoding?: string | null }>,
    ): Promise<Uint8Array | string>;
    symlink(target: string, path: string): Promise<void>;
  };
}

export class AndroidFsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AndroidFsError";
    this.code = code;
  }
}

function objectRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object";
}

function pluginErrorCode(error: unknown): string | null {
  if (!objectRecord(error)) {
    return null;
  }
  const code = error.code;
  return typeof code === "string" ? code : null;
}

function pluginErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (objectRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

function translateFilesystemError(
  operation: string,
  path: string,
  error: unknown,
): AndroidFsError {
  const code = pluginErrorCode(error);
  const nodeCode =
    code === "OS-PLUG-FILE-0008" ||
    code === "OS-PLUG-FILE-0011"
      ? "ENOENT"
      : code === "OS-PLUG-FILE-0010"
        ? "EEXIST"
        : code === "OS-PLUG-FILE-0012"
          ? "ENOTEMPTY"
          : code === "OS-PLUG-FILE-0006"
            ? "EINVAL"
            : "EIO";
  return new AndroidFsError(
    nodeCode,
    `${operation} ${path}: ${pluginErrorMessage(error)}`,
  );
}

function normalizePath(path: string): string {
  if (path.includes("\\0")) {
    throw new AndroidFsError("EINVAL", "Filesystem path contains NUL");
  }
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part.length === 0 || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        throw new AndroidFsError(
          "EACCES",
          `Filesystem path escapes app data root: ${path}`,
        );
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

function resolveRelative(baseDirectory: string, target: string): string {
  return target.startsWith("/")
    ? normalizePath(target)
    : normalizePath(
        baseDirectory.length === 0
          ? target
          : `${baseDirectory}/${target}`,
      );
}

function encodingName(
  options?: string | Readonly<{ encoding?: string | null }>,
): string | null {
  if (typeof options === "string") {
    return options.toLowerCase();
  }
  return options?.encoding?.toLowerCase() ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(bytes.length, offset + chunk)),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function utf8String(value: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(value);
}

function pathHash(path: string): number {
  let hash = 2166136261;
  for (const byte of utf8Bytes(path)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function statsFor(
  path: string,
  info: FileInfo,
  kind: "file" | "directory" | "symlink",
): NodeLikeStats {
  const mode =
    kind === "directory"
      ? 0o040755
      : kind === "symlink"
        ? 0o120777
        : 0o100644;
  const ctime = info.ctime ?? info.mtime;
  return {
    size: info.size,
    mode,
    ctimeMs: ctime,
    mtimeMs: info.mtime,
    dev: 0,
    ino: pathHash(path),
    uid: 0,
    gid: 0,
    isFile: () => kind === "file",
    isDirectory: () => kind === "directory",
    isSymbolicLink: () => kind === "symlink",
  };
}

interface SymlinkRegistry {
  readonly paths: Readonly<Record<string, true>>;
}

function parseSymlinkRegistry(value: string): Set<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AndroidFsError(
      "EIO",
      "Android symlink registry contains invalid JSON",
    );
  }
  if (
    !objectRecord(parsed) ||
    !objectRecord(parsed.paths)
  ) {
    throw new AndroidFsError(
      "EIO",
      "Android symlink registry has an invalid shape",
    );
  }
  const result = new Set<string>();
  for (const [path, marker] of Object.entries(parsed.paths)) {
    if (marker !== true) {
      throw new AndroidFsError(
        "EIO",
        "Android symlink registry contains an invalid marker",
      );
    }
    result.add(normalizePath(path));
  }
  return result;
}

function registryJson(paths: ReadonlySet<string>): string {
  const registry: SymlinkRegistry = {
    paths: Object.fromEntries(
      [...paths]
        .sort((left, right) => left.localeCompare(right))
        .map((path) => [path, true] as const),
    ),
  };
  return `${JSON.stringify(registry, null, 2)}\n`;
}

async function readUtf8File(
  plugin: AndroidFilesystemPort,
  path: string,
): Promise<string> {
  try {
    const result = await plugin.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    if (typeof result.data !== "string") {
      throw new AndroidFsError(
        "EIO",
        `readFile ${path}: native Filesystem returned non-string UTF-8 data`,
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof AndroidFsError) {
      throw error;
    }
    throw translateFilesystemError("readFile", path, error);
  }
}

async function readBinaryFile(
  plugin: AndroidFilesystemPort,
  path: string,
): Promise<Uint8Array> {
  try {
    const result = await plugin.readFile({
      path,
      directory: Directory.Data,
    });
    if (typeof result.data !== "string") {
      throw new AndroidFsError(
        "EIO",
        `readFile ${path}: native Filesystem returned non-string binary data`,
      );
    }
    return base64ToBytes(result.data);
  } catch (error) {
    if (error instanceof AndroidFsError) {
      throw error;
    }
    throw translateFilesystemError("readFile", path, error);
  }
}

async function statRaw(
  plugin: AndroidFilesystemPort,
  path: string,
): Promise<FileInfo> {
  try {
    return await plugin.stat({
      path,
      directory: Directory.Data,
    });
  } catch (error) {
    throw translateFilesystemError("stat", path, error);
  }
}

export function createAndroidGitFilesystem(
  plugin: AndroidFilesystemPort = Filesystem,
  symlinkMetadataPath = DEFAULT_SYMLINK_METADATA,
): IsomorphicGitPromiseFs {
  const metadataPath = normalizePath(symlinkMetadataPath);
  let registryPromise: Promise<Set<string>> | null = null;
  let registryWrite: Promise<void> = Promise.resolve();

  const registry = async (): Promise<Set<string>> => {
    if (registryPromise === null) {
      registryPromise = (async () => {
        try {
          return parseSymlinkRegistry(
            await readUtf8File(plugin, metadataPath),
          );
        } catch (error) {
          if (
            error instanceof AndroidFsError &&
            error.code === "ENOENT"
          ) {
            return new Set<string>();
          }
          throw error;
        }
      })();
    }
    return registryPromise;
  };

  const persistRegistry = async (
    mutate: (paths: Set<string>) => void,
  ): Promise<void> => {
    registryWrite = registryWrite.then(async () => {
      const paths = await registry();
      mutate(paths);
      try {
        await plugin.writeFile({
          path: metadataPath,
          directory: Directory.Data,
          data: registryJson(paths),
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch (error) {
        throw translateFilesystemError(
          "writeFile",
          metadataPath,
          error,
        );
      }
    });
    await registryWrite;
  };

  const isSymlink = async (path: string): Promise<boolean> =>
    (await registry()).has(normalizePath(path));

  const lstat = async (path: string): Promise<NodeLikeStats> => {
    const normalized = normalizePath(path);
    const info = await statRaw(plugin, normalized);
    const kind = (await isSymlink(normalized))
      ? "symlink"
      : info.type;
    return statsFor(normalized, info, kind);
  };

  const statFollowing = async (
    path: string,
    visited: ReadonlySet<string>,
  ): Promise<NodeLikeStats> => {
    const normalized = normalizePath(path);
    if (!(await isSymlink(normalized))) {
      const info = await statRaw(plugin, normalized);
      return statsFor(normalized, info, info.type);
    }
    if (visited.has(normalized)) {
      throw new AndroidFsError(
        "ELOOP",
        `stat ${normalized}: symbolic link cycle`,
      );
    }
    const target = await readUtf8File(plugin, normalized);
    const nextVisited = new Set(visited);
    nextVisited.add(normalized);
    return statFollowing(
      resolveRelative(dirname(normalized), target),
      nextVisited,
    );
  };

  const readFile = async (
    path = "",
    options?: string | Readonly<{ encoding?: string | null }>,
  ): Promise<Uint8Array | string> => {
    const normalized = normalizePath(path);
    if (await isSymlink(normalized)) {
      const target = await readUtf8File(plugin, normalized);
      return readFile(
        resolveRelative(dirname(normalized), target),
        options,
      );
    }
    const encoding = encodingName(options);
    if (encoding === "utf8" || encoding === "utf-8") {
      return readUtf8File(plugin, normalized);
    }
    return readBinaryFile(plugin, normalized);
  };

  return {
    promises: {
      readFile,
      async writeFile(path, data, options) {
        const normalized = normalizePath(path);
        const encoding = encodingName(options);
        try {
          if (
            typeof data === "string" &&
            (encoding === null ||
              encoding === "utf8" ||
              encoding === "utf-8")
          ) {
            await plugin.writeFile({
              path: normalized,
              directory: Directory.Data,
              data,
              encoding: Encoding.UTF8,
            });
          } else {
            const bytes =
              typeof data === "string"
                ? utf8Bytes(data)
                : data;
            await plugin.writeFile({
              path: normalized,
              directory: Directory.Data,
              data: bytesToBase64(bytes),
            });
          }
        } catch (error) {
          throw translateFilesystemError(
            "writeFile",
            normalized,
            error,
          );
        }
      },
      async unlink(path) {
        const normalized = normalizePath(path);
        try {
          await plugin.deleteFile({
            path: normalized,
            directory: Directory.Data,
          });
        } catch (error) {
          throw translateFilesystemError(
            "unlink",
            normalized,
            error,
          );
        }
        if (await isSymlink(normalized)) {
          await persistRegistry((paths) => {
            paths.delete(normalized);
          });
        }
      },
      async readdir(path) {
        const normalized = normalizePath(path);
        try {
          const result = await plugin.readdir({
            path: normalized,
            directory: Directory.Data,
          });
          return result.files.map((file) => file.name);
        } catch (error) {
          throw translateFilesystemError(
            "readdir",
            normalized,
            error,
          );
        }
      },
      async mkdir(path) {
        const normalized = normalizePath(path);
        try {
          await plugin.mkdir({
            path: normalized,
            directory: Directory.Data,
          });
        } catch (error) {
          throw translateFilesystemError(
            "mkdir",
            normalized,
            error,
          );
        }
      },
      async rmdir(path, options) {
        const normalized = normalizePath(path);
        try {
          await plugin.rmdir({
            path: normalized,
            directory: Directory.Data,
            recursive: options?.recursive === true,
          });
        } catch (error) {
          throw translateFilesystemError(
            "rmdir",
            normalized,
            error,
          );
        }
        const prefix = normalized.length === 0 ? "" : `${normalized}/`;
        await persistRegistry((paths) => {
          for (const candidate of [...paths]) {
            if (
              candidate === normalized ||
              candidate.startsWith(prefix)
            ) {
              paths.delete(candidate);
            }
          }
        });
      },
      stat: (path) => statFollowing(path, new Set<string>()),
      lstat,
      async readlink(path, options) {
        const normalized = normalizePath(path);
        if (!(await isSymlink(normalized))) {
          throw new AndroidFsError(
            "EINVAL",
            `readlink ${normalized}: not a symbolic link`,
          );
        }
        const target = await readUtf8File(plugin, normalized);
        const encoding = encodingName(options);
        return encoding === "utf8" || encoding === "utf-8"
          ? target
          : utf8Bytes(target);
      },
      async symlink(target, path) {
        const normalized = normalizePath(path);
        try {
          await statRaw(plugin, normalized);
          throw new AndroidFsError(
            "EEXIST",
            `symlink ${normalized}: path already exists`,
          );
        } catch (error) {
          if (
            !(error instanceof AndroidFsError) ||
            error.code !== "ENOENT"
          ) {
            throw error;
          }
        }

        try {
          await plugin.writeFile({
            path: normalized,
            directory: Directory.Data,
            data: target,
            encoding: Encoding.UTF8,
          });
        } catch (error) {
          throw translateFilesystemError(
            "symlink",
            normalized,
            error,
          );
        }
        await persistRegistry((paths) => {
          paths.add(normalized);
        });
      },
    },
  };
}
