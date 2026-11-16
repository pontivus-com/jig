import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type ReleaseArch = {
  readonly name: "x64" | "arm64";
  readonly bunArchive: string;
  readonly bunDirectory: string;
  readonly asset: string;
};

const ARCHES: readonly ReleaseArch[] = [
  {
    name: "x64",
    bunArchive: "bun-linux-x64.zip",
    bunDirectory: "bun-linux-x64",
    asset: "jig-linux-x64.tar.gz",
  },
  {
    name: "arm64",
    bunArchive: "bun-linux-aarch64.zip",
    bunDirectory: "bun-linux-aarch64",
    asset: "jig-linux-arm64.tar.gz",
  },
];

const git = (...args: readonly string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  readonly version?: unknown;
};
if (
  typeof packageJson.version !== "string" ||
  !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(
    packageJson.version,
  )
) {
  throw new TypeError("package.json contains an invalid release version");
}

const version = packageJson.version;
const bunVersion = readFileSync(".bun-version", "utf8").trim();
if (!/^\d+\.\d+\.\d+$/.test(bunVersion)) {
  throw new TypeError(".bun-version contains an invalid Bun version");
}

const gitCommit = git("rev-parse", "HEAD");
if (!/^[0-9a-f]{40}$/.test(gitCommit)) {
  throw new TypeError("release packaging requires an exact Git commit");
}

const commitEpoch = git("show", "-s", "--format=%ct", "HEAD");
if (!/^[0-9]+$/.test(commitEpoch)) {
  throw new TypeError("release packaging could not resolve the commit timestamp");
}

if (!existsSync("dist/index.html")) {
  throw new TypeError("release packaging requires the production dist/ build");
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
const escapedVersion = version.replaceAll(".", "\\.");
const headingPattern = new RegExp(
  "^## \\[" + escapedVersion + "\\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$",
  "m",
);
const heading = headingPattern.exec(changelog);
if (heading === null || heading.index === undefined) {
  throw new TypeError(
    `CHANGELOG.md does not contain the released ${version} section`,
  );
}

const headingEnd = changelog.indexOf("\n", heading.index);
const bodyStart = headingEnd === -1 ? changelog.length : headingEnd + 1;
const nextHeading = changelog.indexOf("\n## [", bodyStart);
const releaseBody = changelog
  .slice(bodyStart, nextHeading === -1 ? changelog.length : nextHeading)
  .trim();
if (releaseBody.length === 0) {
  throw new TypeError("released changelog section must not be empty");
}

const outputRoot = resolve(process.argv[2] ?? "release");
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const staging = mkdtempSync(join(tmpdir(), "jig-release-"));

const copyInto = (source: string, root: string): void => {
  const destination = join(root, source);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
};

const digest = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

try {
  const bootstrap = join(outputRoot, "jig-install.sh");
  cpSync("scripts/install-release.sh", bootstrap);
  chmodSync(bootstrap, 0o755);

  for (const arch of ARCHES) {
    const archRoot = join(staging, arch.name);
    const jigRoot = join(archRoot, "jig");
    mkdirSync(jigRoot, { recursive: true });

    for (const source of [
      "src",
      "dist",
      "assets",
      "scripts/install.sh",
      "scripts/jig",
      "package.json",
      "bun.lock",
      ".bun-version",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "docs/install.md",
      "docs/design/brand-and-theme.md",
      "docs/product/product-identity.md",
    ]) {
      copyInto(source, jigRoot);
    }

    chmodSync(join(jigRoot, "scripts/install.sh"), 0o755);
    chmodSync(join(jigRoot, "scripts/jig"), 0o755);

    const bunZip = join(staging, arch.bunArchive);
    const bunUrl =
      `https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/${arch.bunArchive}`;
    execFileSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--proto",
        "=https",
        "--tlsv1.2",
        bunUrl,
        "--output",
        bunZip,
      ],
      { stdio: "inherit" },
    );

    const unpack = join(staging, `bun-${arch.name}`);
    mkdirSync(unpack, { recursive: true });
    execFileSync("unzip", ["-q", bunZip, "-d", unpack]);

    const runtimeDir = join(jigRoot, "runtime");
    mkdirSync(runtimeDir, { recursive: true });
    cpSync(join(unpack, arch.bunDirectory, "bun"), join(runtimeDir, "bun"));
    chmodSync(join(runtimeDir, "bun"), 0o755);

    writeFileSync(
      join(jigRoot, "RELEASE.json"),
      JSON.stringify(
        {
          version,
          gitCommit,
          platform: "linux",
          arch: arch.name,
          bunVersion,
        },
        null,
        2,
      ) + "\n",
    );

    const tarPath = join(outputRoot, arch.asset.replace(/\.gz$/, ""));
    execFileSync("tar", [
      "--sort=name",
      `--mtime=@${commitEpoch}`,
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "-cf",
      tarPath,
      "-C",
      archRoot,
      "jig",
    ]);
    execFileSync("gzip", ["-n", "-f", tarPath]);

    const generated = tarPath + ".gz";
    const destination = join(outputRoot, arch.asset);
    if (generated !== destination) {
      renameSync(generated, destination);
    }
  }

  const checksumPaths = [
    ...ARCHES.map((arch) => arch.asset),
    "jig-install.sh",
  ];
  writeFileSync(
    join(outputRoot, "SHA256SUMS"),
    checksumPaths
      .map((name) => `${digest(join(outputRoot, name))}  ${name}`)
      .join("\n") + "\n",
  );

  writeFileSync(
    join(outputRoot, "release-notes.md"),
    `# Jig ${version}\n\n${releaseBody}\n`,
  );

  process.stdout.write(
    [
      ...ARCHES.map((arch) => join(outputRoot, arch.asset)),
      join(outputRoot, "SHA256SUMS"),
      bootstrap,
    ].join("\n") + "\n",
  );
} finally {
  rmSync(staging, { recursive: true, force: true });
}
