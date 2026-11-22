# AGENTS.md

## Purpose

This repository implements **Jig**, a local-first just-in-time daily planner. Agents must preserve the product boundary before optimizing implementation details.

## Foundational ownership rule

For every capability that crosses a system boundary, identify the **authoritative owner first**.

Jig implements only the minimum behavior required for Jig's product job. It must not absorb configuration, topology, provisioning, migration, reconciliation, policy, or lifecycle responsibilities that belong to an external system.

When evaluating or implementing a change:

1. State the user-visible Jig requirement.
2. Identify which system is authoritative for each part of the behavior.
3. Keep only the Jig-owned portion in Jig.
4. Use the narrowest integration boundary necessary to obtain the required outcome.
5. Do not turn an integration mechanism into Jig domain state, user workflow, configuration, or a new subsystem unless the product definition explicitly requires that responsibility.

If a technical choice creates additional responsibilities that the product did not ask Jig to own, treat that as scope creep and simplify the choice rather than building more machinery around it.

## Git boundary

Jig requires **automatic synchronization of Jig-owned portable planning data through Git**. That outcome is Jig's responsibility.

Jig owns:
- canonical Task/planning semantics;
- local SQLite durability;
- deterministic portable Jig records;
- scheduling/triggering automatic synchronization;
- one structured repository synchronization status that distinguishes the current Jig local-Git snapshot boundary (pending/committed/issue) from remote synchronization (not configured/pending/retrying/synchronized/sync-issue); primary/header labels such as Local only, Syncing, Up to date and Needs attention are derived user-level presentation, while exact Local Git/Remote Git facts remain secondary diagnostics rather than a second authority;
- validating/adopting a complete Jig portable snapshot presented by the selected repository;
- bounded automatic reconciliation of provably related **Jig-owned `jig-data`** histories, including complete semantic validation before any accepted merge result moves an authoritative ref;
- structured, credential-free synchronization diagnostics that explain the current phase, classified failure, observed lineage/heads, retry state and any automatic recovery attempt.

Git owns:
- repository acquisition/cloning mechanics and transport;
- repository structure and organization;
- branches, refs, worktrees, upstreams and topology;
- user/repository identity and commit-signing policy;
- credentials and authentication;
- general repository history and merge/rebase/conflict reconciliation **outside Jig's isolated `jig-data` portable-history boundary**;
- normal Git configuration and transport semantics.

A normal remote fast-forward created by another supported Jig client is ordinary synchronization and must be adopted automatically. If local and remote **Jig-owned `jig-data`** histories both advanced independently, v1.1.2 performs one bounded automatic recovery when common ancestry, dataset identity and canonical portable inputs are provable: build the reconciliation candidate without first moving authoritative refs, validate the complete resulting Task/recurrence snapshot, then accept and non-force push only a valid result. A Git-clean result that violates Jig semantic invariants is rejected. Unresolved content conflict, unsafe/invalid snapshot, incompatible dataset, ambiguous/unknown ancestry, incompatible remote rewrite/deletion or ambiguous remote remains a quiescent `Needs attention` state with precise sanitized diagnostics. This recovery is not a general repository merge/rebase product feature.

The repository adapter may invoke Git commands necessary to synchronize Jig-owned data and may use an isolation mechanism internally to ensure unrelated repository content is untouched. Those mechanics must remain private to the adapter. Do not expose or persist Git topology as Jig application state or user configuration.

Jig must never:
- modify global or repository Git configuration to make its own operations succeed;
- require a user to create a Jig-specific signing identity/key;
- implement a general-purpose or user-facing Git reconciliation/merge/rebase/conflict workflow outside the bounded Jig-owned `jig-data` recovery contract;
- implement repository provisioning logic beyond delegating a requested clone to Git;
- implement a Jig repository-migration subsystem;
- stage, commit, rewrite, reset, merge or push unrelated repository content;
- force-push `jig-data` or accept a reconciliation candidate before the complete portable snapshot passes canonical validation.

