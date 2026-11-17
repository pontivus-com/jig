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

The installer must know the target repository. It may receive either an existing local repository path (`--repo`) or a repository URL plus checkout destination (`--repo-url` + `--checkout`). URL mode is only a thin convenience wrapper around Git clone and must converge immediately to the same existing-checkout installation path. If the selected repository already contains valid Jig portable data, installation adopts it. Repository continuity between machines/checkouts is provided by Git; Jig does not copy/migrate one repository into another.

## Other external-system boundaries

Apply the same rule beyond Git:

- **systemd / OS:** Jig may install/start its own user service. It must not change administrator/session policy such as linger or manage unrelated services.
- **Browser:** Jig may open its local UI and use browser capabilities required by the product. It does not manage the browser or duplicate browser/OS policy.
- **Filesystem:** Jig owns its application files and Jig data paths only. It is not a general filesystem migration/provisioning tool.
- **External project systems:** Jig stores references to authoritative work. It does not copy their domain models, lifecycle, or source content.
- **Notifications:** Jig owns the in-app reminder behavior. Browser/OS notification infrastructure remains externally owned.

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
- Custom Jig theme authoring lives in `ui/src/jig-theme.source.ts` and must be compiled with the pinned Astryx CLI into committed `jig.js` / `jig.css` artifacts. Runtime code consumes those generated artifacts. Jig-authored code must not synthesize Astryx compiler/runtime markers such as `__built`, hand-edit generated theme files, or replace `astryx theme build` with an application-owned compiler path. CI must keep `theme build --check` green.
- Do not add an application-owned high-priority cascade layer, `!important`, or increasingly specific selectors to override Astryx internals. Preserve Astryx's published stylesheet/theme ordering, then style Jig-owned elements through ordinary scoped rules and supported public component props.
- Do not use CSS hiding, offsets or absolute positioning to transform the wrong semantic DOM hierarchy into a materially different desktop/mobile hierarchy. At Jig's one semantic breakpoint, render the correct composition while preserving shared application state. CSS media queries may handle pure reflow/density only.
- Hard-coded dimensions are permitted only for governed structural budgets such as the application inset, seven Planner tracks (160px minimum), the derived 76rem desktop/narrow composition boundary, Settings split and reference mobile frame. Interior spacing, sizing and typography use Astryx public tokens/component APIs unless the governed reference establishes a real product-level dimension.
- Each layout property has one owner. Remove obsolete rules when composition changes; do not stack later overrides on top of earlier rules to cancel them.
- Task selection is contextual editable presentation state: selecting a Task must not change the active destination and opens the full editable Task form directly. The governed Task workspace owns only existing-Task draft/create-draft state; desktop Planner/History render it through the public Astryx non-modal right Drawer and narrow/mobile renders the same state through the public Astryx non-modal BottomSheet rising from the bottom. There is no read-only view→edit indirection, centered/fullscreen Task editor, or separate move-to-date workspace. Permanent Delete confirmation remains the only blocking Task dialog.
- Planner is default/Home and there is no SideNav. The desktop AppShell top region is a three-zone Jig composition: Jig Home at left, the active week range centered above grouped Previous/Today/Next controls, and Add task + adjacent Planner/History/Settings navigation + synchronization state at right. Planner temporal state is displayed-week-only; dates are not selectable. Narrow/mobile uses Jig/sync/hamburger, the same centered temporal controls, seven vertically stacked dated sections, and a BottomSheet workspace. The hamburger is a compact menu/popover rendering the same Planner/History/Settings destination set as desktop from one typed semantic owner, never a side drawer. The seven desktop Planner tracks are fluid with a 160px product-level minimum; opening the Task Drawer must overlay rather than reflow/narrow the board.
- Reduced chrome is a governed v1.0.4 requirement: Planner date tracks are open layout tracks, not boxed panels. Prefer whitespace and at most hairline separation; Task cards are the primary discrete surfaces and use restrained border/elevation. Use semantic iconography for actions/status/metadata where useful, without replacing accessible text/labels for essential meaning. Astryx's public icon registry is the one reusable icon system; missing Jig-specific meanings use Astryx namespaced extension keys rather than raw Unicode stand-ins or another icon library.
- Product-state color is governed by `docs/design/brand-and-theme.md` §§6.2–6.4. Jig-owned persistent states must consume the named theme aliases there; do not use generic `--color-accent` / `--color-accent-muted` as a substitute for selected Task, today, active navigation, priority or status semantics. Astryx button/form variants keep their public semantic ownership.
- Planner Task click/tap selects and opens the editable Task workspace; it never moves the Task. Direct movement/reordering on desktop and narrow/mobile has one dnd-kit owner: the Astryx Task row is always the sortable element, every dated section is always one droppable, and the non-interactive card body is the public handle/activator. Pointer activation is input-aware: mouse/pen use a short distance threshold and touch uses a deliberate delay/tolerance so scrolling and drag remain distinct. Checkbox/menu/reference controls remain outside the activator. Editing the scheduled date is the explicit non-drag reschedule path. Same-day Move up/Move down remains the non-drag ordering alternative. Global Add task derives the current local weekday inside the displayed week; each date header uses the full weekday name and day number (for example `Thursday 19`) with one compact `+` beside it for explicit date-specific Add. There is no bottom-of-lane Add action. Both Add routes show the same full field surface as an existing Task, and desktop lane height is content-driven rather than equalized.
- If the pinned Astryx public API cannot satisfy a governed requirement, first prove and document the incompatibility. Then use the smallest Jig-owned semantic composition built from Astryx public leaves/tokens. Do not solve the problem by reaching into Astryx internals or adding another UI/styling framework.

## Architecture discipline

- Product definition is the highest authority for scope.
- Functional requirements define observable Jig behavior and must not add product responsibilities.
- Technical design selects the minimum implementation that satisfies those requirements and must not promote external-system mechanics into product/application responsibilities.
- Implementation plans cannot use an earlier technical choice as justification for new scope.
- Prefer deleting or collapsing unnecessary machinery over hardening an abstraction Jig should not own.
- Maintain one canonical Task model and one local persistence authority.
- Preserve the functional-core/imperative-shell dependency direction: pure Task/planning rules in `src/core`; SQLite/HTTP/Git/process/filesystem I/O in `src/shell`; browser presentation state in `ui/src`. UI/shell code must not duplicate core planning semantics.
- TypeScript strictness is architectural. Do not add `any`, double casts, non-null assertions, or unchecked type assertions to silence the compiler. Untyped external data must be narrowed/validated at the smallest boundary; justified third-party interop assertions stay local to that adapter.
- Apply DRY at the semantic-owner level: one state/algorithm/mapping for one meaning. Consolidate duplicate Planner sequence rendering, status mapping, date-header behavior and command construction rather than maintaining responsive or destination-specific copies.
- Do not introduce DTO/mapping hierarchies, service/repository class stacks, workflow frameworks, or parallel semantic owners without a demonstrated requirement.

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
