# Changelog

All notable Jig changes are recorded here. Release versions follow Semantic Versioning.

## [Unreleased]

### Added

- Started Jig v1.1 implementation: Android-first native delivery, in-application repository onboarding, corrected reminder attention/delivery, persistent narrow/mobile chrome and precise Task drag/drop placement are governed by the complete JIG-110 functional/technical/implementation contract.
- Added bounded recurring Tasks with one canonical recurrence-series owner, schema-v3 SQLite persistence, portable-format-v2 continuity and deterministic occurrence reconciliation shared across Linux and Android.
- Added the committed Capacitor Android application shell with app-private SQLite, provider-neutral isomorphic-git synchronization, direct shared GitHub App Device Flow, Keystore-backed credentials and native reminder scheduling/reconciliation.
- Added F-Droid candidate metadata and permanent Android build/runtime certification while keeping development APKs out of the GitHub Release asset matrix.
- Added a repository-owned Android physical-device preflight that verifies the pinned source/build contract, local SDK/toolchain, authorized physical device, APK identity and APK hash before certification.
- Added the pinned browser `buffer` runtime dependency required for native `isomorphic-git` onboarding to mount correctly in the Android WebView.
- Fresh Linux installation now supports a no-repository bootstrap mode with in-application local-repository or GitHub onboarding while retaining existing `--repo` and `--repo-url` automation.
- Settings now presents the planning-data home, local safety and continuity in user language; exact Local Git, Remote Git, service, database, repository-path and manual synchronization facts remain available as secondary diagnostics.
- Added the shared desktop/Android motion system: Astryx-owned Drawer/BottomSheet transitions, destination navigation, directional week transitions, Task/list and drag/drop feedback, status/reminder/theme/control transitions and reduced-motion suppression, while keeping initial Planner loading and semantic state changes immediate.
- Added JIG-110-FR-33 / JIG-110-SD-43 for one cross-platform Planner WeekPager: desktop and narrow/mobile share adjacent-week direct manipulation and explicit Previous/Next over the same canonical displayed-week state, Today remains a direct jump, and only the active week is interactive/droppable while neighbouring weeks are inert previews.

### Changed

- Reworked the configured compact application around the UX-F0 governed hierarchy: persistent Planner/History/Settings bottom navigation replaces hamburger primary navigation, Planner Add is one floating primary action, healthy synchronization is visually subordinate, Today remains explicit text, and touch-target geometry no longer dictates visible control mass.
- Final reviewed fidelity corrections suppress duplicate synchronization recovery chrome inside Settings, keep exact technical repository locators in Diagnostics only, and remove the second primary Add CTA from compact empty Planner so the FAB remains the single prominent creation action.
- Reworked mobile Planner scan density without shrinking touch targets, restored a stable value-first onboarding composition with visual proof points, grouped the Task editor into Task / Schedule / Details / Notes while preserving one-Save recurrence semantics, and replaced primary Settings dashboard cards with a content-led reading hierarchy.
- Governed new v1.1 mobile and desktop UX/UI references for onboarding and the complete Task form. The mobile reference is now the binding v1.1 form interaction standard for BottomSheet hierarchy, touch geometry, scrolling, progressive Repeat disclosure and action placement; the old mobile editor reference is historical where superseded.
- Reopened v1.1 desktop + mobile UX/UI after implementation-fidelity review: prior geometry/screenshot retention is no longer treated as visual certification; shell/navigation, Planner density, onboarding, Task workspace, History/Settings and cross-theme visual parity must pass reviewed evidence before physical certification resumes.
- Rejected the Pangea Task-movement implementation after physical-device failure and governed a proof-gated current dnd-kit replacement using a dedicated grip, explicit before/between/after insertion slots and mandatory terminal drag-state cleanup.
- Corrected fixed product-icon ownership so `jig-app-icon.svg`, `jig-favicon.svg` and the Android launcher all derive from the one canonical standalone Jig J-mark geometry; Android no longer carries an independently drawn generic J and now retains the canonical amber alignment pin.