v1.1 separates application installation from repository setup while keeping onboarding inside the one canonical Jig application frame. A fresh Linux installation with no repository arguments starts Jig in bootstrap mode but still renders the normal Theme/LayerProvider/AppShell/header/body composition. **Presentation and setup capability are independent:** desktop/expanded versus narrow onboarding composition is selected only by `LayoutMode`; **Use an existing local repository** renders only when `SetupStatus.local_repository_available` is true, so a narrow Linux/browser presentation may expose it, while Android/native never exposes arbitrary local-worktree import. **Connect GitHub repository** is the shared provider intent when the runtime capability is available. Existing automation remains supported through `--repo` or the backwards-compatible `--repo-url` + `--checkout`; those inputs perform immediate canonical setup. All acquisition paths converge on the same repository validation/adoption authority. A repository with no synchronization remote is a healthy `Local only` installation.

GitHub onboarding uses one governed public GitHub App registration, **Jig Desktop & Mobile**, for both Linux/Desktop and Android. Both runtimes use the same public App slug/client ID through direct GitHub App Device Flow. The provider-required 8-character `user_code` is a legitimate visible authorization datum and must be copyable while Jig opens/offers GitHub's device-verification page; Device Flow polling, `authorization_pending`/`slow_down`, installation discovery, access re-check, acquisition and adoption are Jig orchestration responsibilities and must not become manual Refresh/Grant/Manage workflow. GitHub installation/repository grants remain GitHub-owned surfaces. Installation and repository discovery must consume all pagination before Jig concludes that access or a repository is absent or unique. Returning from GitHub is not itself proof that repository access was granted. Repository selection is shown only when more than one genuine eligible choice remains.

Settings and the compact header present the user's planning-data home, local-safety and continuity outcome in product language. Settings is a content-sized vertical reading hierarchy, not a dashboard: **Data & sync** combines repository identity/local safety/continuity/recovery; **Appearance** owns only Theme + System/Light/Dark; **Notifications** is a separate group; **Diagnostics / technical details** is collapsed/subordinate by default and contains repository path, service/database facts, Local Git/Remote Git, synchronization phase, classified failure/retry state, abbreviated Jig heads/lineage, recovery attempt/outcome, sanitized remote identity and expert manual sync. When Jig cannot recover automatically, Diagnostics must contain enough credential-free information to understand why and offers a copyable support projection. Do not use equal-height/equal-width dashboard cards, min-height whitespace or place Notifications inside Appearance. Diagnostics/remotes must never copy credentials or Task content into application configuration, canonical planning state or portable records. Existing local repositories remain provider-neutral and keep their current topology/authentication. The shared GitHub client registration contains no client secret or Redirect URI. Linux managed checkouts are placed under `~/.local/share/jig-data/repositories/github/<owner>/<repository>`. Repository continuity between machines/checkouts is provided by Git plus Jig's bounded isolated `jig-data` recovery; Jig still does not own repository migration, branch provisioning, general user-history reconciliation or unrelated repository mutation.

## Other external-system boundaries

Apply the same rule beyond Git:

- **systemd / OS:** Jig may install/start its own user service. It must not change administrator/session policy such as linger or manage unrelated services.
- **Browser:** Jig may open its local UI and use browser capabilities required by the product. It does not manage the browser or duplicate browser/OS policy.
- **Filesystem:** Jig owns its application files and Jig data paths only. It is not a general filesystem migration/provisioning tool.
- **External project systems:** Jig stores references to authoritative work. It does not copy their domain models, lifecycle, or source content.
- **Notifications:** Jig owns reminder eligibility, the durable in-application reminder-due attention projection, browser notification delivery attempts while the Linux/browser application is open, and Android local-notification scheduling/reconciliation. Browser delivery uses a small service worker plus `ServiceWorkerRegistration.showNotification()`; Android uses the governed native local-notification adapter. The browser/Android OS owns permission and actual delivery. Scheduling and delivered/displayed outcomes are never conflated. Jig has no reminder Toast fallback, push service, remote reminder scheduler or canonical notification-delivery state.

## UI and design-system boundary

- Jig UI is intent-first and purpose-built on desktop and Android. Primary controls represent user goals, genuine choices or actionable recovery; protocol phases, infrastructure topology and internal state-machine transitions must not be reproduced as user workflow. Technical facts may be inspectable in Diagnostics without becoming the primary interaction model.
- Onboarding is a Jig application body state inside the canonical AppShell from first render. Do not create a parallel setup shell/page whose visual identity, header/body geometry or interaction model diverges from configured Jig.
- v1.1 application presentation is governed by `docs/design/reference/jig-v1.1-application-ux-ui-governed-reference.html`, `docs/design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html`, `docs/design/reference/jig-v1.1-desktop-onboarding-task-form-governed-reference.html`, `docs/design/ui-solution.md` and the UX-F0 fidelity audit. The app-wide reference owns configured shell/navigation/Planner/History/Settings hierarchy; the mobile/desktop references own onboarding and Task-form composition. They are binding hierarchy/geometry/interaction authority, not optional inspiration. Current implementation and retained screenshots are evidence only and cannot override the governed reference.

