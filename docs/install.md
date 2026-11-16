# Install Jig

Jig v1 supports Linux x86_64/amd64 and aarch64/arm64.

The supported public installation path is the immutable GitHub Release bundle. Each release contains the pinned Bun runtime and production UI, so an ambient Bun installation is not required.

## Requirements

- Linux;
- Git;
- `curl`;
- `tar`;
- a writable existing Git repository, or a Git repository URL plus a new/empty checkout destination;
- `systemd --user` for the normal background-service path.

If `systemd --user` is unavailable, installation still verifies the foreground runtime and `jig serve` remains available.

## Install into an existing repository

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

Jig uses the selected repository's Git configuration for automatic synchronization. Git remains responsible for credentials, signing policy, topology and transport semantics.

## Install from a repository URL

The installer can also identify the target repository by URL and delegate acquisition to Git:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- \
      --repo-url git@github.com:you/planning.git \
      --checkout /absolute/new/path/planning
```

The checkout path must be new or empty. After `git clone` succeeds, installation follows the exact same path as `--repo`; Jig does not introduce separate repository-management semantics.

## Install a pinned version

Replace the latest URL with the immutable release tag:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/download/v1.0.0/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

## What installation creates

Application/runtime:

```text
~/.local/share/jig/
~/.local/bin/jig
~/.config/jig/config.json
~/.config/systemd/user/jig.service   # when systemd --user is available
```

Planning data remains inside the repository you selected. SQLite lives under `<repo>/.jig/local/`; deterministic portable Jig records are synchronized through the repository adapter. Any branch/ref/worktree isolation mechanics are internal Git-adapter details and are not part of the user configuration.

The selected repository's unrelated content and ordinary working state are not touched by Jig's automatic synchronization.

## Use Jig

```bash
jig
jig status
jig sync
jig doctor   # optional Jig-health diagnostics when present
```

`jig` starts the user service when necessary and opens the loopback UI. If no desktop URL opener is available it prints the local URL.

## Use Jig with another repository checkout

Repository movement/cloning is performed with ordinary Git/filesystem tooling. Obtain the desired existing checkout, then install Jig against it with `--repo`. If that repository already contains valid Jig portable data, Jig adopts it automatically. There is no separate Jig repository-migration command.

## Upgrade

Run the installer for the desired release again with the same repository configuration. Installation is idempotent and replaces the application/runtime atomically while preserving the repository's planning data.

For a pinned upgrade, use the desired immutable release tag rather than `latest`.

## Uninstall

```bash
jig uninstall
```

Uninstall removes Jig's application files, launcher, user service and local configuration. It preserves the selected repository's `.jig` planning data by default.

## Source-checkout installation

This path is for contributors/development. It builds from the exact frozen dependency graph rather than using the certified prebuilt release payload.

```bash
git clone https://github.com/pontivus-com/jig.git
cd jig
scripts/install.sh --repo /absolute/path/to/your/planning-repo
```

The public release channel is preferred for normal use.