- History and Settings use the application header as the single title/subtitle owner; their content surfaces begin directly with destination content instead of repeating page headings.
- Repository status remains one structured provider-neutral technical contract, while the header and primary Settings projection use Local only, Syncing, Up to date and Needs attention instead of exposing Git mechanics as product workflow.
- GitHub onboarding/reconnect now exposes one product intent, the provider-required device code and genuine repository choice only; polling, provider-access discovery/recheck, repository acquisition/adoption and reconnect continuation are automatic.
- Fresh onboarding/loading/error states now render inside the same canonical Jig AppShell/header/body used by configured Planner rather than a standalone setup application.

### Fixed

- Replaced the misaligned shared operational-attention Banner surface with one bounded Jig-owned composition from public Astryx leaves/tokens: multi-line error/warning icon and inline action regions are vertically centered, actions wrap cleanly on narrow widths, all existing operation/sync/load/setup/Settings call sites converge on the same owner, and reminder/OS notification behavior is unchanged.
- Removed the duplicated Android top safe-area inset from the narrow application and onboarding headers so the mobile Jig logo sits in the governed 52px application row without an empty band above it.
- Fixed Android Task creation failing with `Illegal invocation` by passing the UUID generator through a callback at the native runtime boundary; one-off and recurring creation now commit and survive restart.
- Added the governed narrow-screen horizontal inset to History and Settings so their mobile reading surfaces align with Planner instead of touching the viewport edges.
- Narrow Planner now opens and reloads with the current day aligned to the content viewport top; earlier days remain available through deliberate upward scrolling.
- Android Back now follows Jig's prior-screen order: it closes an open Task workspace first, then returns through prior Planner/History/Settings destinations, and exits only when no Jig screen remains.
- Reminder lifecycle presentation now distinguishes future reminders (`Reminder scheduled`), elapsed reminder times (`Reminder due · time passed`) and a platform-confirmed notification (`Reminder notified`) without promoting delivery into canonical Task state. Browser delivery remains service-worker based, and Android delivers already-due foreground reminders through the local-notification adapter.
- Reminder cards now remove the due-attention highlight once the lifecycle reaches `Reminder notified`; unresolved elapsed reminders retain the highlight.
- Android GitHub acquisition now applies the stored credential to every managed Git smart-HTTP operation, normalizes native response-header casing and provides the browser Buffer boundary required by isomorphic-git, so an already-authorized repository reaches Planner instead of the generic connection error.
- Stored GitHub authorization is now restored from the governed secure-credential adapter before onboarding can start Device Flow; repeated or concurrent Connect requests continue repository discovery/acquisition instead of re-presenting authorization or resetting an active selection.
- Remote synchronization failure no longer obscures a successful local snapshot; primary feedback states that work is saved locally while exact Git commit/remote failure detail remains available in Diagnostics.
- Android native status and navigation-bar indicators now follow Jig's resolved Light/Dark/System appearance, including an explicit Light selection while the device itself remains in Dark mode; desktop browser chrome continues to follow Astryx's root `color-scheme` projection.
- Completed the motion audit corrections: History list mutations now use Astryx animated layout, desktop Today has an explicit week-content transition, and theme/status-surface changes use the shared reduced-motion-aware transition contract while canonical state changes remain immediate.
- Completed and certified the FR-33/SD-43 **visual-unification tranche** while the final paging-owner cutover remains open: active and adjacent pages now share one Week/date/Task/List/empty-state presentation, the parallel `jig-week-preview-*` implementation is removed, passive slides remain inert without fake controls, Task drag remains isolated from paging, and `useAnimatedLayout` is restored. The temporary Jig native scroll/snap pager is retained only until Astryx exposes the required public Carousel lifecycle seam; it is not the v1.1 release architecture.
- CLI status/sync output and browser/native runtime adapters consume the same structured repository status rather than rendering or maintaining a parallel scalar status.
- GitHub installation/repository discovery now consumes every API page instead of silently truncating authorized choices at the first 100 results.
- Returning from GitHub authorization/access no longer requires a manual Refresh action; desktop and Android orchestration resume/recheck automatically, and configured reconnect retries synchronization without re-running repository setup.
- Hardened cross-installation synchronization so remote observation cannot mutate tracking evidence before validation, deleted/recreated remote history retains last-adopted lineage for rewrite detection, transport outages still finish the local portable snapshot, bounded Git timeouts terminate spawned process trees, and managed GitHub reconnect state re-evaluates restored credentials.
- Stabilized keyboard Task movement by explicitly configuring the single dnd-kit KeyboardSensor with insertion-slot-scale movement, so keyboard dragging traverses the same exact before/between/after targets as pointer dragging.