Jig uses the pinned Astryx release as the authoritative reusable UI and styling system. This is an architecture boundary, not a visual preference.

Apply UI decisions in this order:

1. Product definition, functional requirements and the governed UI references define the user-visible outcome, information hierarchy and structural geometry.
2. Astryx public component, layout, navigation, dialog, form and theme APIs define how reusable UI mechanics are realized.
3. Jig React composition owns only product-specific regions and geometry that are not already owned by one Astryx public primitive.
4. Jig-owned CSS styles only Jig-owned composition and consumes public Astryx semantic/spacing/radius/type tokens.
5. Browser tests and screenshots verify that architecture; they must never be used as justification for compensating overrides.

Mandatory rules:

- Do not recreate an Astryx-owned application shell, navigation system, dialog anatomy, list anatomy, field anatomy or responsive behavior in parallel merely to resemble a reference image.
- Use Astryx public interaction primitives for reusable controls and navigation when they satisfy the product contract, including `Button`/`IconButton` for actions and `Link` for navigable references. Do not recreate their press, focus, disabled, URL-safety or external-link behavior with raw native controls plus Jig CSS. A raw interactive element is allowed only after documenting a concrete public-API incompatibility and keeping the smallest semantic fallback.
- Do not depend on private/undocumented Astryx DOM structure, CSS selectors, CSS custom properties or internal StyleX implementation details. A private name such as an internal `--_*` variable is not an application integration API.
- v1.0.6 theme authoring uses one typed theme registry and Astryx's public `defineTheme`/root `Theme` APIs. The default Jig theme, six dual-mode Astryx-derived wrappers and six governed community palette themes are authored as Astryx theme sources and compiled with pinned `@astryxdesign/cli@0.7.13` into committed generated artifacts. Runtime code consumes built theme objects only. Jig-authored code must not synthesize Astryx compiler/runtime markers such as `__built`, hand-edit generated theme files, dynamically inject unbuilt themes, or replace `astryx theme build` with an application-owned compiler path. CI must check every authored v1.0.6 theme for source/artifact drift.
- Do not add an application-owned high-priority cascade layer, `!important`, or increasingly specific selectors to override Astryx internals. Preserve Astryx's published stylesheet/theme ordering, then style Jig-owned elements through ordinary scoped rules and supported public component props.
- Do not use CSS hiding, offsets or absolute positioning to transform the wrong semantic DOM hierarchy into a materially different desktop/mobile hierarchy. At Jig's one semantic breakpoint, render the correct composition while preserving shared application state. CSS media queries may handle pure reflow/density only.
- Hard-coded dimensions are permitted only for governed structural budgets such as the seven Planner tracks (160px minimum), the derived 73rem desktop/narrow Planner composition boundary, the v1.0.6 continuous History/Settings content measure (50rem / approximately 800px maximum), Settings split and reference mobile frame. The 50rem secondary-screen measure is not switched by the 73rem Planner breakpoint: it resolves as `min(available width, 50rem)`. The application viewport inset is explicitly zero. Interior spacing, sizing and typography use Astryx public tokens/component APIs unless the governed reference establishes a real product-level dimension.
- Each layout property has one owner. Remove obsolete rules when composition changes; do not stack later overrides on top of earlier rules to cancel them.
- Task selection is contextual editable presentation state: selecting a Task must not change the active destination and opens the full editable Task form directly. The governed Task workspace owns only existing-Task draft/create-draft state; desktop Planner/History render it through the public Astryx non-modal right Drawer and narrow/mobile renders the same state through the public Astryx non-modal BottomSheet rising from the bottom. There is no read-only view→edit indirection, centered/fullscreen Task editor, or separate move-to-date workspace. Permanent Delete confirmation remains the only blocking Task dialog.
- Planner is default/Home and there is no SideNav. The desktop AppShell top region remains a three-zone Jig composition: Jig Home at left, one centered inline temporal group `Previous · compact week range · Next · Today`, and Add task + adjacent Planner/History/Settings navigation + restrained synchronization state at right. Planner temporal state is displayed-week-only; dates are not selectable. **UX-F0 supersedes the earlier compact hamburger/Add/sync cluster.** Configured narrow/mobile uses one compact application row with canonical Jig identity at left, the active **Planner/History/Settings** title centered, and restrained synchronization status at right; Planner alone adds the temporal row `Previous · readable week range · Next · Today`. Both rows target 52px and stay <=56px at normal text sizing while preserving >=48×48px hit targets; safe-area inset is additive. Persistent bottom navigation owns exactly Planner/History/Settings, and Planner alone has the bottom-end Add task FAB. A >=48×48px touch target is an interaction/focus area, not a requirement for a 48px visible filled control. Healthy sync must remain visually subordinate; only actionable warning/error may escalate. Do not replace Jig identity with a destination title, omit the Planner title, or create a second navigation owner/component system.
- Operational attention/confirmation has one shared semantic state owner but **two viewport placement owners** under v1.1.2. The pinned Astryx `Banner` is not used for Jig's multi-line operational error/warning surface because its public API top-aligns the status icon and end-action area whenever `description` is present and exposes no public header-alignment hook. Shared feedback content is built only from public Astryx `Icon`/`Button` leaves and public semantic/spacing/type/radius tokens; desktop places transient success in a compact bounded top-end region and durable attention in a bounded wide-screen region, while narrow/mobile places transient success as an inset safe-area-aware snackbar above bottom navigation and durable attention inline below sticky chrome. Message/dismissal/accessibility state remains singular. Do not target Astryx Banner internals, add CSS descendant overrides, create separate desktop/mobile message state, or add an Android-native banner/notification path.
- v1.1 Planner time navigation is governed by JIG-110-FR-02A / JIG-110-SD-44: one rolling seven-day horizon beginning at today or a future local civil date, explicit Previous/Next movement by seven civil days, and Today reset. `plannerState.displayedHorizonStart` is the sole UI temporal state; the planning core owns seven-date generation, lower-bound clamping and seven-day movement. Global Add owns today; per-date Add exists only for future dates. Adjacent-week direct Carousel/swipe paging under JIG-110-FR-33 / JIG-110-SD-43 is deferred beyond v1.1 and must not be implemented, restored, tested as a release gate or treated as current architecture. Historical WeekPager/Carousel material is future-work provenance only.
- Reduced chrome remains governed: Planner date tracks are open layout tracks, not boxed panels. Prefer whitespace and at most hairline separation; Task cards are the primary discrete surfaces and use restrained border/elevation. Desktop header remains <=44px (2.75rem). Narrow/mobile application and Planner temporal rows target 52px and stay <=56px at normal text sizing while preserving >=48px touch targets; safe-area inset is additive. Interactive labels use at least normal base/body action typography; small/extra-small text is for metadata/help, not primary button/navigation labels. App-wide mobile touch geometry applies to header/date Add/Task controls/BottomSheet/Repeat/Settings, not just chrome. Do not use absolute positioning, negative offsets, undersized targets or private Astryx selectors to recreate a compact envelope.
- v1.0.5 application composition is full-bleed: zero application-shell/page-level margin and padding on all four viewport edges at desktop and narrow widths; no outer content-frame border/radius/background panel; header and Planner run edge-to-edge. Internal component padding remains owned by the semantic component. Removing the former 48px desktop outer inset moves the governed responsive breakpoint to 73rem / 1168px.
- v1.0.6 secondary-screen geometry: the application frame and Planner remain full-bleed, while History and Settings continuously own one centered 50rem/approximately 800px maximum content measure. When less than 50rem is available, those screens naturally consume the full available width. Do not remove the cap at the 73rem Planner breakpoint, introduce a second width breakpoint, or reintroduce a global/AppShell max-width. v1.1 removes the redundant body-level History/Settings reference heading; the bounded content measure begins with actual destination content because title/subtitle live in the application header.
- v1.1.2 adaptive presentation/runtime ownership is governed by `docs/design/v1.1.2-responsive-interaction-matrix.md` and `docs/architecture/v1.1.2-responsive-presentation-architecture.md`. Treat **presentation class**, **runtime capability** and **input modality** as separate concerns: `LayoutMode` is derived only from the 73rem width boundary and selects desktop/expanded versus narrow composition; Linux/browser versus Android/native mechanics are selected only at platform adapter boundaries; pointer/keyboard/IME facts are observed only where the interaction requires them. There is no global `isMobile` owner. A narrow Linux window uses narrow composition with Linux/browser capabilities; Android retains native lifecycle, Back, system bars, notification/exact-alarm, secure-storage and repository capabilities regardless of presentation width. Desktop/narrow differences such as header/nav/Add/status, seven-track versus stacked Planner, Drawer versus BottomSheet, feedback placement and onboarding composition use separate presenters over shared semantic state. Runtime-only differences such as local-repository availability, browser versus Android notifications, provider-return lifecycle and native Back/system bars must never be inferred from viewport width. Raw `Capacitor.isNativePlatform()` is allowed only in `ui/src/runtime.ts`, `ui/src/setup-http.ts`, `ui/src/notification-settings.ts` and `ui/src/native/**`; it is forbidden in `app.tsx` and ordinary feature/presentation modules. Do not render both presentation trees and hide one with CSS, and do not create desktop/mobile/platform DTOs, mapping layers or duplicate semantic state.
- v1.1.2 normal motion uses one public Astryx/Jig duration-token scale at **at least 2×** the prior effective tempo. Apply the shared public duration tokens across every theme so Jig CSS and Astryx Drawer/BottomSheet/Menu/Dialog/animated-layout behavior remain coherent. Do not change private `--_astryx-*` tempo variables or hand-edit generated themes. Explicit Jig animation/transition durations below 190ms are not allowed at normal motion settings. `prefers-reduced-motion` remains authoritative and removes/reduces motion rather than slowing it.
- v1.0.6 appearance has exactly two independent browser-local presentation choices: one of the 13 governed Theme presets and one of `System | Light | Dark`. The root Astryx `Theme` is the only runtime owner. System follows platform color preference through Astryx; do not add a second JavaScript color-mode engine. Theme/appearance controls exist only in Settings → Appearance and never mutate Task, Planner, draft, persistence, protocol or Git state.
- Task create/edit has one integrated form and one primary Save. Field order is Title → Date → Repeat → Reminder → Priority → Context → Reference → Notes. Every governed Repeat state shows the complete form; Repeat controls expand in place between Date and Reminder rather than becoming a recurrence-only surface. Repeat uses `Does not repeat | Weekly | Monthly` progressive disclosure: off renders no recurrence details; Weekly reveals interval/weekdays/end; Monthly reveals day/end. Mobile Repeat controls meet >=48px touch geometry and may wrap rather than compress below the mobile interaction budget. There is no sibling recurrence editor or second Enable/Save repeat action. Existing Task `edit` may carry optional recurrence change so occurrence-local edits + series-level recurrence reconciliation commit atomically in one transaction/revision; omission means unchanged, `null` means stop. Public `set_recurrence` is removed after migration rather than retained as a parallel user-save path. Intentional create/edit/move scheduling may target only today or a future local civil date; one pure core scheduling predicate owns this rule and UI/platform layers only project it.
- Product-state color is governed by the v1.0.6 semantic contract in `docs/architecture/technical-solution.md` JIG-106-SD-04 and `docs/design/brand-and-theme.md`, amended by JIG-112-FR/SD-01. Jig-owned states consume named product aliases/Astryx semantic roles and feature CSS never branches on theme name or embeds theme palette literals. v1.1.2 chrome/Planner/Task surface roles are explicitly authored per Theme × Light/Dark because the 13 theme families do not share one tonal topology; a universal body/surface/card mix formula is not authoritative. Theme-specific role values belong only in typed theme sources and compiled Astryx artifacts. Literal Jig hue descriptions apply only to the default Jig palette; all themes must preserve semantic role, state precedence and non-color meaning.
- The in-application header wordmark uses one canonical inline Jig geometry whose foreground/accent paints consume active-theme semantic roles. Do not restore Light/Dark fixed-color image switching for application chrome. Fixed favicon/app/README/release assets remain separate theme-independent brand artifacts.
- Planner Task click/tap selects and opens the editable Task workspace; it never moves the Task. Pangea and the later Jig-owned insertion-line protocol are rejected interaction history. v1.1.2 direct movement keeps one owner over the governed pinned dnd-kit packages using `useSortable` for collision/group/index mechanics, but **dnd-kit's optimistic DOM sorting remains disabled with drag-over prevention** because that same mechanism caused the certified v1.0.5 React `removeChild` reconciliation crash. React owns one ephemeral prospective placement (active Task + destination date/index) and derives the visible desktop/narrow Task sequences from canonical Tasks plus that placement. **Only the dedicated grip is the drag activator**; mobile grip and completion checkbox each retain >=48×48px independent hit areas and are vertically centered in the Task card. While held, the shared real Task-card presentation follows the pointer/finger in one DragOverlay and surrounding cards reflow around a card-sized projected footprint; empty-date placement is card-sized, never a line, and the old source position does not remain as a misleading faded duplicate. Canonical Task state persists once on successful drop, and that date/index must equal the last visible prospective placement. Touch uses deliberate delay+tolerance so ordinary scrolling remains available; mouse/pen use a short movement threshold. Past dates remain invalid scheduling targets. All terminal paths clear prospective/overlay state and restore prior visual order on cancel/failure. Do not add a second drag/error framework or a parallel durable ordering model. Editing Date and same-day Move up/Move down remain non-drag alternatives and share the same canonical scheduling rules.
- If the pinned Astryx public API cannot satisfy a governed requirement, first prove and document the incompatibility. Then use the smallest Jig-owned semantic composition built from Astryx public leaves/tokens. Do not solve the problem by reaching into Astryx internals or adding another UI/styling framework.


