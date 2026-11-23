<h1 align="center">
  <img src="assets/jig-logo-plate-dark.svg" alt="Jig" width="360">
</h1>

<p align="center">
  <strong>Plan the day. Stay on track.</strong>
</p>

<p align="center">
  Jig schedules attention, not project execution. Put lightweight intentions on
  dates, order them explicitly, and reorganize the day without turning personal
  planning into another project-management workflow.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/local--first-planner-101820?style=flat-square" alt="Local-first planner">
  <a href="https://github.com/pontivus-com/jig/actions/workflows/verify.yml"><img src="https://github.com/pontivus-com/jig/actions/workflows/verify.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/pontivus-com/jig/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="Apache-2.0"></a>
  <img src="https://img.shields.io/badge/Bun-1.4.4-blue?style=flat-square" alt="Bun 1.4.4">
  <img src="https://img.shields.io/badge/platform-Linux%20x64%20%2B%20arm64%20%2B%20Android-lightgrey?style=flat-square" alt="Linux x64, Linux arm64 and Android">
  <a href="https://github.com/pontivus-com/jig/releases/latest"><img src="https://img.shields.io/github/v/release/pontivus-com/jig?style=flat-square&label=release" alt="Latest release"></a>
  <a href="https://github.com/pontivus-com/jig/stargazers"><img src="https://img.shields.io/github/stars/pontivus-com/jig?style=flat-square" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#how-it-works"><strong>How it works</strong></a> ·
  <a href="https://github.com/pontivus-com/jig/tree/master/docs"><strong>Docs</strong></a>
</p>

## Plan the day without duplicating the work

Jig is a local-first just-in-time daily planner for one person's lightweight
intentions across projects and obligations.

Planner is the single planning surface. On desktop it shows seven dates as
explicit ordered tracks; on narrow/mobile the same displayed week becomes seven
stacked dated sections. Unfinished prior-day
work is persistently rolled into the current local date, while History keeps
completed work inspectable and reopenable. Optional priority, context, references,
notes and reminder time add just enough detail without creating another workflow
system.

The actual project, issue, WorkItem or document remains authoritative in its own
system. Jig owns only the planning intention: **when to attend to it, where it
sits in the day, whether it is complete, and whether a reminder is due.**

## How it works

1. **Put an intention on a date.** Title and date are enough; everything else is optional.
2. **Order the day explicitly.** Drag or use non-drag movement controls. Priority can assist initial placement but never silently reorders an established plan.
3. **Roll unfinished work forward.** On the local day boundary, unfinished earlier Tasks are persistently moved into the current date so Planner, restart and synchronization agree on the same plan.
4. **Save locally first.** SQLite commits the planning change immediately. Repository export/synchronization happens independently in the background.
5. **Keep Git mechanics outside the planner.** Jig synchronizes only Jig-owned portable data and reports coarse local/pending/synchronized/sync-issue outcomes. Repository acquisition, topology, signing, credentials and reconciliation remain ordinary Git responsibilities.

## Quick start

Jig v1 supports Linux x86_64/amd64 and aarch64/arm64, plus Android through the
production-signed APK published on the matching GitHub Release. The Linux stable
release bundle contains the pinned Bun runtime and production UI.

### Phase 1 — install Jig

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash
```

This installs the certified Jig runtime and starts the local bootstrap service. A
plain `curl -fsSL …/jig-install.sh` only prints the installer source; the
`| bash` is what executes it.

### Phase 2 — choose your planning repository in Jig

```bash
jig
```

Jig opens the local setup flow. Choose either:

- **Use a repository already on this computer** — select an existing writable Git worktree; or
- **Connect GitHub repository** — authorize the shared **Jig Desktop & Mobile** GitHub App, then choose an eligible repository when a choice is required.

Repository setup completes inside Jig. Planner, History, Settings and synchronization
become available only after that second phase succeeds. A repository without a usable
remote remains fully usable in **Local only** mode.

For noninteractive automation, you may still install directly into an existing repository:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

Android users install the production-signed `jig-android.apk` from the matching
GitHub Release. Development/debug APKs are certification artifacts and are not
supported public installation assets.

See [Install Jig](docs/install.md) for Linux setup and automation, Android APK
installation/update, pinned versions, upgrade, Git-native continuity, foreground
fallback and uninstall.

## What stays where

| Data/runtime | Location / owner |
| --- | --- |
| Live planning authority | `<selected-repo>/.jig/local/jig.sqlite` |
| Portable logical records | deterministic Jig records synchronized through the selected repository's Git integration |
| Installed application | `~/.local/share/jig` |
| Launcher | `~/.local/bin/jig` |
| Configuration | `~/.config/jig/config.json` |
| User service | `~/.config/systemd/user/jig.service` when available |
| Unrelated repository branch/index/files | never owned by Jig automatic synchronization |

A successful local Task save never waits for Git transport. Repository
synchronization failure does not roll the save back.

## Useful commands

```bash
jig                 # start/open Jig
jig status          # service and repository status
jig sync            # request repository synchronization
jig doctor          # sanitized diagnostics
jig uninstall       # remove runtime/configuration; preserve repo planning data
```

## Release status

Jig **1.1.2** is the current corrective patch release over v1.1.1.

The release strengthens synchronization continuity and diagnostics, adds bounded recovery for provably related Jig-owned portable-history divergence and the governed in-app semantic-conflict resolver, and keeps unsafe or ambiguous repository states non-destructive. The historical ordinary Desktop synchronization concern was not reproduced by the permanent upgraded reproduction, so this release does not claim or introduce a speculative causal Desktop sync fix.

The application presentation was also corrected across the governed desktop/narrow surfaces: distinct chrome/Planner/Task theme roles, full-height Planner ownership, real Task-card drag placement with projected reflow, viewport-appropriate operational feedback, and the shared slower motion scale are now certified across the supported presentation matrix.

Release governance now explicitly carries the implementation-to-publication handoff. A merged implementation candidate is not treated as a release; the dedicated `release/vX.Y.Z` transition and permanent Release workflow remain the only publication path.

The governed public asset matrix now includes Linux x64/arm64 plus a separately production-signed `jig-android.apk`. v1.1.2 is the first version covered by this rule and its Android asset is completed through the bounded immutable-tag completion path in the permanent Release workflow. No Android app-store/repository publication is part of the release path.

- [v1.1.2 release notes](docs/releases/v1.1.2.md)
- [v1.1.2 implementation evidence](docs/evidence/v1.1.2/README.md)
- [release process, validity contract and asset matrix](docs/releases/README.md)
- [changelog](CHANGELOG.md)

## Documentation

- [Documentation index and ownership](docs/README.md)
- [Product definition](docs/product/product-definition.md)
- [Product identity](docs/product/product-identity.md)
- [Brand and theme system](docs/design/brand-and-theme.md)
- [Functional requirements — JIG-FR-01–22](docs/requirements/planning-workbench.md)
- [Technical solution](docs/architecture/technical-solution.md)
- [UI solution and visual references](docs/design/ui-solution.md)
- [Installation](docs/install.md)
- [Releases](docs/releases/README.md)

## Support and security

Use [GitHub issues](https://github.com/pontivus-com/jig/issues) for bugs, feature
requests and usage questions. See [SUPPORT.md](SUPPORT.md) for useful report
information.

Security reports should be private; see [SECURITY.md](SECURITY.md).

## License

Jig is licensed under **Apache License 2.0** (`Apache-2.0`). See
[LICENSE](LICENSE).
