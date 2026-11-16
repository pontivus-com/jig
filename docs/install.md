# Install Jig

Jig v1 supports Linux x86_64/amd64 and aarch64/arm64.

The supported public installation path is the immutable GitHub Release bundle. Each release contains the pinned Bun runtime and production UI, so an ambient Bun installation is not required.

## Requirements

- Linux;
- Git;
- `curl`;
- `tar`;
- a writable existing Git repository, or a Git URL and new/empty checkout location;
- `systemd --user` for the normal background-service path.

If `systemd --user` is unavailable, installation still verifies the foreground runtime and `jig serve` remains available.

## Install into an existing repository

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

Optionally select a Git remote for automatic background synchronization:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo --remote origin
```

## Clone the planning repository during installation

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- \
      --repo-url git@github.com:you/planning.git \
      --checkout /absolute/new/path/planning \
      --remote origin
```

The checkout path must be new or empty. Jig never initializes an arbitrary non-repository directory and never overwrites an existing non-empty checkout.

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

Planning data remains inside the repository you selected:

```text
<repo>/.jig/local/jig.sqlite
<repo>/.jig/git/
refs/heads/jig-data
```

The selected repository's ordinary branch, index, staged files and unrelated content are not used by Jig's automatic synchronization.

## Use Jig

```bash
jig
jig status
jig sync
jig doctor
```

`jig` starts the user service when necessary and opens the loopback UI. If no desktop URL opener is available it prints the local URL.

## Move Jig to another planning repository

```bash
jig configure --repo /absolute/path/to/new/repository
```

Migration validates and prepares the destination before switching configuration. Failure leaves the original repository active.

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