## v1.1 Android and distribution boundary

v1.1 adds one independently installable **Android** application while preserving the same canonical Task/planning, portable records and repository semantics as Linux. iOS is outside v1.1.

- The Android application ID is `com.pontivus.jig`; native release version metadata derives from root `package.json.version`, not a second manually maintained version.
- Android uses app-owned private repository/SQLite storage; arbitrary device-local worktree selection is outside v1.1.
- Offline Task mutation commits locally before synchronization. Background Git synchronization is an optimization rather than a correctness dependency.
- Android daily rollover runs through the same canonical persistence transaction on initial activation, resume and foreground local-midnight transition.
- Development APKs are local certification artifacts. **F-Droid is the first intended public Android distribution target**, but external F-Droid submission/publication is deferred until Jig is stable and the required marketing/store material is ready. F-Droid compatibility/readiness remains an engineering constraint; publication is not a v1.1 implementation or release gate. Google Play is deferred; no core behavior may depend on Play Services/Firebase/proprietary runtime services.
- Native dependency/build choices must remain FLOSS/source-build compatible for F-Droid.

## Architecture discipline

- Product definition is the highest authority for scope.
- Functional requirements define observable Jig behavior and must not add product responsibilities.
- Technical design selects the minimum implementation that satisfies those requirements and must not promote external-system mechanics into product/application responsibilities.
- Implementation plans cannot use an earlier technical choice as justification for new scope.
- Prefer deleting or collapsing unnecessary machinery over hardening an abstraction Jig should not own.
- Maintain one canonical Task model and one local persistence authority.
- Preserve the functional-core/imperative-shell dependency direction: pure Task/planning rules in `src/core`; the single shared asynchronous SQLite persistence semantics in `src/persistence`; Linux HTTP/Git/process/filesystem and the Bun SQLite driver in `src/shell`; Android native capability adapters and browser/native presentation state in `ui/src` plus the committed `android/` shell. Platform adapters must not duplicate core planning or persistence semantics.
- TypeScript strictness is architectural. Do not add `any`, double casts, non-null assertions, or unchecked type assertions to silence the compiler. Untyped external data must be narrowed/validated at the smallest boundary; justified third-party interop assertions stay local to that adapter.
- Apply DRY at the semantic-owner level: one state/algorithm/mapping for one meaning. Consolidate duplicate Planner sequence rendering, status mapping, date-header behavior and command construction rather than maintaining responsive or destination-specific copies.
- Do not introduce DTO/mapping hierarchies, service/repository class stacks, workflow frameworks, or parallel semantic owners without a demonstrated requirement.
- At an external-system integration boundary, preserve the authoritative system's protocol/configuration terminology for fields and concepts. Jig may classify how that material is handled, but must not rename the external concern into a parallel Jig vocabulary. v1.1 GitHub authorization uses GitHub App Device Flow directly between Jig and GitHub: the native registration owns only the public `client_id` plus public App routing metadata. `client_secret` and `redirect_uri` are not part of the governed Device Flow client contract and must not be added merely because other GitHub OAuth flows use them.

