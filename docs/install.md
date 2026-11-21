# Install Jig

Jig v1 supports Linux x86_64/amd64 and aarch64/arm64.

The supported public installation path is the immutable GitHub Release bundle. Each release contains the pinned Bun runtime and production UI, so an ambient Bun installation is not required.

## Requirements

- Linux;
- Git;
- `curl`;
- `tar`;
- Git for repository continuity; a repository is selected/acquired inside Jig after a fresh install, while existing `--repo` / `--repo-url` automation remains available;
- `systemd --user` for the normal background-service path.

If `systemd --user` is unavailable, installation still verifies the foreground runtime and `jig serve` remains available.

## Install Jig and choose the repository in the application

The normal v1.1 installation path no longer asks the shell installer to choose a planning repository:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash
```

A fresh installation starts Jig in bootstrap mode on `127.0.0.1:47831`. Open Jig (or run `jig`) and choose:

- **Use a repository already on this computer** — enter the absolute root path of an existing writable Git worktree;
- **Connect GitHub repository** — Jig shows GitHub's required device code, opens/offers GitHub authorization, discovers authorized repository access automatically and continues without manual refresh; a repository chooser appears only when more than one genuine eligible repository requires a choice.

Planner, History, Settings, Task commands and repository synchronization are not mounted until repository setup succeeds. A valid local repository does not need a remote; it becomes a healthy **Local only** Jig installation.

If a complete existing `~/.config/jig/config.json` is already present, rerunning the installer without repository arguments preserves that configuration and the upgraded runtime starts directly in configured mode. A malformed existing config is an error and is never silently treated as first-run state.

`--port` is valid only with the immediate automation modes below. Bootstrap mode always uses port `47831`.

## Automation: install into an existing repository

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

Jig uses the selected repository's Git configuration for automatic synchronization. Git remains responsible for credentials, signing policy, topology and transport semantics.

## Automation: install from a repository URL

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
~/.config/systemd/user/jig.service   # when systemd --user is available
```

`~/.config/jig/config.json` is created only when repository setup succeeds (or preserved during an upgrade of an already configured installation).

Planning data remains inside the repository you selected. SQLite lives under `<repo>/.jig/local/`; deterministic portable Jig records are synchronized through the repository adapter. Any branch/ref/worktree isolation mechanics are internal Git-adapter details and are not part of the user configuration.

The selected repository's unrelated content and ordinary working state are not touched by Jig's automatic synchronization.

## Use Jig

```bash
jig
jig status
jig sync
jig doctor   # optional Jig-health diagnostics when present
```

`jig` starts the user service when necessary and opens the loopback UI. Before repository setup, it opens the bootstrap surface on port 47831. `jig status` and `jig doctor` remain usable in that state; `jig sync` requires a configured repository. If no desktop URL opener is available Jig prints the local URL.

## Use Jig with another repository checkout

Repository movement/cloning is performed with ordinary Git/filesystem tooling. Obtain the desired existing checkout, then install Jig against it with `--repo`. If that repository already contains valid Jig portable data, Jig adopts it automatically. There is no separate Jig repository-migration command.

## Upgrade

Run the installer for the desired release again. A configured installation preserves its existing complete repository configuration when no repository flags are supplied. Installation is idempotent and replaces the application/runtime atomically while preserving repository planning data. Automation may still supply `--repo` explicitly when desired.

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
scripts/install.sh
```

The public release channel is preferred for normal use.


## Android distribution

Jig v1.1 adds the independently installable Android application `com.pontivus.jig`. The first intended public Android distribution target is **F-Droid**, but F-Droid submission/publication is deferred until the app is stable and the required marketing/store material is ready.

Development/debug APKs produced by `bun run android:build:debug` are certification artifacts only. They are not supported GitHub Release assets and are not the public Android installation channel.

The in-repository F-Droid candidate recipe is maintained at:

```text
distribution/fdroid/metadata/com.pontivus.jig.yml
```

External F-Droid submission/publication is deferred until Jig is considered stable and the required marketing/store material is ready. When that distribution activity begins, the submission must be derived from the applicable immutable public source tag and use that tag's exact 40-character release commit SHA in `Builds.commit`. Until F-Droid actually publishes `com.pontivus.jig`, the project must describe Android as implementation/certification complete or publication deferred/pending as appropriate, not publicly available.
