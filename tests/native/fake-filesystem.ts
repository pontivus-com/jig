import {
  Encoding,
  type FileInfo,
} from "@capacitor/filesystem";
import type { AndroidFilesystemPort } from "../../ui/src/native/git-filesystem";

class FakePluginError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface FakeFile {
  readonly kind: "file";
  readonly bytes: Uint8Array;
  readonly mtime: number;
}

interface FakeDirectory {
  readonly kind: "directory";
  readonly mtime: number;
}

export type FakeEntry = FakeFile | FakeDirectory;

function base64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }
  return btoa(value);
}

function unbase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parent(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function fakeFilesystem(): {
  readonly port: AndroidFilesystemPort;
  readonly entries: Map<string, FakeEntry>;
} {
  const entries = new Map<string, FakeEntry>([
    ["", { kind: "directory", mtime: 1 }],
  ]);
  let clock = 10;

  const missing = (path: string): never => {
    throw new FakePluginError(
      "OS-PLUG-FILE-0008",
      `${path} does not exist`,
    );
  };

  const ensureDirectory = (path: string): void => {
    const entry = entries.get(path);
    if (entry?.kind !== "directory") {
      missing(path);
    }
  };

  const makeParents = (path: string): void => {
    const segments = path.split("/").filter(Boolean);
    let current = "";
    for (const segment of segments) {
      current = current.length === 0 ? segment : `${current}/${segment}`;
      if (!entries.has(current)) {
        entries.set(current, {
          kind: "directory",
          mtime: clock++,
        });
      }
    }
  };

  const info = (path: string, entry: FakeEntry): FileInfo => ({
    name: path.slice(path.lastIndexOf("/") + 1),
    type: entry.kind,
    size: entry.kind === "file" ? entry.bytes.length : 0,
    ctime: entry.mtime,
    mtime: entry.mtime,
    uri: `file:///${path}`,
  });

  const port: AndroidFilesystemPort = {
    async readFile(options) {
      const entry = entries.get(options.path);
      if (entry === undefined || entry.kind !== "file") {
        missing(options.path);
      }
      const data =
        options.encoding === Encoding.UTF8
          ? new TextDecoder().decode(entry.bytes)
          : base64(entry.bytes);
      return { data };
    },
    async writeFile(options) {
      if (typeof options.data !== "string") {
        throw new Error("Fake native Filesystem expects string data");
      }
      const directory = parent(options.path);
      if (options.recursive === true) {
        makeParents(directory);
      } else {
        ensureDirectory(directory);
      }
      const bytes =
        options.encoding === Encoding.UTF8
          ? new TextEncoder().encode(options.data)
          : unbase64(options.data);
      entries.set(options.path, {
        kind: "file",
        bytes,
        mtime: clock++,
      });
      return { uri: `file:///${options.path}` };
    },
    async deleteFile(options) {
      const entry = entries.get(options.path);
      if (entry?.kind !== "file") {
        missing(options.path);
      }
      entries.delete(options.path);
    },
    async mkdir(options) {
      if (entries.has(options.path)) {
        throw new FakePluginError(
          "OS-PLUG-FILE-0010",
          "already exists",
        );
      }
      const directory = parent(options.path);
      if (options.recursive === true) {
        makeParents(directory);
      } else {
        ensureDirectory(directory);
      }
      entries.set(options.path, {
        kind: "directory",
        mtime: clock++,
      });
    },
    async rmdir(options) {
      const entry = entries.get(options.path);
      if (entry?.kind !== "directory") {
        missing(options.path);
      }
      const prefix = `${options.path}/`;
      const children = [...entries.keys()].filter((path) =>
        path.startsWith(prefix),
      );
      if (children.length > 0 && options.recursive !== true) {
        throw new FakePluginError(
          "OS-PLUG-FILE-0012",
          "directory has children",
        );
      }
      for (const child of children) {
        entries.delete(child);
      }
      entries.delete(options.path);
    },
    async readdir(options) {
      ensureDirectory(options.path);
      const prefix =
        options.path.length === 0 ? "" : `${options.path}/`;
      const files = [...entries.entries()]
        .filter(([path]) => {
          if (!path.startsWith(prefix) || path === options.path) {
            return false;
          }
          return !path.slice(prefix.length).includes("/");
        })
        .map(([path, entry]) => info(path, entry));
      return { files };
    },
    async stat(options) {
      const entry = entries.get(options.path);
      if (entry === undefined) {
        missing(options.path);
      }
      return info(options.path, entry);
    },
  };

  return { port, entries };
}