## v1.1 branch governance

- `v1.1` is the single authoritative integration branch for all v1.1 implementation, documentation, evidence and physical-certification corrections until the version is ready for final promotion.
- Do not distribute v1.1 implementation state across parallel `work/v1.1-*`, remediation, certification or synchronization branches. Temporary branches may be used only as short-lived transport/CI mechanisms; once their content is accepted it must be integrated into `v1.1` immediately and they are not product-state authority.
- All v1.1 status/evidence assessments must read the `v1.1` branch. A green temporary-branch SHA is evidence only when that exact executable content is contained in `v1.1`.
- IMP-09 and IMP-15 block **promotion from `v1.1` to `master` / release**, not integration of the candidate implementation into `v1.1`. Physical failures are corrected on `v1.1`; do not fork a competing implementation line.
- `master` remains the published-release line until the governed v1.1 promotion/release sequence explicitly advances it.

## v1.1 physical-acceptance domain correction

- Recurring series use the same canonical rollover owner as one-off Tasks. Rollover must prevent automatic accumulation without adding a recurrence daemon, carry-over flag, Task status or platform branch: preserve the latest due outstanding occurrence per series, supersede older **overdue** outstanding siblings, preserve future-scheduled/completed occurrences, then perform ordinary rollover. This is planning-core maintenance, not a third recurrence user mutation scope.
- Linux and Android must consume that same pure rollover result through the shared persistence semantics. Do not implement recurrence cleanup in React, Kotlin, reminders or Git synchronization.

