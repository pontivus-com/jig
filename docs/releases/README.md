# Jig releases

Jig uses a PR-bound, immutable release process modeled on the Pontivus public-repository release standard used by Order.

This document is the **canonical release authority** for Jig. A merged implementation PR is not itself a release. Release validity requires a separate, explicit metadata transition and successful publication of the certified artifacts described below.

## Release validity contract

A Jig release `X.Y.Z` is valid only when **all** of these statements are true:

1. The implementation intended for the release has already landed on `master` through ordinary reviewed PRs.
2. A dedicated branch named exactly `release/vX.Y.Z` was created from that verified `master` candidate.
3. That release branch explicitly changes `package.json.version` to exactly `X.Y.Z`.
4. `CHANGELOG.md` contains `## [X.Y.Z] - YYYY-MM-DD`, contains the complete release contents previously accumulated under `[Unreleased]`, and recreates an empty `[Unreleased]` section.
5. `docs/releases/vX.Y.Z.md` exists and identifies target tag `vX.Y.Z`.
6. The release PR contains only the release-metadata files allowed by `scripts/verify-release.ts` and passes the `release/vX.Y.Z` PR metadata gate.
7. The release PR is merged to `master`; that exact merged commit is the release candidate.
8. The permanent `Release` workflow detects that commit as a release transition/finalization and runs the release path. A workflow that exits with `should_release=false` is a successful **no-op**, not a release.
9. The complete permanent release certification succeeds, including native arm64 certification, non-publishing Android certification and packaged-bundle smoke verification.
10. Immutable tag `vX.Y.Z` points to the exact certified release commit.
11. A non-draft GitHub Release for `vX.Y.Z` is published.
12. The GitHub Release contains every asset in the exact asset matrix below, and `SHA256SUMS` verifies the published release payload.

The release identifiers must be consistent:

```text
release branch       release/vX.Y.Z
package.json         "version": "X.Y.Z"
CHANGELOG heading    ## [X.Y.Z] - YYYY-MM-DD
release notes        docs/releases/vX.Y.Z.md
Git tag              vX.Y.Z
GitHub Release tag   vX.Y.Z
```

A mismatch in any of these identifiers is a release-blocking defect.

### Mandatory package-version transition

Updating `package.json.version` is a **required release activity**. It is intentionally forbidden in ordinary work PRs and intentionally required in the dedicated release PR.

The permanent release workflow uses the package version and release-metadata transition to decide whether publication should occur. Therefore:

- merging implementation for a future version while leaving `package.json.version` at the previous published version does **not** publish the new version;
- if the current package version is already tagged, the workflow can correctly finish green while skipping certification/packaging/publication;
- that green no-op must never be interpreted as release success;
- the remedy is to create/complete the missing `release/vX.Y.Z` metadata PR, not to force-tag the implementation commit or republish an old version.

This separation is deliberate: ordinary development can merge without mutating the public version, while release publication occurs only through an auditable version transition.

## Release sequence

### 1. Accumulate releasable work

Ordinary work lands through pull requests and records its public release impact under `CHANGELOG.md` `[Unreleased]`.

Ordinary PRs:

- must leave `package.json.version` unchanged;
- declare SemVer impact and target release in the PR body;
- keep `[Unreleased]` non-empty when they add release-visible work;
- pass the permanent implementation verification suite.

### 2. Create the dedicated release branch

After the intended candidate is on `master`:

```text
release/vX.Y.Z
```

must be created from that candidate.

The release branch is metadata-only. Its required work is:

1. set `package.json.version` to `X.Y.Z`;
2. move the complete `[Unreleased]` contents into `## [X.Y.Z] - YYYY-MM-DD`;
3. recreate an empty `## [Unreleased]`;
4. create/update `docs/releases/vX.Y.Z.md`;
5. update `README.md` only when current-version/current-behavior references require it.

No runtime/product implementation belongs in this PR.

### 3. Verify and merge the release PR

The release PR must pass `scripts/verify-release.ts --mode pr`, which verifies the branch/version/changelog/file-scope contract, plus the permanent implementation verification suite.

Do not merge the release PR merely because the implementation candidate was already green. The release metadata gate is part of release correctness.

