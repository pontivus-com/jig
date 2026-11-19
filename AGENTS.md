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
- deterministic reconciliation of **non-conflicting** concurrent changes to Jig-owned canonical Task/recurrence records, using an explicit common snapshot and without last-writer-wins; contradictory semantic changes must preserve both sides and stop safely rather than being silently chosen;
- one structured repository synchronization status that distinguishes the current Jig local-Git snapshot boundary (pending/committed/issue) from remote synchronization (not configured/pending/retrying/synchronized/sync-issue); primary/header labels such as Local only, Syncing, Up to date and Needs attention are derived user-level presentation, while exact Local Git/Remote Git facts remain secondary diagnostics rather than a second authority;
- validating/adopting a complete Jig portable snapshot presented by the selected repository.

Git owns:
- repository acquisition/cloning mechanics and transport;
- repository structure and organization;
- branches, refs, worktrees, upstreams and topology;
- user/repository identity and commit-signing policy;
- credentials and authentication;
- repository history, Git merge/rebase/conflict mechanics and history reconciliation;
- normal Git configuration and transport semantics.

The narrow Jig-owned planning-data reconciliation above must never be implemented as `git pull`, a Git merge/rebase workflow, forced history rewrite or a user-facing Git-conflict model. It operates only on validated canonical Jig records and emits one ordinary snapshot commit on the current remote head when the data-level merge is conflict-free.

The repository adapter may invoke Git commands necessary to synchronize Jig-owned data and may use an isolation mechanism internally to ensure unrelated repository content is untouched. Those mechanics must remain private to the adapter. Do not expose or persist Git topology as Jig application state or user configuration.

Jig must never:
- modify global or repository Git configuration to make its own operations succeed;
- require a user to create a Jig-specific signing identity/key;
- implement Git reconciliation, merge/rebase/conflict workflows;
- implement repository provisioning logic beyond delegating a requested clone to Git;
- implement a Jig repository-migration subsystem;
- stage, commit, rewrite, reset, merge or push unrelated repository content.

v1.1 separates application installation from repository setup while keeping onboarding inside the one canonical Jig application frame. A fresh Linux installation with no repository arguments starts Jig in bootstrap mode but still renders the normal Theme/LayerProvider/AppShell/header/body composition; desktop onboarding offers **Connect GitHub repository** plus **Use an existing local repository**, while Android offers **Connect GitHub repository** only. Existing automation remains supported through `--repo` or the backwards-compatible `--repo-url` + `--checkout`; those inputs perform immediate canonical setup. All acquisition paths converge on the same repository validation/adoption authority. A repository with no synchronization remote is a healthy `Local only` installation.

GitHub onboarding uses one governed public GitHub App registration, **Jig Desktop & Mobile**, for both Linux/Desktop and Android. Both runtimes use the same public App slug/client ID through direct GitHub App Device Flow. The provider-required 8-character `user_code` is a legitimate visible authorization datum and must be copyable while Jig opens/offers GitHub's device-verification page; Device Flow polling, `authorization_pending`/`slow_down`, installation discovery, access re-check, acquisition and adoption are Jig orchestration responsibilities and must not become manual Refresh/Grant/Manage workflow. GitHub installation/repository grants remain GitHub-owned surfaces. Installation and repository discovery must consume all pagination before Jig concludes that access or a repository is absent or unique. Returning from GitHub is not itself proof that repository access was granted. Repository selection is shown only when more than one genuine eligible choice remains.