## Release governance

A merged implementation PR is **not** a release. Release publication is a separate governed transition.

The canonical release contract is `docs/releases/README.md`. Agents preparing or evaluating a release must enforce all of the following:

1. Ordinary implementation/documentation PRs accumulate release notes under `CHANGELOG.md` `[Unreleased]` and **must not** change `package.json.version`.
2. After the intended implementation candidate is on `master`, create a dedicated branch named exactly `release/vX.Y.Z`.
3. The release branch **must explicitly set `package.json.version` to `X.Y.Z`**. This is mandatory release metadata, not an optional cleanup step. The branch version, changelog release heading, release-note filename/target tag and intended Git tag must all agree.
4. The release PR moves the complete accumulated `[Unreleased]` contents into `## [X.Y.Z] - YYYY-MM-DD`, recreates an empty `[Unreleased]`, and contains only the release-metadata files permitted by `scripts/verify-release.ts`.
5. Do not describe, approve or merge a release PR as complete unless its release-metadata verification passes.
6. After the release PR merges to `master`, the permanent Release workflow must actually enter the release path. A green workflow that reports `should_release=false`, “already tagged”, or “No release transition/finalization detected” is a **no-op**, not a successful release.
7. A release is valid only when the permanent release workflow succeeds for the exact merged release commit, the immutable `vX.Y.Z` tag points at that commit, a non-draft GitHub Release is published, and every required asset in the canonical release asset matrix is present with verified checksums.
8. Never compensate for a missed version transition by moving an existing tag, rebuilding a published version, or publishing assets from an implementation branch. Correct the release metadata through the governed release branch/process.

When asked whether a version is “released”, verify the published tag/release/assets, not merely that implementation code merged or that a workflow completed.

## v1.0.1 correction context

The v1.0.1 correction exists because v1.0.0 allowed the Git integration mechanism to expand into repository-management responsibilities and the installer was not robust to ordinary developer Git configuration or interrupted initialization.

For v1.0.1, implementations must:
- restore the authority boundaries above;
- remove repository migration and repository-management behavior from Jig while retaining thin installer repository-selection/acquisition inputs;
- keep automatic synchronization intact;
- make installation/reinstallation safe against existing valid Jig data and the exact recoverable v1.0.0 failed-bootstrap residue;
- ensure Git policy such as commit signing cannot make Jig corrupt or strand installation state;
- expand certification around real developer Git environments and failed-install retry.