### Documentation

- Closed UX-F0..UX-F7 on executable source candidate `611c8ced6a854a80f24bf727c53d792f5c5d556c`: permanent Verify run `44547579822` passed 41/41 test files, 250/250 core/integration/architecture tests, 80/80 real-browser tests, installer/lifecycle smoke, deterministic Android build certification and API-24 instrumentation; reviewed browser evidence is artifact `14539814508` and physical Android candidate artifact is `14541004265`.
- Corrected the v1.1 certification record to reflect that J110-IMP-09 physical Task movement was completed successfully; its detailed execution record was not retained and is explicitly left unknown rather than reconstructed. The remaining acceptance work is J110-IMP-15 plus live Linux/Desktop GitHub acceptance.
- Reopened a bounded v1.1 physical-acceptance remediation after real-device/desktop use: compact header identity/title/chrome, interactive-text legibility, Task leading-control alignment, idle desktop-onboarding scrollbar removal, canonical past-date scheduling feedback, and recurrence-aware rollover non-accumulation are now governed by J110-IMP-18..21 without reopening unrelated synchronization/GitHub/persistence architecture.
- Implemented and non-device certified J110-IMP-18..20 on source `3b60ad938f2173521c4eb2aa8b59603a15d930b1`: Verify #1598 passed 41/41 core/integration/architecture files (261/261 tests), 79/79 real-browser tests, Android build/FLOSS/F-Droid certification and 5/5 API-24 instrumentation tests. Reviewed browser evidence is artifact `14591328349`; Android candidate artifact is `14591926175` with unpacked APK SHA-256 `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0`. J110-IMP-21 remains open only for focused physical Android confirmation.
- Restored the API-24 hosted certification lane after Android Emulator 37.3.10 changed its software-acceleration behavior by explicitly allowing TCG for that isolated emulator step; this is CI compatibility only and does not change product/runtime architecture.
- Added binding v1.1 app-wide configured-application UX authority and the UX-F0 desktop/mobile fidelity audit alongside the existing onboarding/Task-form references; the new authority governs compact bottom navigation, Planner FAB, action prominence, Planner density, History/Settings composition and the reviewed visual-evidence matrix.
- Reconciled the functional, UI, technical, repository-governance, implementation-plan and evidence authorities around the reopened mobile UX remediation; the previous green hosted candidate is no longer closure evidence for the amended mobile interaction/Settings/Repeat/drag contracts.
- Corrected the reopened week-navigation authority after reviewing the pinned Astryx paging APIs and the WIP implementation: Astryx `Carousel` + `useSnapPaging` are the sole reusable paging-mechanics owner, and Jig keeps only a thin semantic WeekPager adapter. Astryx already owns the required settle/immediate-go-to lifecycle internally in its private `usePager`, but released Carousel APIs through `0.7.16` do not expose that lifecycle publicly; the final Jig cutover is therefore blocked on the smallest released public Carousel seam rather than authorized to reimplement scrolling/snap mechanics.

- Canonicalized product, functional, technical, UI/theme and repository-governance authorities for v1.1 while retaining v1.0.6 clauses as historical release provenance where superseded.
- Reopened the v1.1 onboarding/reconnect/Settings implementation against the corrected intent-first authority and made all non-device implementation/certification complete before the final physical-device wave; permanent hosted verification remains the authoritative CI gate and local `act` remains optional preflight.
- Consolidated all v1.1 implementation, evidence and certification state onto the single authoritative `v1.1` integration branch; temporary work/CI branches are non-authoritative and physical failures are corrected on `v1.1` before final promotion to `master`.
- Retained source candidate `305b2cd8f14f8f6ac791e3d5d07340b9d5e45efd` / Verify run `44516299671` as functional/runtime evidence only. Its former UX/UI closure is withdrawn because passing geometry tests and retained screenshots did not prove governed visual fidelity; UX-F0..UX-F7 now require a new reviewed post-remediation candidate.

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
