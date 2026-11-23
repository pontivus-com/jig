# Changelog

All notable Jig changes are recorded here. Release versions follow Semantic Versioning.

## [Unreleased]

> **Target release: v1.1.2.** Corrective work is tracked in issue #66. Package metadata remains at v1.1.1 until the governed `release/v1.1.2` transition. These entries describe the active corrective scope and must be reconciled to delivered `Fixed`/`Changed` outcomes before release.

### Changed

- **Synchronization diagnostics and continuity:** Added credential-free phase/reason/lineage/head/retry/recovery diagnostics with copyable support output; bounded automatic reconciliation for provably related Jig-owned `jig-data` divergence; deterministic crash-safe recovery commits; and an in-app whole-record semantic-conflict resolver shared by Linux/Desktop and Android. Unsafe ancestry, incompatible datasets/snapshots, ambiguous remotes and remote rewrites remain non-destructive `Needs attention`; no force push or general Git conflict UI was introduced.
- **Adaptive presentation/runtime ownership:** Separated width-only desktop/narrow presentation from Linux/browser versus Android/native capabilities and from pointer/keyboard/IME facts. Desktop/narrow now own the governed header/navigation, Planner composition, feedback placement, Drawer/BottomSheet workspace and onboarding geometry over shared semantic state.
- **Application motion:** Moved Jig to the governed shared Astryx duration-token scale across themes, overlays, destination changes, feedback, Task movement and surface transitions while preserving immediate reduced-motion semantics.
- **Git/provider source ownership:** Moved portable semantics into `src/core`, runtime envelopes into `src/protocol`, shared GitHub provider code under `src/github`, and Linux system-Git mechanics under focused `src/shell/git/**` effect owners. Recovery policy remains singular in `src/core/synchronization-recovery.ts`; no DTO/service/repository hierarchy was added.

### Fixed

- **Android semantic-conflict entry:** Export a pending local portable snapshot before classifying a remote-ahead state, allowing related divergence to reach the governed native semantic-conflict resolver instead of remaining at generic synchronization attention.
- **Synchronization recovery certification:** Added a permanent real-Git GitHub Actions gate that reproduces the exact Android failure topology with canonical SQLite pending while the remote advances, then proves controller-owned export, true divergence/conflict entry, stale-case refusal, refreshed resolution, deterministic candidate acceptance and ordinary non-force synchronization.
- **Non-destructive Android updates:** Stabilized the non-production certification APK signing identity, verify its certificate in CI, prohibit uninstall/package-clear as a certification workaround, and prove on API 24 that two in-place installs preserve Jig's app-private repository/local state before the native instrumentation suite. Linux reinstall smoke now also proves local-state/config preservation.
- **Theme surface separation:** Restored distinct application chrome, configured content/Planner-day canvas and Task-card surface roles across all 13 governed themes in Light and Dark. History and Settings now consume the same full-width configured content surface as Planner while desktop header and narrow header/bottom navigation retain the chrome surface; theme-specific role values remain authored only in typed theme sources/generated Astryx artifacts.
- **Planner viewport ownership:** Restored Astryx AppShell main as the sole configured page scroll owner so empty, short and overflowing Planner states fill/scroll through the governed viewport owner without a competing nested scroller.
- **Task drag-and-drop:** Replaced insertion-line movement with the real shared Task-card DragOverlay plus React-owned card-sized prospective placement. Pointer/touch activation, same-date/cross-date/empty-date placement, cancellation and persisted final position remain on the single pinned dnd-kit path with optimistic DOM sorting disabled.
- **Responsive operational feedback:** Desktop transient/durable feedback and narrow snackbar/inline attention now use viewport-appropriate placement while retaining one semantic feedback state.
- **Synchronization evidence disposition:** The permanent upgraded Desktop reproduction covers initial synchronization, local mutation/push, controller restart, external remote fast-forward and automatic adoption and remains synchronized with idle diagnostics. No ordinary Desktop failing boundary was reproduced; IMP-16 is therefore closed as **NO DEFECT REPRODUCED / NO CAUSAL FIX REQUIRED**, not as a claim that a historical defect was fixed.

### Documentation

