# Jig releases

Jig uses a PR-bound, immutable release process modeled on the Pontivus public-repository release standard used by Order.

## Release sequence

1. Ordinary work lands through a pull request and adds its public release impact under `CHANGELOG.md` `[Unreleased]`.
2. A dedicated `release/vX.Y.Z` branch changes only release metadata for the already-verified candidate.
3. The release PR moves the accumulated `[Unreleased]` entries into `[X.Y.Z] - YYYY-MM-DD` and updates `package.json.version`.
4. After that release PR merges to `master`, the permanent release workflow re-runs the complete verification gates.
5. The workflow builds the two supported Linux bundles, verifies checksums, creates immutable tag `vX.Y.Z`, creates a draft GitHub Release, uploads the complete asset set, then publishes it.

Published tags are never moved or rebuilt. A correction after publication requires a new version.

## Supported release hosts

Jig v1 is supported on Linux:

- x86_64 / amd64;
- aarch64 / arm64.

The release bundles carry the pinned Bun runtime for the selected architecture plus the certified production UI and Jig runtime sources. No ambient Bun installation is required for the supported release path.

## Exact release asset matrix

| Asset | Purpose |
| --- | --- |
| `jig-linux-x64.tar.gz` | Certified Linux x86_64/amd64 application bundle with pinned Bun runtime. |
| `jig-linux-arm64.tar.gz` | Certified Linux aarch64/arm64 application bundle with pinned Bun runtime. |
| `SHA256SUMS` | SHA-256 digest of both release bundles and the bootstrap installer. |
| `jig-install.sh` | Architecture-selecting bootstrap that downloads, verifies and delegates to the canonical bundled `scripts/install.sh`. |

GitHub-generated source archives remain provenance artifacts; they are not the primary supported installation channel.

## Bundle contents

Each architecture bundle contains one top-level `jig/` directory with:

- `runtime/bun` — pinned Bun runtime for the bundle architecture;
- `src/` — canonical Jig runtime/core sources;
- `dist/` — production Vite UI built from the exact release commit;
- `scripts/install.sh` — canonical installer behavior;
- `scripts/jig` — launcher;
- `package.json`, `bun.lock`, `.bun-version`;
- `README.md`, `CHANGELOG.md`, `LICENSE`;
- `docs/install.md`;
- `RELEASE.json` containing release version, Git commit, platform, architecture and Bun version.

The installer recognizes this certified payload and does not rebuild the UI or reinstall JavaScript dependencies. Source-checkout installation remains available for contributors and continues to build from the frozen dependency graph.

## Public installation channel

Latest stable:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

A version-pinned installation replaces `releases/latest/download` with `releases/download/vX.Y.Z`.

See [install.md](../install.md) for existing-repository, clone, remote, service, upgrade and uninstall behavior.
