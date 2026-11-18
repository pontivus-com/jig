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
- coarse synchronization outcomes such as local-only, pending/retrying, synchronized, and sync-issue;
- validating/adopting a complete Jig portable snapshot presented by the selected repository.

Git owns:
- repository acquisition/cloning mechanics and transport;
- repository structure and organization;
- branches, refs, worktrees, upstreams and topology;
- user/repository identity and commit-signing policy;
- credentials and authentication;
- history, merge, rebase, conflict handling and reconciliation;
- normal Git configuration and transport semantics.

The repository adapter may invoke Git commands necessary to synchronize Jig-owned data and may use an isolation mechanism internally to ensure unrelated repository content is untouched. Those mechanics must remain private to the adapter. Do not expose or persist Git topology as Jig application state or user configuration.

Jig must never:
- modify global or repository Git configuration to make its own operations succeed;
- require a user to create a Jig-specific signing identity/key;
- implement Git reconciliation, merge/rebase/conflict workflows;
- implement repository provisioning logic beyond delegating a requested clone to Git;
- implement a Jig repository-migration subsystem;
- stage, commit, rewrite, reset, merge or push unrelated repository content.

v1.1 separates application installation from repository setup. A fresh Linux installation with no repository arguments installs/starts Jig in bootstrap mode and the in-application setup flow offers **Use a repository already on this computer** or **Connect GitHub**. Existing automation remains supported through `--repo` or the backwards-compatible `--repo-url` + `--checkout`; those inputs perform immediate canonical setup. All acquisition paths converge on the same repository validation/adoption authority. A repository with no remote is a healthy `Local only` installation. Existing local repositories remain provider-neutral and keep their current topology/authentication. GitHub onboarding uses separate governed public registrations for **Jig Desktop** and **Jig Android**. Desktop and Android must not share App slug/client ID/client secret/Redirect URI values; both request the same least-privilege repository access and converge on the same canonical Jig repository/portable-data contract. Linux managed checkouts are placed under `~/.local/share/jig-data/repositories/github/<owner>/<repository>`. Repository continuity between machines/checkouts is provided by Git; Jig does not implement repository migration, branch management, provisioning, merge/rebase/conflict workflows or unrelated repository mutation.

## Other external-system boundaries

Apply the same rule beyond Git:

- **systemd / OS:** Jig may install/start its own user service. It must not change administrator/session policy such as linger or manage unrelated services.
- **Browser:** Jig may open its local UI and use browser capabilities required by the product. It does not manage the browser or duplicate browser/OS policy.
- **Filesystem:** Jig owns its application files and Jig data paths only. It is not a general filesystem migration/provisioning tool.
- **External project systems:** Jig stores references to authoritative work. It does not copy their domain models, lifecycle, or source content.
- **Notifications:** Jig owns reminder eligibility, the durable in-application reminder-due attention projection, browser notification delivery attempts while the Linux/browser application is open, and Android local-notification scheduling/reconciliation. Browser delivery uses a small service worker plus `ServiceWorkerRegistration.showNotification()`; Android uses the governed native local-notification adapter. The browser/Android OS owns permission and actual delivery. Scheduling and delivered/displayed outcomes are never conflated. Jig has no reminder Toast fallback, push service, remote reminder scheduler or canonical notification-delivery state.