The merge must produce one release/finalization commit whose **first parent is the pre-release `master` candidate**. A normal GitHub merge commit or squash merge satisfies this contract. Do **not** promote a multi-commit `release/vX.Y.Z` branch by directly fast-forwarding the `master` ref: the permanent Release workflow intentionally evaluates the release commit against `HEAD^`, and a direct fast-forward can leave `HEAD^` inside the metadata branch after the version transition, causing a correct release tree to be treated as a no-op. If a pre-tag release tree was already fast-forwarded, use the governed same-version finalization path: land any corrective ordinary work under `[Unreleased]`, then finalize it through a new `release/vX.Y.Z` PR that empties `[Unreleased]` into the existing version section and merge that PR normally.

### 4. Certify the exact merged release commit

After the release PR merges to `master`, `.github/workflows/release.yml` must detect the release transition and re-certify the exact merged commit.

The release workflow must run, not skip:

- release metadata verification;
- native Linux arm64 verification;
- non-publishing Android source/build certification for the exact release commit, including application/version identity, FLOSS dependency gates and F-Droid candidate lint;
- typecheck and core/integration tests;
- production UI build;
- browser acceptance where defined by the workflow;
- installer/shell lifecycle gates;
- packaging for Linux x64 and arm64;
- package checksum verification;
- packaged x64/arm64 installation smoke tests covering both configured `--repo` automation and fresh no-repository bootstrap mode.

### 5. Publish immutable release artifacts

Only after certification succeeds may the workflow:

1. create immutable tag `vX.Y.Z` at the exact certified commit;
2. create the GitHub Release as a draft;
3. upload the complete required asset set;
4. verify/reuse only byte-identical assets during a safe retry;
5. publish the GitHub Release.

Published tags are never moved or rebuilt. A correction after publication requires a new version.

## Release completion checklist

Before stating that `X.Y.Z` is released, verify all of the following directly:

- [ ] `master:package.json` reports `X.Y.Z`;
- [ ] `CHANGELOG.md` has the dated `[X.Y.Z]` section and empty `[Unreleased]`;
- [ ] `docs/releases/vX.Y.Z.md` exists;
- [ ] permanent Release workflow completed successfully **with the release jobs executed rather than skipped**, including Android certification;
- [ ] tag `vX.Y.Z` exists and targets the certified release commit;
- [ ] GitHub Release `vX.Y.Z` is published and not draft;
- [ ] `jig-linux-x64.tar.gz` exists;
- [ ] `jig-linux-arm64.tar.gz` exists;
- [ ] `jig-install.sh` exists;
- [ ] `SHA256SUMS` exists and covers both bundles plus the installer.

If any item is false, the version is not yet a valid published release.

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

Android is deliberately not part of the GitHub Release asset matrix. F-Droid remains the first intended public Android distribution target. The permanent Release workflow certifies the exact Android source/build state before Linux publication, but it does not upload an APK and does not publish to F-Droid. External F-Droid submission/publication is a separate deferred distribution activity: it may begin only after an immutable source tag exists **and** Jig is considered stable with the required marketing/store material ready. Android availability must not be described as public until F-Droid has actually published `com.pontivus.jig`.

## Bundle contents

Each architecture bundle contains one top-level `jig/` directory with:

- `runtime/bun` — pinned Bun runtime for the bundle architecture;
- `src/` — canonical Jig runtime/core sources;
- `dist/` — production Vite UI built from the exact release commit;
- `assets/` — canonical Jig logo, icon and favicon variants;
- `scripts/install.sh` — canonical installer behavior;
- `scripts/jig` — launcher;
- `package.json`, `bun.lock`, `.bun-version`;
- `README.md`, `CHANGELOG.md`, `LICENSE`;
- `docs/install.md`;
- `docs/design/brand-and-theme.md` and `docs/product/product-identity.md`;
- `RELEASE.json` containing release version, Git commit, platform, architecture and Bun version.

The installer recognizes this certified payload and does not rebuild the UI or reinstall JavaScript dependencies. Source-checkout installation remains available for contributors and continues to build from the frozen dependency graph.

## Public installation channel

Latest stable:

```bash
curl -fsSL https://github.com/pontivus-com/jig/releases/latest/download/jig-install.sh \
  | bash -s -- --repo /absolute/path/to/your/planning-repo
```

A version-pinned installation replaces `releases/latest/download` with `releases/download/vX.Y.Z`.

See [install.md](../install.md) for existing-repository and repository-URL installation, Git-native continuity, service, upgrade and uninstall behavior.