- **Release-tail governance:** Added a mandatory version-specific release-state audit, explicit ordinary-PR release handoff (`continue-development` vs `create-release-pr-after-merge`), verifier enforcement, and unmistakable Release-workflow no-op summaries so implementation completion cannot be mistaken for completion of the separate release ceremony.

- **v1.1.2 corrective authority and certification:** Reconciled the FR/SD/implementation authority, adaptive concern matrix and branch governance around the final corrective architecture. IMP-18 exact-candidate certification retains executable browser/theme/resolver, synchronization and Android hosted evidence while keeping package metadata at v1.1.1 until the separate `release/v1.1.2` transition.

## [1.1.1] - 2026-11-21

### Documentation

- **Installation:** Made the public README Quick start follow the governed two-phase flow: install Jig first with the release bootstrap script, then run `jig` and choose/connect the planning repository inside the application. Kept direct `--repo` installation as an explicit automation path and corrected the pinned-version example to v1.1.0.

- **Release ceremony:** Clarified that a multi-commit `release/vX.Y.Z` branch must be merged through a normal PR merge/squash so the release commit's first parent is the pre-release `master` candidate; direct fast-forward promotion is not a valid publication trigger, and the governed same-version finalization path is used for pre-tag recovery.

## [1.1.0] - 2026-11-21

