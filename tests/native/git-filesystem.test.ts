import { describe, expect, it } from "vitest";
import {
  AndroidFsError,
  createAndroidGitFilesystem,
} from "../../ui/src/native/git-filesystem";
import { fakeFilesystem } from "./fake-filesystem";

describe("Android isomorphic-git Filesystem adapter", () => {
  it("provides binary/text Node-like operations over private Capacitor storage", async () => {
    const { port } = fakeFilesystem();
    const fs = createAndroidGitFilesystem(port);

    await fs.promises.mkdir("repository");
    await fs.promises.mkdir("repository/work");
    await fs.promises.writeFile(
      "repository/work/blob.bin",
      Uint8Array.from([0, 1, 2, 255]),
    );
    await fs.promises.writeFile(
      "repository/work/text.txt",
      "hello",
      "utf8",
    );

    await expect(
      fs.promises.readFile("repository/work/blob.bin"),
    ).resolves.toStrictEqual(Uint8Array.from([0, 1, 2, 255]));
    await expect(
      fs.promises.readFile("repository/work/text.txt", "utf8"),
    ).resolves.toBe("hello");
    await expect(
      fs.promises.readdir("repository/work"),
    ).resolves.toEqual(["blob.bin", "text.txt"]);

    const file = await fs.promises.lstat(
      "repository/work/text.txt",
    );
    expect(file.isFile()).toBe(true);
    expect(file.isDirectory()).toBe(false);
    expect(file.isSymbolicLink()).toBe(false);
    expect(file.mode >> 12).toBe(0b1000);
  });

  it("persists the minimal symlink semantics required by isomorphic-git across adapter restart", async () => {
    const { port } = fakeFilesystem();
    const first = createAndroidGitFilesystem(port);

    await first.promises.mkdir("repository");
    await first.promises.mkdir("repository/work");
    await first.promises.writeFile(
      "repository/work/target.txt",
      "target",
      "utf8",
    );
    await first.promises.symlink(
      "target.txt",
      "repository/work/link.txt",
    );

    const link = await first.promises.lstat(
      "repository/work/link.txt",
    );
    expect(link.isSymbolicLink()).toBe(true);
    expect(link.mode >> 12).toBe(0b1010);
    await expect(
      first.promises.readlink(
        "repository/work/link.txt",
        "utf8",
      ),
    ).resolves.toBe("target.txt");
    await expect(
      first.promises.readFile(
        "repository/work/link.txt",
        "utf8",
      ),
    ).resolves.toBe("target");

    const restarted = createAndroidGitFilesystem(port);
    const restartedLink = await restarted.promises.lstat(
      "repository/work/link.txt",
    );
    expect(restartedLink.isSymbolicLink()).toBe(true);
    await expect(
      restarted.promises.readlink(
        "repository/work/link.txt",
        "utf8",
      ),
    ).resolves.toBe("target.txt");
  });

  it("maps native Filesystem failures to the Node codes isomorphic-git branches on", async () => {
    const { port } = fakeFilesystem();
    const fs = createAndroidGitFilesystem(port);

    await expect(
      fs.promises.readFile("missing"),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await fs.promises.mkdir("repository");
    await expect(
      fs.promises.mkdir("repository"),
    ).rejects.toMatchObject({ code: "EEXIST" });

    await fs.promises.mkdir("repository/nonempty");
    await fs.promises.writeFile(
      "repository/nonempty/file",
      "data",
      "utf8",
    );
    await expect(
      fs.promises.rmdir("repository/nonempty"),
    ).rejects.toMatchObject({ code: "ENOTEMPTY" });
  });

  it("rejects paths that escape the app-owned data root", async () => {
    const { port } = fakeFilesystem();
    const fs = createAndroidGitFilesystem(port);

    await expect(
      fs.promises.readFile("../../outside"),
    ).rejects.toBeInstanceOf(AndroidFsError);
    await expect(
      fs.promises.readFile("../../outside"),
    ).rejects.toMatchObject({ code: "EACCES" });
  });
});