## UI and design-system boundary

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
- Planner is default/Home and there is no SideNav. The desktop AppShell top region remains a three-zone Jig composition: Jig Home at left, one centered inline temporal group `Previous · compact week range · Next · Today`, and Add task + adjacent Planner/History/Settings navigation + synchronization state at right. Planner temporal state is displayed-week-only; dates are not selectable. v1.1 narrow/mobile uses **one sticky header region with two rows on Planner**: an application row containing the complete Jig wordmark, Planner-only Add task, compact synchronization state and the compact hamburger menu; and a temporal row containing Previous, compact week range, Next and Today. History/Settings render only the sticky application row and do not render Planner-only Add. The hamburger uses the existing Astryx public compact `DropdownMenu`/`Popover` mechanics and the one typed Planner/History/Settings destination owner; it is never a drawer, SideNav or navigation rail. The seven desktop Planner tracks remain fluid with a 160px product-level minimum; opening the Task Drawer overlays rather than reflows/narrows the board.
- Reduced chrome remains governed: Planner date tracks are open layout tracks, not boxed panels. Prefer whitespace and at most hairline separation; Task cards are the primary discrete surfaces and use restrained border/elevation. Desktop header remains <=44px (2.75rem). **The old narrow <=56px total-header budget is superseded by v1.1**: the narrow header is content-height and sticky, with each primary interaction row at least 44 CSS px and safe-area inset owned at the header. Do not use absolute positioning, negative offsets or private Astryx selectors to recreate the old envelope. Use semantic iconography without replacing accessible text/labels for essential meaning. Astryx's public icon registry is the one reusable icon system; missing Jig-specific meanings use Astryx namespaced extension keys rather than raw Unicode stand-ins or another icon library.
- v1.0.5 application composition is full-bleed: zero application-shell/page-level margin and padding on all four viewport edges at desktop and narrow widths; no outer content-frame border/radius/background panel; header and Planner run edge-to-edge. Internal component padding remains owned by the semantic component. Removing the former 48px desktop outer inset moves the governed responsive breakpoint to 73rem / 1168px.
- v1.0.6 secondary-screen geometry: the application frame and Planner remain full-bleed, while History and Settings continuously own one centered 50rem/approximately 800px maximum content measure. When less than 50rem is available, those screens naturally consume the full available width. Do not remove the cap at the 73rem Planner breakpoint, introduce a second width breakpoint, or reintroduce a global/AppShell max-width.
- v1.0.6 appearance has exactly two independent browser-local presentation choices: one of the 13 governed Theme presets and one of `System | Light | Dark`. The root Astryx `Theme` is the only runtime owner. System follows platform color preference through Astryx; do not add a second JavaScript color-mode engine. Theme/appearance controls exist only in Settings → Appearance and never mutate Task, Planner, draft, persistence, protocol or Git state.
- Product-state color is governed by the v1.0.6 semantic contract in `docs/architecture/technical-solution.md` JIG-106-SD-04 and `docs/design/brand-and-theme.md`. Jig-owned states consume named product aliases/Astryx semantic roles and feature CSS never branches on theme name or embeds theme palette literals. Literal Jig hue descriptions apply only to the default Jig palette; all themes must preserve semantic role, state precedence and non-color meaning.
- The in-application header wordmark uses one canonical inline Jig geometry whose foreground/accent paints consume active-theme semantic roles. Do not restore Light/Dark fixed-color image switching for application chrome. Fixed favicon/app/README/release assets remain separate theme-independent brand artifacts.
- Planner Task click/tap selects and opens the editable Task workspace; it never moves the Task. v1.1 direct movement/reordering on desktop and narrow/mobile has one `@hello-pangea/dnd` owner in `ui/src/drag.tsx`. Each dated Task list is one droppable and each incomplete Task is one draggable, but **only the dedicated visible grip is the drag activator**. The rest of the card remains reliable for Task open/select, checkbox, action menu, references and touch scrolling. Dragging exposes one exact insertion indicator whose destination date/index is the same value committed by the canonical move command; inter-card whitespace must retain stable insertion intent, empty dates have one unambiguous index-0 target, and cancel/outside drop is a no-op. Canonical Task order is not mutated before drop. Editing the scheduled date remains the explicit non-drag reschedule path and same-day Move up/Move down remains the non-drag ordering alternative. Global Add task derives the current local weekday inside the displayed week; each date header uses the full weekday name and day number (for example `Thursday 19`) with one compact `+` beside it for explicit date-specific Add. There is no bottom-of-lane Add action. Both Add routes show the same full field surface as an existing Task, and desktop lane height is content-driven rather than equalized.
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
- At an external-system integration boundary, preserve the authoritative system's protocol/configuration terminology for fields and concepts. Jig may classify how that material is handled, but must not rename the external concern into a parallel Jig vocabulary. For GitHub App OAuth this means retaining `client_id`, `client_secret` and `redirect_uri` exactly; the fact that a public/native client's `client_secret` is non-confidential registration material does not change its GitHub name.

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