> v1.1 functional scope and disposition are governed by the [functional amendment assessment](docs/requirements/v1.1-mobile-functional-design.md#12-v11-functional-amendment-and-implementation-assessment). Entries below are ordered from major product impact to smaller implementation/documentation detail.

### Added

- **Android application and continuity:** Added the independently installable Capacitor Android shell with app-private SQLite, provider-neutral Git synchronization, direct shared GitHub App Device Flow, secure credential storage and native local-reminder scheduling. Android uses the same canonical planning semantics and portable records as Linux/Desktop.
- **Repository onboarding:** Added fresh Linux bootstrap mode, in-application existing-local-repository and GitHub acquisition paths, while retaining `--repo` and `--repo-url` automation. All paths converge on the governed repository validation/adoption boundary.
- **Bounded recurrence:** Added weekly/monthly recurrence with one canonical series owner, schema-v3 SQLite persistence, portable-format-v2 continuity and deterministic occurrence reconciliation shared across Linux and Android.
- **Cross-platform interaction motion:** Added the shared Desktop/Android motion contract for Drawer/BottomSheet transitions, destination navigation, Planner/task feedback, status changes and reduced-motion behavior without making motion a second product-state system.
- **Distribution and certification tooling:** Added F-Droid candidate metadata, the Android physical-device preflight and permanent Android build/runtime certification. Development APKs remain outside the GitHub Release asset matrix.
- **WebView compatibility:** Added the pinned browser `buffer` runtime dependency required for native `isomorphic-git` onboarding in Android WebView.

### Changed

- **Planner horizon and creation:** Replaced fixed Monday–Sunday weeks with a core-owned rolling seven-day horizon: today plus six future dates, explicit seven-day Previous/Next movement, a today lower bound and shared Desktop/Android rendering. The global Add action means today; date-level `+` controls are future-only; the Planner ends at the seventh visible date without exposing an empty background strip.
- **Mobile application hierarchy:** Reworked the configured compact application around UX-F0: persistent Planner/History/Settings bottom navigation, one Planner FAB, explicit Today, subordinate healthy synchronization and governed touch geometry. Mobile Planner density, onboarding hierarchy, complete Task-form structure and Settings reading hierarchy were corrected without shrinking interaction targets.
- **Task workspace and feedback:** Add/Edit now use one complete form; workspace entry resets to the top; Add focuses Title while Edit does not autofocus Title; successful Add/Edit closes the Drawer/BottomSheet and confirms `Task added` / `Task saved`; completion/reopening confirms `Task completed` / `Task reopened`; Cancel uses the reverse workspace exit transition.
- **Task movement:** Replaced the rejected Pangea movement path with the proof-gated dnd-kit owner using a dedicated grip, explicit before/between/after insertion slots and terminal drag-state cleanup.
- **Onboarding and synchronization UX:** Fresh onboarding, loading and error states now use the canonical Jig AppShell. GitHub connection is one product intent with automatic polling, access discovery, repository acquisition/adoption and reconnect continuation. Header/Settings status uses the derived Local only, Syncing, Up to date and Needs attention vocabulary while technical facts remain diagnostics.
- **Destination and Settings ownership:** History/Settings use the application header as the single title/subtitle owner; body content begins directly with destination content. Settings keeps planning-data home, continuity and local safety together while separating Appearance, Notifications and subordinate Diagnostics.
- **UI authority and visual fidelity:** The v1.1 mobile/desktop UX/UI references are now binding for onboarding and the complete Task form. Theme/state contrast, product-icon ownership and cross-theme visual parity follow the semantic Astryx/Jig contracts.
- **Deferred scope:** Adjacent-week Carousel/swipe paging is explicitly deferred beyond v1.1. Previous/Next/Today remain the only v1.1 horizon navigation controls; the former WeekPager/FR-33 material is retained as future-work history only.

### Fixed

- **Android reliability:** Fixed Task creation `Illegal invocation`, restored correct GitHub credential use across managed smart-HTTP operations, normalized native response headers, restored secure authorization before Device Flow, corrected Android Back navigation, removed the duplicated safe-area inset and synchronized native status/navigation-bar appearance with Light/Dark/System.
- **Release certification:** Fixed the permanent Verify/Release F-Droid metadata check to match the valid YAML build-list `versionName` entry instead of rejecting the v1.1.0 release transition.
- **Planner and Task interaction:** Fixed narrow Planner startup so today aligns to the content viewport; stabilized keyboard movement with the single dnd-kit KeyboardSensor and exact insertion-slot traversal; aligned History/Settings narrow insets with Planner.
- **Operational attention:** Replaced the misaligned shared Banner surface with the bounded Jig-owned attention composition. Multi-line messages and actions now align/wrap correctly across operation, sync, load, setup and Settings states without changing reminder/OS-notification behavior.
- **Reminder lifecycle:** Fixed lifecycle copy and attention precedence for scheduled, due and platform-notified reminders. Notification delivery remains separate from canonical Task state; unresolved elapsed reminders retain attention.
- **Synchronization durability:** Fixed remote observation, rewrite detection, transport timeout/process cleanup and reconnect evaluation so local portable snapshots remain safe and exact Git diagnostics remain subordinate.
- **GitHub discovery:** Fixed installation/repository discovery pagination and automatic post-authorization rechecks so access is not truncated or made dependent on a manual Refresh action.
- **Status ownership:** CLI, browser and native adapters now consume one structured repository status rather than maintaining parallel scalar status projections.
- **Motion/layout polish:** Fixed History mutation animation, desktop Today transition and theme/status transitions under the shared reduced-motion contract.

### Documentation

- **Functional and UI authority:** Added the binding v1.1 configured-application UX authority and UX-F0 desktop/mobile fidelity audit; reconciled functional, UI, technical, repository-governance, implementation-plan and evidence documents around the amended mobile interaction, Settings, Repeat, drag and rolling-horizon contracts.
- **Certification status:** Reconciled the final v1.1 certification model: repository-executable implementation and hosted Linux/browser/Android/API-24 verification are complete; issue #31 real Linux Device Flow/Secret Service/private-repository/refresh acceptance passed; J110-IMP-15 remains optional physical/native QA rather than a release gate.
- **Permanent verification evidence:** Retained exact Verify, browser, Android build, API-24, artifact and checksum references for prior candidates as historical evidence, and recorded final release-candidate acceptance separately from the later publication ceremony.
- **API-24 lane:** Restored the hosted API-24 certification lane after the emulator software-acceleration change by allowing TCG only for that isolated CI step; product/runtime architecture is unchanged.
- **Branch governance:** Consolidated v1.1 implementation, evidence and certification authority onto the single `v1.1` integration branch; temporary work/CI branches remain non-authoritative until their content is integrated.
- **Deferred navigation documentation:** Kept the former FR-33/SD-43 Carousel material as future-work history only; it is not a v1.1 implementation or acceptance gate.

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

