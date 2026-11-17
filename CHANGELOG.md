# Changelog

All notable Jig changes are recorded here. Release versions follow Semantic Versioning.

## [Unreleased]

### Changed

- v1.0.3 replaces separate Day/Week destinations with one responsive Planner: seven fluid dated tracks on desktop and the same seven-date state as a selected-date list on narrow/mobile.
- Replaced the persistent SideNav/mobile drawer with one compact application header: Jig is Planner/Home, History and Settings are the only secondary destinations, and the active week range is page-centered above Previous/Today/Next controls.
- Unified Task view/create/edit around one contextual state owner: desktop uses a non-modal right Astryx Drawer and narrow/mobile uses Astryx BottomSheet while preserving unsaved drafts across responsive reflow.
- Quick Add/Add task initially captures only title and inherits the selected/originating date; Edit owns explicit non-drag date rescheduling.
- Desktop Planner consumes the available canvas with seven 160px-minimum tracks at the governed 76rem desktop threshold and uses restrained, consistent priority cues across Planner, History and Task detail.

### Fixed

- Task click/tap now selects and inspects only; direct desktop movement remains drag-and-drop and same-day Move up/down remains the non-drag ordering alternative.
- Removed the separate Move-to-date workspace/action and the standalone Day completed section; completed Tasks leave Planner and remain inspectable/reopenable in History.
- Previous/Next move the displayed week and selected date by exactly seven civil days, Today restores the current local date/week, and local-midnight revalidation preserves an explicitly selected non-today date.
- Removed superseded Day/Week/sidebar UI copy, dormant presentation code and stale browser/architecture assertions.

## [1.0.2] - 2026-11-17

### Changed

- Replaced derived carry-over with persisted daily rollover so unfinished prior-day Tasks physically move into the current date across Day, Week, restart and synchronization.
- Day is now the default planning entry surface and the browser revalidates canonical state across local day boundaries.
- Reminder delivery now uses one eligibility path: in-app toast while visible and browser Notification while hidden/open when permission is granted.

### Fixed

- Task command admission now performs rollover before revision validation so pre-rollover client revisions are rejected safely.
- Browser notification permission is requested only from an explicit Settings action and shares duplicate-suppression state with in-app reminders.
- Re-aligned the v1.0.2 UI implementation with Astryx 0.7.13 public ownership: built theme generation, public Section/VStack/elevation contracts, valid semantic tokens, and token-based non-structural CSS.

### Documentation

- Added the UX/UI conformance audit v1.0 and implementation-ready remediation plan for restoring the governed SVG structural design after v1.0.1.
- Made the release validity contract explicit: every release requires a dedicated `release/vX.Y.Z` PR with `package.json.version = X.Y.Z`, consistent changelog/release-note/tag metadata, executed binary publication jobs, and verification of the complete published asset set.

## [1.0.1] - 2026-11-16

### Changed

- Restored the external-system ownership boundary: Jig keeps automatic synchronization of Jig-owned planning data while Git retains repository topology, signing, credentials, history and reconciliation responsibilities.
- Removed the Jig-owned repository migration workflow and its CLI/HTTP/Settings surfaces.
- Simplified Jig application configuration so Git ref/remote mechanics remain inside the repository adapter.
- Removed the v1.0.0 SQLite `data_ref` topology field and added a lossless schema v1→v2 metadata migration.
- Retained both installer target modes: existing checkout via `--repo` and thin Git-clone handoff via `--repo-url` + `--checkout`.
- Release certification now smokes the packaged arm64 bundle on a native arm64 runner in addition to the packaged x64 bundle.

### Fixed

- Jig-generated synchronization commits opt out of commit signing per invocation without changing user or repository Git configuration.
- Fresh initialization now creates a valid empty portable Jig snapshot as the first Jig data commit instead of publishing an invalid empty bootstrap state.
- Installation adopts valid Jig data already fetched into the selected repository even when the remote is temporarily unavailable.
- Installation can narrowly recover the exact empty bootstrap residue produced by the v1.0.0 failed-install path.


## [1.0.0] - 2026-11-16

### Added

- Initial Jig v1 MVP: Week, Day, History and Settings surfaces for lightweight date-based personal planning.
- Canonical Task model with title-first capture, optional priority, context, reference, notes and reminder time.
- Exact same-day and cross-day movement with pointer drag and non-drag keyboard alternatives.
- Derived carry-over for unfinished earlier work without silently changing its scheduled date.
- Completion, reopen, confirmed permanent deletion and completion history.
- Session-bounded in-app reminders with durable local suppression.
- System, Light and Dark presentation modes with responsive narrow-screen composition.
- Canonical Option A Jig identity with Ink/Amber/Paper palette, centralized Light/Dark Astryx theme, outlined logo lockups, app icon and favicon.
- Immediate local SQLite authority with revision-checked commands and crash-safe transactional mutation.
- Deterministic portable Task records synchronized through an isolated `jig-data` ref/worktree without touching unrelated repository content.
- Linux installer, `jig` launcher, `systemd --user` service, diagnostics, manual synchronization, repository migration and uninstall lifecycle.
- Security, installer, browser, repository and resource/readiness certification evidence for the v1 release candidate.
- Governed release tooling for immutable `vX.Y.Z` tags, GitHub Releases and certified Linux x64/arm64 release bundles.

### Security

- Loopback-only HTTP service with process-local write-token admission for state-changing requests.
- Safe Git argv invocation, repository/path containment, single-writer enforcement and non-executing Task references.
- Ordinary diagnostics/logging exclude credentials and personal Task title/note/reference content.

### Fixed

- Preserved executable modes for release-bundle installer/launcher entrypoints and added safe pending-release retry behavior after pre-tag release-infrastructure failures.
- Isolated the certified release-bundle smoke from the hosted runner's user systemd manager so it validates Jig's supported foreground fallback under an isolated HOME.
- Finalized pre-tag release anchoring on the current default-branch commit so GitHub workflow-permission safeguards do not block immutable release tags.
- Contained Week-row action hit areas so task actions remain independently pointer-addressable inside narrow date columns.
- Made single-writer lease publication atomic so concurrent service startup admits exactly one writable owner.
- Corrected release gating so only an actual merged version bump enters certification/publication, and ensured manual pinned Bun installs expose both `bun` and `bunx` on x64/arm64 runners.

### Performance

- Certified maximum service RSS at 35,876 KiB against a 128 MiB limit.
- Certified five-minute idle one-core CPU average at 0.0167% against a 1.0% limit.
- Certified running-service launcher handoff p95/20 at 30 ms against a 500 ms limit.
- Certified stopped-service HTTP readiness p95/20 at 53 ms against a 2,000 ms limit.