Settings and the compact header present the user's planning-data home, local-safety and continuity outcome in product language. Settings is a content-sized vertical reading hierarchy, not a dashboard: **Data & sync** combines repository identity/local safety/continuity/recovery; **Appearance** owns only Theme + System/Light/Dark; **Notifications** is a separate group; **Diagnostics / technical details** is collapsed/subordinate by default and contains remote, Local Git, service/database, repository path and expert manual sync facts. Do not use equal-height/equal-width dashboard cards, min-height whitespace or place Notifications inside Appearance. These observations are informational and credential-free: remotes remain Git configuration and must not be copied into Jig application configuration, canonical planning state or portable records. Existing local repositories remain provider-neutral and keep their current topology/authentication. The shared GitHub client registration contains no client secret or Redirect URI. Linux managed checkouts are placed under `~/.local/share/jig-data/repositories/github/<owner>/<repository>`. Repository continuity between machines/checkouts is provided by Git; Jig does not implement repository migration, branch management, provisioning, merge/rebase/conflict workflows or unrelated repository mutation.

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
- v1.1 onboarding and Task-form presentation are governed by `docs/design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html` and `docs/design/reference/jig-v1.1-desktop-onboarding-task-form-governed-reference.html` together with `docs/design/ui-solution.md`. Within that scope they are binding hierarchy/geometry/interaction authority, not optional inspiration. The mobile reference is the v1.1 default for mobile form composition, spacing/density, touch geometry, BottomSheet scrolling/progressive disclosure and action placement. The older `docs/design/reference/mobile-editor.svg` and current implementation are historical/evidence only for superseded Task-form presentation.

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
- Planner is default/Home and there is no SideNav. The desktop AppShell top region remains a three-zone Jig composition: Jig Home at left, one centered inline temporal group `Previous · compact week range · Next · Today`, and Add task + adjacent Planner/History/Settings navigation + synchronization state at right. Planner temporal state is displayed-week-only; dates are not selectable. v1.1 narrow/mobile uses **one sticky header region with two rows on Planner**: an application row containing the complete Jig wordmark, Planner-only Add task, compact synchronization state and the hamburger menu; and a temporal row containing Previous, compact week range, Next and Today. Each mobile row is >=56 CSS px; every ordinary mobile action target is >=48×48px, with >=8px visible separation between standalone adjacent controls. History/Settings render only the sticky application row and do not render Planner-only Add; that row is the **single destination-heading owner**. The hamburger remains a popover/menu from the one typed Planner/History/Settings destination owner, never a Drawer/SideNav/rail, but its trigger and rows must meet the same touch geometry; 'compact' may not mean cramped. Prefer Astryx public DropdownMenu only when its public API meets the geometry; otherwise use the smallest Astryx-Popover/public-leaf composition without private selectors or duplicate destination state.
- Reduced chrome remains governed: Planner date tracks are open layout tracks, not boxed panels. Prefer whitespace and at most hairline separation; Task cards are the primary discrete surfaces and use restrained border/elevation. Desktop header remains <=44px (2.75rem). **The old narrow <=56px total-header budget is superseded by v1.1**: mobile Planner rows are content-height, sticky and >=56px with >=48px touch targets; safe-area inset is additive at the header. App-wide mobile touch geometry applies to header/menu/date Add/Task controls/BottomSheet/Repeat/Settings, not just chrome. Do not use absolute positioning, negative offsets, undersized `size="sm"` targets or private Astryx selectors to recreate the old envelope. Use semantic iconography without replacing accessible text/labels for essential meaning. Astryx's public icon registry is the one reusable icon system; missing Jig-specific meanings use Astryx namespaced extension keys rather than raw Unicode stand-ins or another icon library.
- v1.0.5 application composition is full-bleed: zero application-shell/page-level margin and padding on all four viewport edges at desktop and narrow widths; no outer content-frame border/radius/background panel; header and Planner run edge-to-edge. Internal component padding remains owned by the semantic component. Removing the former 48px desktop outer inset moves the governed responsive breakpoint to 73rem / 1168px.
- v1.0.6 secondary-screen geometry: the application frame and Planner remain full-bleed, while History and Settings continuously own one centered 50rem/approximately 800px maximum content measure. When less than 50rem is available, those screens naturally consume the full available width. Do not remove the cap at the 73rem Planner breakpoint, introduce a second width breakpoint, or reintroduce a global/AppShell max-width. v1.1 removes the redundant body-level History/Settings reference heading; the bounded content measure begins with actual destination content because title/subtitle live in the application header.
- v1.0.6 appearance has exactly two independent browser-local presentation choices: one of the 13 governed Theme presets and one of `System | Light | Dark`. The root Astryx `Theme` is the only runtime owner. System follows platform color preference through Astryx; do not add a second JavaScript color-mode engine. Theme/appearance controls exist only in Settings → Appearance and never mutate Task, Planner, draft, persistence, protocol or Git state.
- Task create/edit has one integrated form and one primary Save. Field order is Title → Date → Repeat → Reminder → Priority → Context → Reference → Notes. Every governed Repeat state shows the complete form; Repeat controls expand in place between Date and Reminder rather than becoming a recurrence-only surface. Repeat uses `Does not repeat | Weekly | Monthly` progressive disclosure: off renders no recurrence details; Weekly reveals interval/weekdays/end; Monthly reveals day/end. Mobile Repeat controls meet >=48px touch geometry and may wrap rather than compress below the mobile interaction budget. There is no sibling recurrence editor or second Enable/Save repeat action. Existing Task `edit` may carry optional recurrence change so occurrence-local edits + series-level recurrence reconciliation commit atomically in one transaction/revision; omission means unchanged, `null` means stop. Public `set_recurrence` is removed after migration rather than retained as a parallel user-save path.
- Product-state color is governed by the v1.0.6 semantic contract in `docs/architecture/technical-solution.md` JIG-106-SD-04 and `docs/design/brand-and-theme.md`. Jig-owned states consume named product aliases/Astryx semantic roles and feature CSS never branches on theme name or embeds theme palette literals. Literal Jig hue descriptions apply only to the default Jig palette; all themes must preserve semantic role, state precedence and non-color meaning.
- The in-application header wordmark uses one canonical inline Jig geometry whose foreground/accent paints consume active-theme semantic roles. Do not restore Light/Dark fixed-color image switching for application chrome. Fixed favicon/app/README/release assets remain separate theme-independent brand artifacts.
- Planner Task click/tap selects and opens the editable Task workspace; it never moves the Task. The physical Android gate has rejected the Pangea implementation. v1.1 direct movement has one proof-gated owner in `ui/src/drag.tsx`: remove Pangea and use the current `@dnd-kit/react@0.5.3` + `@dnd-kit/dom@0.5.3` candidate only after the exact implementation passes desktop/browser and physical-Android proof. **Only the dedicated grip is the drag activator**; mobile grip >=48×48px and Task body remains normal touch-scroll/open content. Each date renders N+1 explicit droppable insertion slots (before/between/after; empty index 0), so inter-card whitespace is a real destination. Canonical Task order is unchanged until one successful drop. All terminal paths clear overlay/source/target state; a floating card after gesture termination is a hard failure. Do not retain Pangea, legacy dnd-kit code, a second framework or parallel custom sensors. Editing Date and same-day Move up/Move down remain non-drag alternatives. Global/date Add semantics remain unchanged and mobile date Add meets the app-wide touch target rule.
- If the pinned Astryx public API cannot satisfy a governed requirement, first prove and document the incompatibility. Then use the smallest Jig-owned semantic composition built from Astryx public leaves/tokens. Do not solve the problem by reaching into Astryx internals or adding another UI/styling framework.


## v1.1 Android and distribution boundary

v1.1 adds one independently installable **Android** application while preserving the same canonical Task/planning, portable records and repository semantics as Linux. iOS is outside v1.1.

- The Android application ID is `com.pontivus.jig`; native release version metadata derives from root `package.json.version`, not a second manually maintained version.
- Android uses app-owned private repository/SQLite storage; arbitrary device-local worktree selection is outside v1.1.
- Offline Task mutation commits locally before synchronization. Background Git synchronization is an optimization rather than a correctness dependency.
- Android daily rollover runs through the same canonical persistence transaction on initial activation, resume and foreground local-midnight transition.
- Development APKs are local certification artifacts. **F-Droid is the first public Android distribution target**. Google Play is deferred; no core behavior may depend on Play Services/Firebase/proprietary runtime services.
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
