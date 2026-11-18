# Changelog

All notable Jig changes are recorded here. Release versions follow Semantic Versioning.

## [Unreleased]

## [1.0.6] - 2026-11-18

### Changed

- Constrained History and Settings to one continuous centered 50rem / approximately 800px maximum content measure whenever space permits, independent of the 73rem Planner breakpoint, while preserving the full-width Planner/full-bleed application frame and independent Settings column reflow.
- Defined the v1.0.6 curated application-theme catalogue: Jig; dual-mode Astryx Neutral, Butter, Chocolate, Matcha, Stone and Y2K; plus Gruvbox, Dracula, Solarized, Nord, Catppuccin and Tokyo Night. Astryx Gothic is dark-only in the pinned release and is therefore not exposed rather than receiving a fabricated light mode.
- Split theme family from System/Light/Dark appearance so each theme supports independent local appearance selection and System follows the platform preference.
- Expanded theme governance to every application surface/state, including Task elevation, current day, selection, drag, priority, completion, operational status and combined-state precedence, without feature-local palettes.
- Made the in-application Jig wordmark use canonical geometry with active-theme semantic foreground/accent paint while retaining fixed theme-independent favicon/app/release assets.
- Replaced visible-page reminder Toast delivery with one browser/OS Notification channel while Jig is open and permission is granted, independent of page visibility/focus.
- Kept Theme and System/Light/Dark configuration exclusively in Settings → Appearance.

### Documentation

- Completed JIG-106-FR-01…07 → JIG-106-SD-01…07 technical traceability and added the binding J106-IMP-01…08 implementation/certification plan.
- Reconciled repository governance, UI and brand/theme authorities with the complete v1.0.6 scope; the former width-only implementation plan is superseded.
- Architectural review found and removed a non-governed 14th Gothic theme that contradicted JIG-106-FR-02 and AGENTS.md; the corrected 13-theme candidate `79779bcbfc759f5043e7cc1cbd31c8e863ed564f` passed permanent Verify run `44216569314` with 18/18 test files, 107/107 core/integration/architecture tests and 55/55 real-browser acceptance tests.


## [1.0.5] - 2026-11-17

### Fixed

- Eliminated the cross-list dnd-kit/React reconciliation crash by keeping React/canonical Task order authoritative and suppressing optimistic DOM sorting during drag.
- Restored whole-card direct drag on desktop and narrow/mobile with exact same-date/cross-date positioning, touch activation, interactive-control exclusion and no drag-release Task-selection side effect.
- Removed responsive Planner/navigation semantic forks so desktop and narrow/mobile use one sortable Task path, one Planner/History/Settings destination owner and one Task action-menu owner.
- Corrected Task-card/canvas separation in Light/Dark, including narrow/mobile Dark mode, and replaced the duplicate header-brand composition with the canonical complete Jig wordmark.

### Changed

- Replaced the oversized gray application chrome with a flat edge-to-edge bar: desktop <=44px, narrow <=56px, one bottom hairline and one-line temporal navigation.
- Normalized visible actions/status/metadata to the Astryx semantic icon system, with only four governed namespaced Jig extensions for Add, History, Edit and Delete.
- Removed application-level viewport gutters/content framing and moved the seven-track responsive boundary to 73rem / 1168px.
- Strengthened architecture/browser certification for runtime drag errors, desktop/mobile movement classes, navigation/menu parity, icons, header geometry, Task contrast and full-bleed responsive behavior.


### Documentation

- Defined the v1.0.5 corrective functional/technical/UI contract after post-release v1.0.4 validation exposed a drag reconciliation crash, title/body-only drag activation instead of whole-card drag, missing narrow/mobile drag parity, duplicated responsive navigation/rendering semantics, incomplete semantic icon/menu normalization, oversized header geometry, insufficient Task-card contrast and stale narrow presentation behavior.
- Added exact JIG-105-FR-01…11 → JIG-105-SD-01…11 → J105-IMP-01…11 traceability and strengthened release acceptance so desktop/narrow drag, navigation/menu parity, Task-action parity, semantic icons, header bounds, zero-margin full-bleed layout/73rem breakpoint, and Light/Dark card contrast are all explicitly certified.

## [1.0.4] - 2026-11-17

### Fixed

- v1.0.4 restores card-body drag-and-drop with exact same-day/cross-day ordering while keeping checkbox, menu and reference controls independent.
- Corrected current-day, selected-Task, priority, drag/focus and operational-status color collisions with governed semantic Light/Dark roles.
- Task workspace dismissal, card-to-card retargeting, destination-invariant header geometry and complete Planner/History Task action menus now follow the binding interaction contract.
- Removed the obsolete selected-day state, DateStrip/read-only inspector paths and duplicate desktop/narrow Task-sequence ownership.
- Tightened architecture boundaries and runtime narrowing so the functional core remains pure, UI no longer depends on shell implementation modules, and canonical Task data is validated at repository/SQLite/HTTP boundaries.

### Changed

- Add and existing Task interaction now use one directly editable full field surface; global Add derives the current weekday inside the displayed week and each full weekday/date header owns an explicit date-specific `+`.
- Narrow/mobile now presents all seven dates as stacked sections, matching the same displayed-week state as desktop.
- Desktop navigation explicitly groups Planner, History and Settings on the right while preserving centered temporal controls.
- Planner presentation uses an open reduced-chrome weekly canvas, content-driven lane heights, restrained Task surfaces and Astryx semantic iconography.
- Local-only and synchronized durability states now use healthy success semantics while retaining distinct labels.

## [1.0.3] - 2026-11-17

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
