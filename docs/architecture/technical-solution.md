# Jig — technical solution design

**Status:** Canonical technical solution through v1.1, amended 2026-11-19. v1.0.6 remains historical release provenance; JIG-110-SD-01..41 in the release-specific v1.1 solution govern v1.1 implementation.
**Concern owner:** Jig architecture, canonical task representation, persistence, repository integration boundary, UI realization, operation admission, and verification.
**Governing documents:** [Product definition](../product/product-definition.md) and [Planning workbench functional design](../requirements/planning-workbench.md), especially JIG-103-FR-01 through JIG-103-FR-17, JIG-104-FR-01 through JIG-104-FR-16, JIG-105-FR-01 through JIG-105-FR-11, JIG-106-FR-01 through JIG-106-FR-07 and JIG-FR-01 through JIG-FR-22.
**Historical v1.0.6-and-earlier scope:** One-script Linux user installation, user-selected personal Git repository as the entire planning-data home, always-available local service, background Git commit/synchronization, responsive desktop UI, no hosted Jig service. **Current v1.1 scope is defined by `## v1.1 binding architecture` and JIG-110-SD-01..41 below; those contracts add the governed Android runtime, bootstrap/onboarding, native reminder path and cross-installation continuity while preserving the no-hosted-Jig-service boundary.**

**Foundational authority rule:** For every external integration, identify the authoritative owner first. Jig implements only the minimum interface needed for Jig's product job and must not absorb that external system's configuration, topology, provisioning, migration, reconciliation or policy. For Git specifically, Jig owns deterministic Jig records, automatic synchronization intent and coarse sync outcome; Git owns repository acquisition, branches/refs/worktrees, signing/identity, credentials, remotes, history and reconciliation. A Git isolation technique may exist inside the adapter, but it is not Jig domain, user workflow or configuration.

## 1. v1.0.x decisions, baseline and user experience — historical where v1.1 supersedes

**Historical-baseline rule:** Sections 1–11 retain the released v1.0.x architecture as provenance. For v1.1 forward implementation, `## v1.1 binding architecture` and the linked JIG-110-SD-01..41 contracts supersede every conflicting v1.0.x statement in these sections, including repository-required startup, browser-only notification delivery, one-row/56px narrow-header assumptions, whole-card drag activation and deferred standalone phone installation.

Jig is a date-based personal planner, not a project manager or an Order lifecycle client. **The user chooses an existing personal or organizational Git repository during installation. All authoritative planning data, including the live SQLite database, lives under a dedicated directory inside that selected repository.** The public pontivus-com/jig source code repository contains no personal data and is not a valid default data target.

The normal experience is: run one installer; assign repository; installer configures local application/runtime, a Git-managed data area, the `jig` command and a Linux user service; thereafter `jig` opens the planner or starts its service, saves happen immediately in SQLite, and the repository integration boundary exports and synchronizes deterministic records without interaction in the normal case. User Task operations are never blocked on repository transport. Any repository synchronization failure retains local work and is surfaced only as an operational sync issue; the planning/domain layers never model Git branch topology, divergence, merge bases or conflict reconciliation.

**Authoritative product requirements:** [JIG-FR-01–22](../requirements/planning-workbench.md). This document makes the following technical selections:

| Area | Chosen solution |
|---|---|
| Runtime and service | One Bun 1.4.4 process on Linux, `systemd --user` service, loopback HTTP, no external database or remote service |
| Command and installer | `jig` launcher in ~/.local/bin; `scripts/install.sh --repo /absolute/existing/repo` or `--repo-url URL --checkout /new/empty/path`. URL mode delegates acquisition to Git and then converges on the same selected-checkout installation path. |
| UI | React 19.3.1, TypeScript 7.0.2, Vite 8.3.5; pinned Astryx 0.7.13 with one root Theme owner, one typed 13-preset theme registry and one independent System/Light/Dark mode; one Planner destination, Jig-owned responsive top-header composition inside AppShell, desktop right Drawer and narrow BottomSheet for the one Task workspace |
| Cross-day drag | `@dnd-kit/react@0.5.3` + public sensor primitives from direct-pinned `@dnd-kit/dom@0.5.3`; one React-owned drag model across desktop and narrow/mobile; optimistic DOM sorting suppressed; Astryx handles visual primitives |
| Live data | One Bun SQLite database at `<selected-repo>/.jig/local/jig.sqlite`; immediate transactional writes |
| Versioned data | Deterministic Task JSON and manifest synchronized through Git inside the selected repository. The adapter may use an isolated Git namespace internally, but branch/ref/worktree lifecycle is an implementation detail confined to that adapter rather than Jig application state or user configuration. |
| Repository sync boundary | Daemon automatically debounces Jig-record export and invokes a thin Git adapter. The adapter is responsible only for synchronizing Jig-owned portable data without touching unrelated repository content and returns coarse synchronization outcomes plus validated Jig snapshots; Git topology, policy, credentials and reconciliation remain external. |
| Notifications | One browser-side reminder monitor and one delivery channel: browser/OS Notification while Jig is open and permission is granted, independent of page visibility/focus; no in-app reminder toast and no closed-app/service-worker/push guarantee |
| Mobile | Narrow mobile-first layout and touch accessibility in desktop web UI; standalone phone installation deferred |

The selected repository's ordinary working state, staged files and unrelated content are **never** touched by Jig's automatic synchronization. The adapter must provide this isolation using the smallest Git mechanism that satisfies the requirement; the application must not model or manage that mechanism outside the adapter.

This is an architecture contract; actual interaction, installation, repository-adapter behavior and resource use still need verification against the exact pinned environment. No unresolved technology choice may be delegated casually to implementers.

## 2. Dependency contract and provenance

The initial dependency set is exact-pinned; no wholesale Order package manifest is copied.

**Production:** react 19.3.1; react-dom 19.3.1; @astryxdesign/core 0.7.13; @astryxdesign/theme-neutral 0.7.13; @astryxdesign/theme-butter 0.7.13; @astryxdesign/theme-chocolate 0.7.13; @astryxdesign/theme-matcha 0.7.13; @astryxdesign/theme-stone 0.7.13; @astryxdesign/theme-y2k 0.7.13; @stylexjs/stylex 0.19.1 (Astryx peer); @dnd-kit/react@0.5.3; @dnd-kit/dom@0.5.3 only for the public PointerSensor activation-constraint API used by the same drag owner.

**Development:** typescript 7.0.2; vite 8.3.5; @types/react 19.3.0; @types/react-dom 19.3.0; @types/bun 1.4.4; vitest 5.0.5; @playwright/test 1.64.1. Use Bun 1.4.4 as the installed runtime; pin it in repository runtime metadata. The exact baseline is a reproducibility selection, not a claim that later packages are incompatible.

Use Bun built-ins for SQLite and spawning Git. Do not add an ORM, repository object abstraction, task mapper/DTO layer, date utility package, notification service, state-management framework, CodeMirror, OpenCode SDK, Tailwind build integration, a StyleX compiler plugin or a second UI toolkit without demonstrated necessity. Astryx's published core and full application-theme packages are the reusable styling authority. Jig owns only: (a) its default Jig palette/theme; (b) thin Jig wrappers around the six pinned dual-mode Astryx themes so every preset receives the same Jig product-local semantic aliases; and (c) six community palette themes compiled through the same Astryx `defineTheme`/CLI path. Community themes are color adaptations over Astryx Neutral component/typography/icon mechanics, not parallel UI systems. Raw community palette values may exist only in governed theme-authoring sources with provenance; feature CSS consumes semantic tokens only.

**Verified references:**
- [Order manifest](https://github.com/pontivus-com/order/blob/master/package.json), [runtime pin](https://github.com/pontivus-com/order/blob/master/.bun-version), [application composition](https://github.com/pontivus-com/order/blob/master/ui/src/app.tsx), [UI imports](https://github.com/pontivus-com/order/blob/master/ui/src/styles.css), [theme](https://github.com/pontivus-com/order/blob/master/ui/src/theme.css), [settings composition](https://github.com/pontivus-com/order/blob/master/ui/src/SettingsWorkspace.tsx), [action wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchAction.tsx), [confirmation wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchConfirmation.tsx), and [notice wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchNotice.tsx).
- [Pinned Astryx core package](https://github.com/meta/astryx/blob/v0.7.13/packages/core/package.json), [AppShell](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/AppShell/index.ts), [List](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/List/List.doc.mjs), [Button](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Button/index.ts), [IconButton](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/IconButton/index.ts), [Drawer](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Drawer/index.ts), [BottomSheet](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/BottomSheet/index.ts), [DropdownMenu](https://github.com/meta/astryx/tree/v0.7.13/packages/core/src/DropdownMenu), [Popover](https://github.com/meta/astryx/tree/v0.7.13/packages/core/src/Popover), [Dialog](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Dialog/index.ts), [FormLayout](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/FormLayout/index.ts), [TextInput](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TextInput/index.ts), [TextArea](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TextArea/index.ts), [Selector](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Selector/index.ts), [CheckboxInput](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/CheckboxInput/index.ts), [Link](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Link/index.ts), [SegmentedControl](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/SegmentedControl/index.ts), [Toast](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Toast/index.ts), [date input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/DateInput/index.ts), and [time input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TimeInput/index.ts).
- [dnd-kit React quickstart](https://dndkit.com/react/quickstart/), [sensor configuration guide](https://dndkit.com/react/guides/sensors/) and [multiple-sortable-lists guide](https://dndkit.com/react/guides/multiple-sortable-lists/). The installed/pinned `@dnd-kit/react@0.5.3` and `@dnd-kit/dom@0.5.3` TypeScript APIs are the implementation authority if the unversioned website differs.
- [Bun SQLite API](https://bun.com/docs/runtime/sqlite) and ordinary Git CLI documentation. Git mechanics remain confined to the repository adapter and do not define Task/domain behavior.

### 2.1 Implementation source map

Use the sources below to avoid rediscovery, while preserving Jig's own domain and architecture. **Order is implementation evidence, not a library dependency.** Do not copy Order's WorkItem domain, React Query state architecture, private `Workbench*` component layer, CSS class namespace, or workflow semantics into Jig.

| Jig concern | First implementation source to inspect | What to reuse / learn | What not to copy |
|---|---|---|---|
| Runtime and dependency pins | Order `package.json`, `.bun-version` | Proven React/TypeScript/Vite/Bun/Astryx versions and peer requirements | Order-only packages such as OpenCode, CodeMirror, React Query and Tailwind |
| Astryx CSS/bootstrap | Order `ui/src/styles.css` | Required Astryx reset/core import ordering and semantic body-token usage | Order CSS classes and Tailwind layers; Jig uses only the minimum stylesheet required by its own composition |
| Theme family + System/Light/Dark mechanics | Pinned Astryx `defineTheme`/`Theme` APIs first; Order `ui/src/app.tsx` only as secondary integration evidence | One root Theme owner, local presentation persistence, independent theme-family and mode selection, System fallback and semantic-token switching | Order-specific color literals, preference keys, WorkItem state or toolbar composition; do not add a second Jig theme engine |
| Buttons/actions | Order `WorkbenchAction.tsx` + Astryx Button/IconButton public APIs | Exact public props/variants and accessible icon-button labeling | The `WorkbenchAction` wrapper itself |
| Destructive confirmation | Order `WorkbenchConfirmation.tsx` as behavior evidence plus Astryx destructive-dialog API | Modal confirmation semantics, destructive action tone, pending protection | The Order wrapper or repository-disconnect semantics; Jig confirmation owns Task deletion only |
| Persistent feedback/status | Order `WorkbenchNotice.tsx`, Settings composition + Astryx Banner | Durable failure/status presentation through semantic Astryx surfaces | Order readiness/blocker model; reminder delivery is browser Notification and must not be reintroduced as Toast |
| Form/editor fields | Order `SettingsWorkspace.tsx` + Astryx TextInput/TextArea/Selector/DateInput/TimeInput/FormLayout | Direct controlled-field usage, labels, validation surface and public component APIs | Order repository/model settings domain |
| Appearance settings | Astryx Selector + SegmentedControl | Selector for the 13 theme-family choices; SegmentedControl for exactly `System | Light | Dark`; both live only in Settings → Appearance | Any header/Planner quick toggle, duplicate theme list or combined `theme-mode` flat option set |
| Planner rows/date headers | Astryx List/ListItem, Button and IconButton docs | Compact row semantics, focus, date-header actions and accessible labels | Astryx `createReorderable` on Jig task rows; dnd-kit is the single drag owner |
| Planner application header | Astryx AppShell topNav slot plus Layout/Stack/Button/IconButton/DropdownMenu or Popover | Reusable control mechanics, focus and menu behavior | SideNav, AppShell auto mobile drawer, or a second application shell; Jig owns the product-specific three-zone header geometry |
| Completion | Astryx CheckboxInput | Accessible explicit completion control | Any Order lifecycle/status transition semantics |
| Reference action | Astryx Link/Button | Safe open/copy affordance | Automatic dereferencing or project-content import |
| Community theme palettes | Canonical upstream Gruvbox, Dracula, Solarized, Nord, Catppuccin and Tokyo Night palette specifications listed in JIG-106-SD-02 | Copy reviewed palette constants once into Jig theme-authoring sources, record provenance/license, then map them into Astryx semantics | Runtime fetching, editor-plugin code, syntax-theme packages, arbitrary user theme loading or a palette marketplace |
| Cross-date drag | Pinned `@dnd-kit/react@0.5.3` plus `@dnd-kit/dom@0.5.3` public PointerSensor constraints, then dnd-kit guides | One provider, sortable Task-card element as the pointer source, interactive-descendant exclusion, dated droppables, drag overlay, input-aware activation threshold and exact destination index | A second reorder system, custom pointer-state subsystem, title/body-only drag handle or priority-derived drop position |
| SQLite | Bun 1.4.4 SQLite API | Prepared statements, explicit transactions and WAL behavior used by the schema in §4.3 | ORM/repository abstraction |
| Git integration | Standard Git CLI through Bun argument-array subprocess | the minimum scoped operations required to synchronize Jig-owned portable records while leaving unrelated repository state untouched | repository provisioning, user Git policy/configuration, topology management, reconciliation, Git libraries, shell interpolation or Jig-level merge/conflict workflow |
| HTTP/service | Bun 1.4.4 runtime APIs + §3.2 of this document | Loopback serving, static UI, canonical command admission and write-token checks | A second transport model, external server framework or DTO layer |

When the source map and this document differ, **this document wins for Jig semantics**. The upstream source is consulted to learn a proven API/integration pattern, not to import its product decisions. If a pinned upstream API does not match the cited example, make the smallest Jig-local adjustment and record the verified API difference; do not redesign the architecture or introduce another dependency.

## 3. Runtime, process ownership and configuration

~~~text
Jig application source/distribution  (separate from personal planning repo)
    install.sh --> ~/.local/share/jig/      binaries + built static UI
               --> ~/.config/jig/config     selected repository path + local HTTP port
               --> ~/.local/bin/jig         desktop launcher
               --> systemd --user jig       persistent low-idle Bun process
                                |
 Browser (loopback)  <-----------+------->  Bun HTTP + functional core
 React / Astryx / dnd-kit                         |
 Browser reminder monitor (Notification only)    v
                                selected PERSONAL Git repository
                                <repo>/.jig/
                                   local/jig.sqlite      operational authority
                                   portable/              conceptual Jig-owned portable records
                                     format.json
                                     tasks/<uuid>.json
                                         |
                                   thin Git repository adapter
                                         |
                                   repository's normal Git configuration
~~~

The application binary and runtime may be installed under normal user application directories; **all task data and recoverable canonical planning records must be inside the configured Git repository**. The local service keeps only its own noncanonical logs and launch configuration outside that repository. Do not install the program into or modify the public source checkout when it is not the selected personal target.

**Functional core:** Typed pure operations for task creation, edit/date and ordering rules, move, daily rollover, completion, reopening and deletion; no I/O, SQL or presentation dependencies. **Imperative shell:** one SQLite owner, one repository synchronization adapter, one HTTP admission boundary, startup/installer orchestration and browser reminder presentation. No DTO layer, services/repositories hierarchy, event bus, workflow framework, second task authority or browser persistent task cache.

### 3.0.1 Architecture compliance invariants

These invariants are binding on **every** v1.0.4 implementation task; architecture compliance is not a cleanup phase that may be deferred until the end.

- **Functional core:** Task/planning semantics and reusable calendar/order transforms are pure typed functions. `src/core/**` must not import UI, HTTP, SQLite, Git, browser, filesystem or process APIs.
- **Imperative shell:** SQLite, HTTP, Git, filesystem, process lifecycle and other I/O stay under `src/shell/**`. Shell code invokes the functional core; it does not reimplement Task/planning rules.
- **Presentation boundary:** `ui/src/**` owns browser/UI presentation state and invokes canonical commands. It must not duplicate canonical Task validation, normalization, insertion, ordering, movement or rollover semantics.
- **Canonical types:** there is one canonical `Task`, one canonical `TaskCommand`, one Planner temporal state owner, one Task workspace state owner and one editable Task draft shape. Presentation drafts are permitted because unsaved form state is not canonical domain state, but they must not become a second Task/command model.
- **Strict typing:** repository TypeScript remains `strict` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `useUnknownInCatchVariables`. Do not introduce `any`, double casts, non-null assertions, or `as` assertions merely to silence the compiler.
- **Boundary narrowing:** untyped JSON, SQLite rows and third-party component/ref values enter through the smallest possible parser/guard/adapter. A localized assertion is allowed only when runtime validation or a proven third-party typing limitation makes it sound; the assertion must not leak into product/domain logic. Prefer type guards, discriminated unions, typed library generics and exhaustive switches.
- **Separation of concerns:** parsing/validation, pure domain transitions, persistence, transport and rendering remain separate owners. A UI component may provide friendly required-field feedback, but canonical normalization/validation remains in the functional core.
- **DRY / one semantic owner:** do not maintain duplicate algorithms or state projections for the same meaning. Shared Planner Task-sequence rendering/move-command wiring, date-header composition, status semantics and command construction have one owner each. Reuse pure helpers rather than copy/paste conditionals.
- **No abstraction inflation:** do not introduce DTO/mapping hierarchies, service/repository class stacks, state-management frameworks, workflow engines, command buses or parallel projection models to achieve these corrections.
- **Dependency direction:** core is dependency-free with respect to shell/UI; shell may depend on core; UI may depend on canonical core types/pure helpers and its narrow HTTP adapter, never on SQLite/Git implementation details.

### 3.0.2 Existing compliance breaches that v1.0.4 must close

The correction branch currently contains known architecture violations/inconsistencies. They are part of the v1.0.4 remediation scope and must not survive certification:

1. `ui/src/app.tsx`, `planner.tsx`, `week.tsx`, `planner-list.tsx` and `date-strip.tsx` still maintain the superseded `selectedDate`/date-selection projection in parallel with the final displayed-week-only design.
2. `app.tsx` still owns `view | edit | create` workspace state while `task-workspace.tsx` already exposes `task | create`; this is parallel/incompatible workspace ownership and permits invalid state combinations.
3. Desktop `week.tsx` and narrow `planner-list.tsx` duplicate outstanding-Task row mapping plus Move up/Move down wiring. The final seven-section composition must use one shared sequence renderer/command wiring rather than two semantic implementations.
4. `task-editor.tsx` duplicates canonical optional-text/title normalization before producing `TaskCommand`. UI may perform non-authoritative required-field feedback, but command normalization/validation belongs to the canonical functional core.
5. `task-editor.tsx` and `settings.tsx` use unchecked value assertions for Astryx component output; dnd refs also use direct assertions. Replace ordinary assertions with existing domain type guards or a minimal validated third-party boundary adapter. Any unavoidable ref assertion must be isolated and justified at the dnd/Astryx integration boundary.
6. Core validation currently contains avoidable correlated-value assertions (for example position/optional fields after validation) and `isPriority` narrows through an assertion. Refactor the touched validators to return already-narrowed values without product-logic casts.
7. Repository/HTTP/SQLite boundaries contain several raw-object/row assertions. A runtime-validated object cast may remain only inside the dedicated boundary helper; unsafe patterns such as `object as unknown as Task` are prohibited. Canonical Task import must flow through `validateTask(unknown)`, and SQLite/HTTP parsing must either use typed library generics or validate unknown values before treating them as canonical types.
8. The theme implementation must place Jig-owned `--jig-state-*` aliases in Astryx `defineTheme({ localTokens: ... })`; they are not public Astryx `TokenName` entries and must not be forced into `tokens`.
9. Semantic iconography is owned by Astryx's public icon/semantic icon registry where available. Do not add a second icon package or proliferate Unicode stand-ins for meanings Astryx already exposes.

A repo-wide architecture guard must scan production source for the same violation classes. Any additional actual breach found by that guard is in scope for correction before v1.0.4 is considered implementation-complete; this does not authorize unrelated feature refactoring.

Only one Bun process may write the configured SQLite file. Enforce a single active instance for each configured data root. The process has a serialized, bounded synchronization loop; a browser need not remain open for Git operations. UI state is limited to active destination (`planner | history | settings`), displayed Planner week start, selected Task/workspace draft, transient drag preview, one local `ThemePreset` and one local `AppearanceMode`. There is no selected-day state. Theme family and appearance mode are presentation state only and never part of canonical Task, SQLite, HTTP protocol or Git-synchronized planning data. Planner and History are queries over the same canonical Task set; desktop and narrow Planner compositions are presentations of the same Planner state, not parallel view authorities.

**Local HTTP:** bind only to `127.0.0.1`. The default port is **47831**; `install.sh --port <1024..65535>` is the only supported override and persists the chosen value in local configuration. The HTTP API is `/api/v1`; reads return canonical Task values plus the current SQLite revision, and mutations return success only after the SQLite transaction commits. v1.1 repository status has one structured owner that distinguishes the local Git snapshot from remote synchronization; the compact `Local only | Pending | Retrying | Synced | Sync issue` header label is derived from that structure rather than stored independently. The user can continue editing regardless of either repository state.

**Idle behavior:** One service, no worker farm, no browser needed for task storage/sync, no polling-heavy UI while closed. Coalesce edits into short Git bursts, use a timer/backoff instead of permanent busy loops, and never wake a job per drag animation frame. Resource limits are verified in a real idle/workload test rather than inferred from technology choice.

### 3.1 Installer and executable lifecycle

A **single installer script** `scripts/install.sh` is the canonical entry point. `--repo` names the absolute path of an existing writable local Git repository selected by the user. Alternatively, `--repo-url` plus `--checkout` identifies a repository to obtain through ordinary Git clone semantics into a new/empty checkout; after cloning, the installer must use the exact same selected-checkout setup path as `--repo`. Jig does not invent separate repository lifecycle semantics around URL mode.

The installer must:

1. Verify Linux, Git and writable user application directories. For `--repo`, validate an existing writable Git repository other than Jig's public source checkout. For `--repo-url` + `--checkout`, require a new/empty destination, invoke Git clone using normal Git credentials/configuration, then validate the resulting checkout through the same repository-validation path. Never `git init` an arbitrary directory or overwrite a non-empty checkout.
2. Install/reuse the exact-pinned runtime and certified application payload without requiring root for the ordinary user path.
3. Safely establish `<repo>/.jig/local/` for SQLite/local operational state without modifying unrelated tracked files.
4. Inspect the selected repository for valid existing Jig portable data through the repository adapter. If valid Jig data exists, adopt it and initialize/hydrate local SQLite from that data when no compatible local database exists. If no Jig data exists, initialize a new Jig dataset and allow the adapter to publish its first valid portable snapshot. **The installer must never publish or leave behind an intermediate Git state that Jig itself considers invalid.**
5. Treat Git synchronization setup as an integration step, not as repository management. URL-mode acquisition may delegate a single clone operation to Git, but ambient user Git configuration/policy must not be rewritten. Git signing, identities, credentials, remotes, branch topology and worktree mechanics remain Git concerns; adapter operations must either work within that environment or report a synchronization issue without corrupting installation/local planning state.
6. Save only Jig application configuration (selected repository path and local HTTP port), install the `jig` command, and install/enable/start a `systemd --user` service when available. Otherwise provide the documented foreground fallback.
7. Verify local application readiness, SQLite/task storage, and the ability of the repository adapter to represent/synchronize Jig data. A repository transport problem may be reported as a synchronization issue but must not invalidate an otherwise usable local installation.

`jig` opens the local UI, starting the service on demand if needed. The supported public CLI is `jig`, `jig status`, `jig sync`, `jig serve`, and `jig uninstall`. `jig doctor` may remain only as a small Jig-health diagnostic; it must not expose or repair Git topology. There is no `jig configure --repo` migration workflow. To use another checkout/repository, obtain it through ordinary Git/filesystem tooling and install Jig against that existing repository; valid existing Jig data is adopted automatically.

User-session service availability is guaranteed only while the user's user-service manager is active. Login persistence beyond that (for example linger policy) is administrator/OS configuration and is never silently changed by Jig.

### 3.2 Local configuration and HTTP contract

The local configuration file is **`~/.config/jig/config.json`** and contains only Jig application configuration:

~~~json
{
  "version": 1,
  "repository_path": "/absolute/path/to/selected-repository",
  "http_port": 47831
}
~~~

`repository_path` is the existing repository selected at installation and `http_port` is Jig's loopback port. Git remotes, refs, worktrees, signing, identity and credentials are **not Jig application configuration**; they remain Git repository/user configuration and are discovered/used only inside the thin repository adapter where required. Theme family and appearance mode remain browser-local presentation state.

The browser API serializes canonical core types directly; do not create transport DTO classes or a second Task/command schema.

The v1.1 operational repository status is a shell-owned typed contract, not domain state and not a DTO hierarchy:

~~~ts
type LocalGitSnapshotState = "pending" | "committed" | "issue";

type RemoteGitSynchronization =
  | {
      readonly state: "not-configured";
      readonly remote_name: null;
      readonly remote_location: null;
    }
  | {
      readonly state: "pending" | "retrying" | "synchronized" | "sync-issue";
      readonly remote_name: string;
      readonly remote_location: string;
    };

interface RepositorySynchronizationStatus {
  readonly local_git: LocalGitSnapshotState;
  readonly remote: RemoteGitSynchronization;
}
~~~

`local_git = "committed"` means the current canonical SQLite revision has a corresponding successfully committed Jig portable snapshot at the local `jig-data` ref. A successful local commit remains committed even if the later remote push is pending, retrying or failing. `local_git = "pending"` means the current revision has not yet reached that local Git commit boundary. `local_git = "issue"` is used only when the current export/commit phase itself has failed; a remote transport failure must never downgrade local Git state.

Remote identity is observed from the same Git-selected synchronization remote used by the adapter. The adapter exposes only the selected remote name plus a **credential-free display location** derived from its current push target. Strip userinfo/password/token/query/fragment material and never surface askpass/environment credentials. This value is informational presentation data only: it is not persisted in `JigConfig`, SQLite planning state or portable records. When no unambiguous synchronization remote exists, the remote state is `not-configured`; Jig does not invent or persist one.

Remote `synchronized` is valid only after the current locally committed Jig head has been successfully pushed to the selected remote. If another local mutation becomes current before/while that push completes, the presentation returns to pending rather than claiming the new revision is synchronized. The existing retry/backoff outcomes apply only to the remote stage once a local commit exists.

The compact header repository label is a pure presentation projection of `RepositorySynchronizationStatus`: local Git issue → Sync issue; local Git pending → Pending; committed + no remote → Local only; committed + remote pending/retrying/sync-issue/synchronized → the corresponding Pending/Retrying/Sync issue/Synced label. Settings renders the two constituent facts separately.

- `GET /api/v1/tasks` → `{ revision, tasks }`, where `tasks` is the complete canonical Task set.
- `GET /api/v1/status` → service readiness, selected repository path, and one structured `RepositorySynchronizationStatus` containing local Git snapshot state plus read-only remote identity/synchronization state.
- `GET /api/v1/diagnostics` → sanitized **Jig** health only: service health, SQLite availability/schema version, repository accessibility, portable-format validity and coarse adapter health. It contains no Git topology repair model, credentials, Task content or secrets.
- `POST /api/v1/commands` accepts one canonical Task command plus `expected_revision`.
- `POST /api/v1/sync` requests an immediate synchronization attempt through the existing serialized repository worker and returns HTTP **202** with the current synchronization status.
- There is no repository-migration HTTP endpoint.

The command union is exactly:

~~~text
create { title, scheduled_date, priority?, context?, reference?, note?, reminder_time? }
edit   { task_id, changes: { title?, scheduled_date?, priority?, context?, reference?, note?, reminder_time? } }
move   { task_id, destination_date, destination_index }
complete { task_id }
reopen   { task_id }
delete   { task_id }
~~~

`create` generates ID and timestamps in the shell before invoking the pure core. `edit` with a changed scheduled date uses the priority-assisted insertion rule; `move` is the exact-position drag/keyboard move rule. `complete` supplies the shell's current instant. `delete` is emitted only after UI confirmation; the core does not model the confirmation dialog.

Every Task command first executes the idempotent daily-rollover catch-up against the service's current local civil date, then reads the resulting current SQLite revision, and only then compares the caller's `expected_revision`. If rollover changed the revision, a client still holding yesterday's revision receives HTTP **409** with the new current revision and no requested Task mutation is admitted. If `expected_revision` does not equal the post-rollover current revision, return HTTP **409** with the current revision and make no mutation; the browser refetches canonical state before retrying. Validation errors are **400**, a missing Task is **404**, and an unexpected persistence failure is **500** with no claimed save. Successful create/edit/move/complete/reopen returns `{ revision, task }`; successful delete returns `{ revision, deleted_task_id }`. These are thin HTTP envelopes around canonical values, not independent domain models.

The operational endpoints are shell admission only, not a second domain command model. `/sync` calls the one existing sync-worker trigger. Do not duplicate synchronization implementation in the HTTP layer.

At service start generate a fresh **256-bit random write token**. Inject it into the same-origin served application bootstrap and require it as `X-Jig-Write-Token` on **every state-changing POST endpoint** (`/commands`, `/sync`) together with `Content-Type: application/json`. Reject missing/incorrect token, cross-origin mutation requests and all permissive CORS. The token lives only for that service process, is never written to configuration, logs, SQLite or Git, and is regenerated on restart.

## 4. Canonical Task model

One Task is the sole durable representation of one intended occurrence. Planner and History are queries/views of canonical Tasks; completed Tasks are excluded from Planner and queried through History. Recurrence does not introduce virtual Task rows: a bounded recurrence series owns only the repeat rule, while every actual occurrence is an ordinary Task. Store the Task fields below in SQLite and the portable JSON files.

| Field | Type / constraint | Semantic ownership |
|---|---|---|
| id | UUID string, immutable | Task identity across dates, restarts and Git exchange |
| title | non-empty trimmed string | Work intention |
| scheduled_date | ISO local civil date YYYY-MM-DD | Scheduled calendar date, independent of completion |
| position | zero-based integer while outstanding; null when complete | Explicit order among outstanding tasks on one date |
| priority | HIGH / NORMAL / LOW, default NORMAL | Initial insertion suggestion and modest display emphasis |
| context | optional short string | Project/activity label, not project schema |
| reference | optional string | External URL/path/repository locator only |
| note | optional string | Brief personal context, not authoritative requirements |
| reminder_time | optional local HH:mm | Alert time on scheduled_date, not a time estimate |
| recurrence_series_id | null or UUID | Optional recurrence-series membership; null for one-off Tasks |
| recurrence_occurrence_date | null or ISO local civil date | Immutable recurrence slot; remains unchanged if the Task is later rolled or manually rescheduled |
| completed_at | null or UTC ISO instant | Null = outstanding; otherwise completed |
| created_at | UTC ISO instant | Historical creation time |
| updated_at | UTC ISO instant | Last committed change time |

There is **no persisted WorkItem, Day, Week, Board, project workflow, task status enum, scheduled duration, time estimate, completion-history duplicate, carry-over flag, deletion tombstone, or separate ordering authority**. A deleted Task ceases to exist in the current dataset rather than entering another lifecycle state. An outstanding task is precisely one with completed_at = null. Its position is non-null. A completed task has completed_at non-null and position null. Reopening preserves id and scheduled_date but clears completed_at and assigns the end position for that date.

A task's scheduled civil date is stable across devices and must not be recalculated from UTC. The browser's current local calendar determines “today.” A reminder is a local clock indication for the device using Jig, not a guaranteed cross-timezone event at one globally fixed instant. Actual completion instants remain UTC; the history groups those instants by the viewing device's local calendar date.

Task references are treated as data: safe http(s) links may open with normal browser navigation; other paths/locators are copied rather than executed. No reference dereferencing, shell interpolation, repository scanning or automatic Order integration.

### 4.1 Invariants

1. Every task has a stable unique ID and exactly one scheduled_date.
2. Within a date, outstanding positions form exactly 0..N-1 with no duplicates or gaps; completed tasks have no active position.
3. The user-selected sequence is authoritative; priority updates never reorder it.
4. Date moves preserve all task metadata and identity except scheduled_date and position; reminder_time stays the same and is interpreted on the new date.
5. Completion records an instant and removes the item from its outstanding sequence; reopening appends it, rather than guessing its former position.
6. Daily rollover is an automatic canonical mutation. Every outstanding Task with `scheduled_date < current_local_date` is moved to `current_local_date`; completed Tasks are unchanged.
7. A confirmed deletion removes the Task row entirely. If the deleted Task was outstanding, the remaining positions on its scheduled date are compacted transactionally; completed deletion requires no active-order compaction.
8. Deletion creates no tombstone, deleted status, trash record or application-level undo history.
9. A failed mutation leaves all affected dates unchanged; UI reports failure without implying a save.
10. Every imported complete snapshot passes the same invariants before it can replace local state; after validation, its Task membership is authoritative for that adopted snapshot.
11. `recurrence_series_id` and `recurrence_occurrence_date` are either both null or both non-null. A recurring occurrence's `recurrence_occurrence_date` is immutable even when `scheduled_date` changes through rollover or explicit movement.
12. Recurrence never changes ordinary Task semantics: each materialized occurrence is an independent Task and owns its own title, priority, context, reference, note, reminder, scheduled date/position and completion state. A recurrence rule determines series calendar slots only.
13. Recurrence has exactly two write scopes. Occurrence-scope commands may mutate only the addressed Task. Series-scope recurrence commands may mutate only the shared `RecurrenceSeries` plus series membership by retaining/removing/creating occurrence rows; they must not rewrite ordinary Task fields on a retained sibling. There is no bulk Task-content propagation command in v1.1.

### 4.2 Operation algorithms

**Create:** Validate title and date; default priority NORMAL. Find the last existing outstanding task on that date whose priority is equal to or higher than the new item's priority; insert immediately after it, otherwise insert at index 0. Preserve all existing items' relative order; renumber only the affected day. Example: HIGH=3, NORMAL=2, LOW=1, find the last item with score >= new score. This is exactly the functional specification's insertion law even in a manually mixed list.

**Explicit drag movement:** Remove ID from source sequence; insert at the indicated target index in target date; when source=target, index means the position in the list **after removal**. Renumber the affected one or two dates. Drag target date and position must be explicit, not derived from priority. Moving to a date using the date editor applies the priority-based initial insertion law instead of a drag-index rule.

**Edit:** Title, note, reference, context, priority or reminder edit keeps date and position unchanged. An explicit date edit removes the task from its original outstanding sequence and inserts into the destination via priority law. Editing a completed task's date preserves completed_at and leaves it outside active ordering.

**Complete:** Set completed_at using the shell's current instant; set position to null and compact the remaining outstanding sequence. No attempt is made to complete the referenced work in Order or any project.

**Reopen:** Clear completed_at; keep scheduled_date, priority and reference; append at the end of the outstanding sequence. No completion history event log is required in v1.

**Delete:** Only after explicit UI confirmation, delete the Task in one SQLite transaction. For an outstanding Task, remove it and compact the remaining positions on its scheduled date to 0..N-1; for a completed Task, delete it without active-order compaction. Increment the normal durable revision. Do not write deleted_at, a tombstone, trash row or delete-event log. Git history, if an earlier export exists, is the only recovery mechanism.

**Read:** Planner derives seven consecutive local civil dates beginning Monday from `displayedWeekStart`. Desktop renders all seven outstanding sequences as columns; narrow/mobile renders the same seven outstanding sequences as vertically stacked dated sections. There is no selected-day projection or selector. Before normal planning reads/commands, the service ensures daily rollover is current, so overdue outstanding Tasks have already been moved into the current local date and are visible in the same canonical Planner bucket on every responsive composition. History is grouped by local completion date. Date/week navigation is presentation state and never writes Task data.

### 4.2.1 Bounded recurrence series

Recurrence is a pure planning-core capability, not a background scheduler and not a second Task model. The recurrence configuration itself has **one canonical series owner**. Tasks carry only the series link + immutable occurrence slot; weekly/monthly pattern/end-date values are never copied into each Task row.

Canonical types are intentionally small:

~~~ts
type Weekday =
  | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type RecurrencePattern =
  | {
      readonly kind: "weekly";
      readonly interval_weeks: number;
      readonly weekdays: readonly Weekday[];
    }
  | {
      readonly kind: "monthly";
      readonly day_of_month: number;
    };

interface RecurrenceSeries {
  readonly id: string;
  readonly effective_from: string;
  readonly end_date: string;
  readonly pattern: RecurrencePattern;
  readonly created_at: string;
  readonly updated_at: string;
}
~~~

Validation is exact:

- `effective_from` and `end_date` are valid local civil dates and `end_date >= effective_from`;
- weekly `interval_weeks` is a positive whole number and `weekdays` is non-empty, unique and canonical Monday→Sunday order;
- monthly `day_of_month` is an integer `1..31`;
- every series is finite; there is no null/unbounded end date.

One pure owner enumerates recurrence dates. The seed Task itself is retained as the first occurrence. Additional dates are strictly after the seed/effective date and no later than the inclusive end date.

**Weekly:** the local Monday-based week containing `effective_from` is recurrence week zero. Active weeks are every `interval_weeks`; selected weekdays inside active weeks produce occurrences. Selecting all seven weekdays is the daily pattern. A four-week interval with one selected weekday is the governed "every four weeks" case.

**Monthly:** each later month contributes the configured `day_of_month` only when that civil date exists. A day-31 series therefore skips February/April/etc.; it is never silently clamped to month-end.

Because every recurrence has a required finite end date, v1.1 **materializes the complete bounded occurrence set transactionally**. It does not create virtual Planner rows, a lazy recurrence daemon, a device-local recurrence cache or a second recurrence scheduler. This keeps Linux and Android on one canonical Task set and keeps portable Git snapshots deterministic.

Enabling recurrence on an existing Task:

1. creates one `RecurrenceSeries`;
2. attaches the seed Task to that series with `recurrence_occurrence_date = seed.scheduled_date`;
3. enumerates every later recurrence slot through `end_date`;
4. creates one ordinary Task for each slot, copying the seed Task's title, priority, context, reference, note and `reminder_time` **at that moment only**, while assigning a fresh Task ID, the slot as both `scheduled_date` and `recurrence_occurrence_date`, and normal initial priority-based position for that date;
5. persists the series + all Task changes in one transaction and increments the canonical revision once.

The canonical command surface keeps occurrence and series semantics distinct while allowing the integrated Task form to save atomically:

~~~text
create { ..., recurrence? }
edit { task_id, changes, recurrence? }
~~~

`create.recurrence` creates the seed and bounded series atomically. Existing-Task `edit.changes` remains occurrence-local. The optional top-level `edit.recurrence` is only the series mutation input: omitted means unchanged, a spec means enable/update, and `null` means stop. Persistence applies the occurrence edit and optional recurrence reconciler in one transaction/revision so the UI has one Save and cannot partially commit. The separate public `set_recurrence` command is removed after migration rather than retained as a parallel user-save path. `move`, `complete`, `reopen` and `delete` remain occurrence-scope commands. Every occurrence resolves visible Repeat configuration through the one canonical `RecurrenceSeries`; no per-Task recurrence configuration copy exists.

Changing Repeat is a **series-membership reconciliation** anchored at the invoking occurrence's immutable `recurrence_occurrence_date`. It updates the one shared series configuration rather than creating a per-occurrence rule or propagating Task content:

- preserve the invoking occurrence, all earlier occurrences and every completed occurrence;
- enumerate the updated recurrence slot set from the invoking immutable slot through the inclusive end date;
- keep an existing later outstanding occurrence when its immutable `recurrence_occurrence_date` remains in that slot set, preserving its Task ID, scheduled date/position and every occurrence-local field exactly as stored;
- delete only later outstanding occurrences whose immutable recurrence slot is no longer in that slot set;
- create only newly introduced later slots, copying the invoking occurrence's current title, priority, context, reference, note and reminder time once at creation and assigning the normal initial position for each date;
- update the one shared series `effective_from`, pattern and end date in the same transaction, with `effective_from` equal to the invoking occurrence's immutable recurrence slot for the newly effective schedule;
- never rewrite ordinary Task fields on any retained occurrence as part of a Repeat change;
- **Stop repeating / remove recurrence** retains the invoking Task, clears its recurrence link so it becomes one-off, preserves completed History and removes **every other outstanding Task linked to that series** in the same transaction, regardless of whether its recurrence slot is earlier or later than the invoking occurrence. This includes older occurrences that rolled forward; the user never deletes those cards individually;
- individual Task Delete remains occurrence-only and must not invoke series removal.

The two write scopes are deliberately non-overlapping. Occurrence-scope Task edits never mutate `RecurrenceSeries`. Series-scope Repeat edits never propagate title/priority/context/reference/note/reminder/scheduled-date/position/completion state into retained sibling Tasks. There is intentionally no "all occurrences", "this and following Task details" or template-propagation command in v1.1; a different common Task definition is represented by creating a new recurring Task.

Daily rollover changes only `scheduled_date`/position. It **never** changes `recurrence_occurrence_date` or the series rule. Therefore an overdue Monday occurrence may roll into Tuesday while the Wednesday occurrence still appears on Wednesday exactly as scheduled.

Each generated occurrence has its own `reminder_time`. The existing reminder owner therefore needs no recurrence-specific delivery state: the same time is copied when the occurrence is created, and reminder due/delivery is evaluated against that occurrence's current `scheduled_date`. A rolled occurrence keeps the time-of-day exactly as today.

Canonical state returned to presentation contains both canonical Tasks and recurrence-series records, so the Task workspace can resolve a Task's shared Repeat configuration without a second lookup model:

~~~ts
interface CanonicalState {
  readonly revision: number;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}
~~~

This extends the one canonical state contract; it does not create a recurrence DTO/ViewModel. A recurrence series with no remaining linked Tasks is deleted transactionally.

### 4.3 Persistence representation

SQLite schema is one Task table plus one bounded recurrence-rule table, minimal app-local metadata and notification-delivery bookkeeping. The recurrence table is planning data, not notification/runtime state:

~~~sql
CREATE TABLE recurrence_series (
  id TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  end_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('weekly', 'monthly')),
  interval_weeks INTEGER,
  weekdays_mask INTEGER,
  day_of_month INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (kind = 'weekly'
      AND interval_weeks IS NOT NULL AND interval_weeks > 0
      AND weekdays_mask IS NOT NULL AND weekdays_mask BETWEEN 1 AND 127
      AND day_of_month IS NULL)
    OR
    (kind = 'monthly'
      AND interval_weeks IS NULL AND weekdays_mask IS NULL
      AND day_of_month BETWEEN 1 AND 31)
  )
);

CREATE TABLE task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  position INTEGER,
  priority TEXT NOT NULL
    CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  context TEXT,
  reference TEXT,
  note TEXT,
  reminder_time TEXT,
  recurrence_series_id TEXT REFERENCES recurrence_series(id),
  recurrence_occurrence_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (completed_at IS NULL AND position IS NOT NULL AND position >= 0)
    OR (completed_at IS NOT NULL AND position IS NULL)
  ),
  CHECK (
    (recurrence_series_id IS NULL AND recurrence_occurrence_date IS NULL)
    OR
    (recurrence_series_id IS NOT NULL AND recurrence_occurrence_date IS NOT NULL)
  )
);
CREATE UNIQUE INDEX task_active_position
  ON task(scheduled_date, position)
  WHERE completed_at IS NULL;
CREATE INDEX task_completed_at ON task(completed_at);
~~~

Technical input validation must also enforce canonical date/time formats, nonblank titles, valid IDs and recurrence invariants before SQL insertion; CHECK constraints alone do not validate those strings. The recurrence `weekdays_mask` is only SQLite encoding (Monday bit 0 through Sunday bit 6); the canonical core type remains the named `Weekday[]` union. The recurrence feature advances SQLite to schema v3: the v2→v3 migration adds the recurrence table and nullable Task recurrence columns, leaving every existing Task non-recurring. SQLite app metadata for schema version, dataset identity, monotonically increasing SQLite state revision, last exported revision, last safely adopted portable snapshot identity and durable pending-sync state. The v1 `data_ref` field is migrated away in place because Git topology is not persistence-domain state. A separate local reminder-delivery key set can suppress duplicate browser notifications; it is non-authoritative presentation bookkeeping and is **not included in Git exports**. SQLite lives under the selected personal repository's `.jig/local/` path and is excluded from version control; deterministic JSON records are the portable snapshot synchronized through the repository adapter.

Apply reordering in one SQLite transaction. To satisfy the active-position uniqueness constraint while changing multiple indices, first move affected positions to distinct temporary nonconflicting values within that same transaction, then write final 0..N-1 positions. No intermediate ordering can be observed outside the transaction. If the transaction fails, the whole operation rolls back.

Use prepared statements and explicit transactions. WAL may be enabled for local concurrent reading, but the WAL/SHM sidecars are runtime files and never Git-managed or treated as standalone recoverable backup. Do not assume copying a live SQLite file is a consistent portable export.

## 5. Astryx UI composition and responsive behavior

Consume the pinned Astryx **public** APIs directly; do not import Order's internal Workbench* modules or duplicate their lifecycle semantics. Astryx owns reusable control mechanics; Jig owns only the product-specific composition required by the v1.0.3 functional contract.

Implementation order is mandatory:

1. the product definition and planning-workbench contract define information hierarchy, interactions and structural budgets;
2. pinned Astryx public APIs define shell, button/menu, list, form, Drawer, BottomSheet, AlertDialog, field, feedback and theme mechanics;
3. Jig React composition defines the Planner header, seven-date Planner, narrow seven-section stack and Task workspace content/state;
4. Jig CSS styles only Jig-owned geometry using public Astryx tokens/roles;
5. Playwright and reviewed screenshots verify the result and must not drive private-library overrides.

Use the canonical Jig theme from [Brand and theme system](../design/brand-and-theme.md), derived from Astryx Neutral and mapped only through public semantic roles. One application theme owner supports System/Light/Dark. Browser visual preference is presentation state, not Task state, and is not exported to Git.

### 5.1 Application shell and destination state

The pinned Astryx 0.7.13 `AppShell` remains the one outer application frame. **Do not provide a `sideNav`.** Set/omit `sideNav` so AppShell renders no sidebar and disable AppShell's automatic mobile-nav drawer (`mobileNav={false}`) because v1.0.3 requires a compact hamburger popover rather than a drawer.

Use the AppShell `topNav` slot for one Jig-owned header composition built from public Astryx leaves. Do not mount a second shell or second `<main>`.

Destination state is one discriminated value:

```ts
type Destination = 'planner' | 'history' | 'settings'
```

Planner is startup/default. The Jig mark and the explicit desktop Planner navigation item both set `destination='planner'`; returning from History/Settings preserves the current in-session displayed-week state. The desktop navigation group is Planner/History/Settings; narrow/mobile renders the same Planner/History/Settings destination set through the compact hamburger popover; only presentation differs.

### 5.2 Planner temporal state and operations

Planner presentation state is singular:

```ts
type PlannerState = {
  displayedWeekStart: LocalCivilDate // Monday
}
```

Initialize `displayedWeekStart` from the browser's current local civil date. Implement the navigation operations as pure calendar transforms:

- `previousWeek()`: subtract seven calendar days from `displayedWeekStart`;
- `nextWeek()`: add seven calendar days to `displayedWeekStart`;
- `today()`: set `displayedWeekStart = startOfWeek(currentLocalDate)`.

There is no `selectDate()` operation.

Global Add uses a **derived value, not state**:

```ts
function defaultAddDate(
  displayedWeekStart: LocalCivilDate,
  currentLocalDate: LocalCivilDate,
): LocalCivilDate {
  return addCivilDays(
    displayedWeekStart,
    weekdayOffsetFromMonday(currentLocalDate),
  );
}
```

This keeps Add contextually inside the viewed week without reintroducing day selection.

None of these operations crosses the HTTP/SQLite command boundary.

Format the centered range from the seven local civil dates, not UTC instants: `16–22 Nov 2026`, `30 Nov–6 Dec 2026`, or `28 Dec 2026–3 Jan 2027`.

### 5.3 Desktop header and Planner geometry

At desktop Planner widths, the AppShell top region contains a three-zone Jig header. Implement the outer geometry as a Jig-owned CSS grid equivalent to:

```css
grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
```

Left zone is the Jig home affordance; right zone contains Add task, an adjacent Planner/History/Settings navigation group, and compact sync status; the center zone is therefore page-centered regardless of unequal side content. Planner is explicit in this group and receives the governed neutral active-destination treatment when active.

For v1.0.5 the center zone is one inline temporal group, superseding the earlier vertical stack:

1. Previous-week IconButton;
2. compact active week range text;
3. Next-week IconButton;
4. Today Button/IconButton with an accessible label.

The range remains informational. The one-row group is the only geometry compatible with the governed 44px header without clipping, private overrides or absolute-position compensation.

The range label is not an interactive element and must not sit between the chevrons. Buttons use Astryx Button/IconButton with explicit accessible labels (“Previous week”, “Today”, “Next week”).

The Planner board uses seven equal-width tracks with a product-level 160px minimum. Track **height is content-driven**; do not stretch tracks merely to equalize bottoms or anchor a lane action. Empty tracks keep only the minimum usable drop-target area.

The seven tracks are **layout tracks, not panel components**. Do not wrap each day in a persistent bordered/card surface. Jig CSS may use spacing plus a single subtle hairline inline divider between adjacent tracks, and may remove even that divider when responsive density makes whitespace sufficient. Do not combine lane borders, header borders and card borders into repeated parallel line work. Task cards remain the discrete interaction surfaces. The desktop semantic breakpoint is **73rem / 1168 CSS px**: this derives from seven 160px tracks plus six 8px inter-track gaps and **zero outer viewport inset**. Below this width render the narrow Planner composition rather than horizontal-scrolling the desktop board. The right Task workspace overlays and therefore does not reduce this board-width calculation.

The date column header is non-selectable and owns only date presentation plus the date-specific Add action. Render the **full weekday name** plus day number (for example `Thursday 19`) and one compact icon-only `+` control with an accessible label such as `Add task to Thursday 19 November`. Do not abbreviate weekdays.

Planner weekday labels are intentionally English UI copy, not browser-locale-dependent date output. Add one UI formatting helper that derives the local civil date and formats the weekday with an explicit English locale and `weekday: "long"`, then composes the numeric day separately. Do not change reminder formatting or the existing general-purpose locale-aware formatter merely to satisfy this Planner label rule. `+` opens the unified create draft for that explicit date. Exact today/current date and drag-over remain separate states; there is no selected-day state.

Task cards may render a thin leading priority accent for rapid scanning. The visual mapping is singular across Planner/History/detail and derived from theme roles, never hard-coded literals. Priority text/icon semantics remain available so color is not the sole carrier. Normal priority is visually quieter than High.

### 5.4 Desktop Task workspace

Use the public Astryx `Drawer` from the inline-end/right with `hasScrim={false}` for Planner and History Task create/edit. Selecting an existing Task constructs its editable draft immediately; there is no read-only view mode. The Drawer overlays the active destination and must not resize, reflow or narrow the Planner board.

There is one workspace state owner:

```ts
type TaskWorkspaceState =
  | { mode: 'closed' }
  | { mode: 'task'; taskId: string; draft: TaskDraft }
  | { mode: 'create'; originatingDate: LocalCivilDate; draft: TaskDraft }
```

Do not add `view`, `edit`, or `move` submodes. An existing Task workspace is immediately editable (`mode: 'task'`); create is the same field surface with no Task ID. Drag owns exact direct movement; editing `scheduled_date` owns explicit non-drag rescheduling.

Global Add task derives its default date from the displayed week and current local weekday: `addCivilDays(displayedWeekStart, weekdayOffset(currentLocalDate))`. In the current week this equals today; in another viewed week it is the corresponding weekday in that week. The desktop date-header `+` creates from its explicit date. Both routes open the same full editable create draft with canonical defaults, and the Date field is immediately editable.

Permanent Delete confirmation alone uses Astryx `AlertDialog`.

### 5.5 Narrow/mobile composition

Below 73rem render a deliberate narrow composition from the **same** destination, Planner state, selected Task and workspace state.

The top region has:

1. application row: Jig home affordance left; compact sync state plus hamburger right;
2. centered week range;
3. grouped Previous/Today/Next control row directly below the range;
4. seven vertically stacked dated sections for the displayed week;
5. each section header uses the full weekday name + day number + compact `+`, followed immediately by that date's outstanding Task list.

There is no date strip, selected-date heading or selected-day list.

The hamburger uses Astryx `DropdownMenu`/popover mechanics and renders the same canonical Planner/History/Settings destination set as desktop. Do not use AppShell MobileNav/SideNav or a side drawer.

A prominent touch Add task control remains available in narrow/mobile composition and uses the same derived week-context default date as global Add. Each stacked date section also exposes its explicit date-header `+`.

Task create/edit uses the public Astryx **BottomSheet** rising from the bottom with `hasScrim={false}`, reusing the exact same `TaskWorkspaceState`. Existing Tasks are immediately editable and Add uses the same field surface. Responsive mode changes presentation only: desktop Drawer ⇄ narrow BottomSheet without destroying or duplicating draft state.

Narrow/mobile drag is enabled for the same outstanding Task rows and exact-position move path as desktop. Touch-operable Move up/Move down remains the non-drag accessibility alternative, and the Edit scheduled-date field remains the explicit non-drag cross-date path. There is no mobile-specific task/order model.

### 5.5.1 v1.0.4 date-header Add and lane geometry

- the shared dated-section/header composition owns the compact per-date Add control for both desktop tracks and narrow stacked sections. No date-selection callback exists; weekday labels use the full names Monday–Sunday.
- The control is an Astryx IconButton/Button leaf; Jig owns only its placement beside the date label.
- The header Add handler uses the same canonical App callback as global Add, supplying the explicit originating date. It does not create another command path.
- Remove the existing `.jig-week-add-task` footer action and any CSS/grid rules whose sole purpose is pinning that action to the bottom.
- The desktop board uses equal-width columns with `align-items: start`/equivalent content-driven block sizing. Each lane may have a different height.
- Empty lanes retain a modest minimum droppable body so cross-date drag remains usable. That minimum is a drag-target usability budget, not a visual equal-height requirement.
- Drag destination index continues to derive from the canonical outstanding sequence; variable lane height has no effect on Task ordering semantics.

### 5.5.2 v1.0.4 reduced-chrome and iconography ownership

- **Lane chrome:** `week.tsx`/Planner composition owns open seven-track geometry. Lane separation is whitespace plus at most one hairline divider; no boxed lane surface, perimeter border, background panel or lane shadow.
- **Task-card chrome:** one restrained card surface is allowed because the Task is an interactive draggable/selectable unit. Use one thin border and optional low-elevation shadow from public theme roles. Do not add multiple nested borders, decorative header rules or heavy shadows.
- **Header/navigation:** keep the established three-zone placement. The right zone owns an adjacent Planner/History/Settings navigation group plus Add/status; do not relocate navigation to a sidebar or center zone.
- **Iconography:** use public Astryx/Lucide-compatible icons for actions/status/metadata where available. Icons are semantic aids, not decoration. Do not encode an essential state by an unlabeled icon alone; pair with text, accessible label/title, or another non-color cue as appropriate.
- **State over chrome:** today, selected Task, priority, drag and operational status are communicated by their governed semantic color/icon/state treatment, not by adding thicker borders around containing lanes/panels.
- **CSS ownership:** remove obsolete borders/dividers/shadows rather than overriding them with transparent values or later selectors. One visual property has one owner.

### 5.6 v1.0.4 state and interaction corrections

- **Today identity:** derive current-day treatment only from exact local civil-date equality (`date === currentLocalDate`). No selected-day state exists, so no other weekday/column receives persistent day-selection styling.
- **Visual state ownership:** product state follows the canonical semantic vocabulary and JIG-106-SD-04. Exact-today uses the governed temporal/cool role; there is no selected-day visual state. Selected Task uses the governed information selection surface/border. Drag target/source uses the active theme's transient accent role. Priority uses High=error, Normal=quiet neutral/secondary and Low=success. Focus remains an independent active-theme focus/accent indication and is not a selection fill. Theme families may change hues but must not change or collapse these meanings.
- **Executable color contract:** Jig-owned product states consume the shared `--jig-state-*`, `--jig-priority-*`, `--jig-status-*`, Task-surface and brand aliases defined by JIG-106-SD-04. `styles.css` must not use raw palette literals or branch by theme name. Persistent product state must not bypass its Jig alias merely because an Astryx generic token looks visually similar. The shared aliases are authored once and included in every compiled Jig theme wrapper/source.
- **Component color contract:** buttons, Task cards, date headers, navigation state, form validation, destructive actions and sync statuses use Astryx component semantics plus the governed Jig product aliases. Component variants remain Astryx-owned; JIG-106-SD-04 is the current authority when earlier Jig Ink/Amber/Paper wording conflicts with multi-theme behavior.
- **Header geometry:** the desktop app-header outer block has one stable product-level minimum height large enough for the two-line Planner temporal centerpiece; History/Settings titles occupy the same center slot without collapsing the outer header. Apply the equivalent stable-height principle in narrow composition.
- **Outside dismissal:** the main Planner/History content owner handles pointer-down outside Task rows and closes the open workspace. Workspace portals and Task rows/actions are excluded. Destination navigation continues to close workspace explicitly.
- **Task menu commands:** menu priority changes issue the ordinary canonical `edit` command with only priority changed; completion/reopen and delete use existing commands; movement uses the existing exact-position command. No alternate Task mutation path is introduced.
- **Operational-status color semantics:** synchronized and local-only are both healthy durability outcomes and use restrained success-family cues while preserving distinct text labels. Pending/retrying use warning, sync issue uses error, and unknown alone uses neutral/secondary styling.


### 5.6.1 Published v1.0.3 failure mechanisms and corrective ownership

The v1.0.4 implementation must correct the failure mechanism, not merely restyle the symptom:

| Reported issue | v1.0.3 mechanism | v1.0.4 technical correction |
|---|---|---|
| Card drag appears broken | `useSortable().handleRef` is attached only to the small `≡` span while the whole Task body displays a grab cursor; the browser test drags that tiny handle, so it certifies a different interaction than the user attempts | use one Sortable: row `ref` owns sortable/drop geometry, body `handleRef` is the activator, and a direct-pinned dnd-kit PointerSensor enforces 5px movement before activation; ordinary click stays selection and browser test drags from card body |
| “Every Tuesday”/same weekday is highlighted in adjacent weeks | v1.0.3 carries `selectedDate` across Previous/Next by ±7 days and styles that date as selected, so the same weekday appears highlighted every week | delete `selectedDate` from Planner state and remove date-selection UI entirely; exact `date === currentLocalDate` alone gets persistent current-day treatment |
| Current day, selected Task and Normal priority all read yellow | CSS maps desktop selected column, selected Task card, Normal priority and drop target to `--color-accent` / `--color-accent-muted` | use the canonical state vocabulary; delete superseded accent selectors rather than layering overrides |
| Task workspace never dismisses from blank content | workspace closes only through explicit close, navigation, completion or deletion; Planner/History content has no outside-interaction owner | content surface owns outside pointer-down dismissal, excluding Task rows/actions and workspace portals; no document-global shadow state |
| Header jumps between Planner and History/Settings | header height is content-driven; Planner center has range + controls while secondary destination center has one title line | one stable header outer min-height per responsive layout, sized to the maximum Planner composition; destination title occupies the same center budget |
| Task menu is incomplete | Planner row menu exposes Edit + Move up/down only; History has Reopen/Edit/Delete; priority and complete/delete are not consistently wired | one menu command model per Task state using existing edit/complete/reopen/delete/move commands; no new endpoint |
| Existing Task requires click → details → Edit | workspace discriminant is `view | edit | create`; Task selection enters `view`, and TaskEditor create mode deliberately hides all optional fields | collapse to `closed | task(draft) | create(draft)`; selecting an existing Task constructs its draft immediately; both states render the same full TaskEditor |
| Local-only appears ambiguous grey | CSS groups `.jig-status-local-only` with `.jig-status-unknown` | separate them: local-only = restrained success; unknown alone = neutral |
| Regression suite missed the UX failures | drag test targets `.jig-task-drag-handle`; Add conformance test asserts Date/Context are absent; no equal-header-height, outside-dismissal, same-weekday-not-today, state-color-separation or Local-only semantic assertions exist | replace those assertions with user-interaction/browser contracts for v1.0.4 |

No domain, SQLite, HTTP, Git-sync, rollover, reminder or installer change follows from these failures.


### 5.6.2 v1.0.5 post-release corrective design

The v1.0.5 correction is defined as eleven atomic solution designs. Each `JIG-105-SD-nn` is the sole technical design owner for the corresponding `JIG-105-FR-nn`; the implementation plan must preserve that numbering one-to-one.

#### Current implementation failure mechanisms

The published v1.0.4 code contains several responsive semantic forks that explain the observed failures:

- `planner.tsx` sets `enableDrag={layoutMode === "desktop"}`, so direct movement is deliberately disabled by layout rather than capability/input.
- `week.tsx` conditionally removes both `TaskDragProvider` and `DateDropZone` on narrow/mobile.
- `planner-list.tsx` conditionally renders `SortableTaskRow` on desktop versus plain `TaskRow` on narrow/mobile.
- `planner-header.tsx` owns two destination definitions: desktop maps `Planner/History/Settings`, while the narrow hamburger separately hard-codes only History/Settings.
- architecture tests currently preserve that divergence by asserting that the narrow menu does not contain Planner.
- narrow CSS gives `.jig-content-frame` `--color-background-surface` while Task cards also use `--color-background-surface`; this collapses the card/canvas distinction on narrow layouts.
- header CSS reserves 5.5rem desktop and 7rem narrow minimum heights, exceeding the intended compact chrome.
- Add controls still use raw `+` glyphs despite the icon requirement, and the header composes the standalone J symbol beside live “Jig” text despite the canonical wordmark contract.

These are presentation/interaction ownership defects. No Task schema, core movement rule, SQLite, HTTP, Git-sync, reminder, installer or release-tool redesign is required.

The complete narrow/mobile architecture review also identifies boundaries that are already correct and must **not** be over-refactored:

- `TaskActionMenu` is already the single Planner/History Task overflow-menu component. v1.0.5 strengthens its typed item builder and parity tests; it does not introduce a replacement menu abstraction.
- `TaskWorkspaceContent` is already shared. Desktop Drawer versus narrow BottomSheet is a legitimate responsive presentation-primitive split over the same workspace state/content and remains.
- `HistoryView` and `SettingsView` are not separate mobile implementations; the same components reflow through CSS.
- `useLayoutMode` remains justified for the two genuine composition differences above (header anatomy and Drawer/BottomSheet). It must not decide Task capabilities or semantic item sets.
- TypeScript is already configured with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Existing assertions in date/HTTP parsers are preceded by runtime validation and are boundary-local; dnd ref assertions are isolated third-party interop. v1.0.5 removes both obsolete dnd row/handle assertions by binding the public callback refs directly, but does not create a broad type-refactor unrelated to the defects.


#### JIG-105-SD-01 — React-owned crash-free drag

**Functional owner:** JIG-105-FR-01.

Jig's React tree and canonical Task state remain the sole rendered-order authority. dnd-kit supplies pointer sensing, collision/drop geometry and transient overlay only.

1. Keep one existing `DragDropProvider`, one `useSortable` per outstanding Task and one canonical `move` command.
2. Add `onDragOver={(event) => event.preventDefault()}` at the provider. The pinned dnd-kit default `OptimisticSortingPlugin` otherwise mutates sortable DOM order before Jig commits canonical state; suppressing it prevents the second DOM/order owner that causes React `removeChild` reconciliation failures.
3. Do not maintain a shadow `Task[]`, per-layout order array or drag-over command stream. Persist once, on successful drop.
4. On drag end derive destination only from dnd-kit target data:
   - sortable target => target group/date and exact sortable index;
   - date droppable => explicit date and canonical outstanding count excluding the source Task.
5. Cancelled/invalid drops submit no command.
6. Keep the overlay transient and derived from canonical Tasks by active ID.

**Strict typing:** dnd operation data is narrowed with dnd-kit's public `isSortable` guard and explicit `typeof target.data?.date === "string"`. No `any`, double cast or duplicate drag result model is introduced.

#### JIG-105-SD-02 — One pointer drag capability across desktop and narrow/mobile

**Functional owner:** JIG-105-FR-02.

Remove layout mode as a drag capability switch.

1. `Planner` no longer passes `enableDrag`.
2. `WeekView` always owns one `TaskDragProvider`; every dated section is always one `DateDropZone`.
3. `PlannerTaskList` always renders one `SortableTaskRow` for outstanding Tasks; remove the `isSortable` branch and plain-row mobile fallback.
4. Remove `dragHandleRef`, `bodyPointerProps` and `pointerStart` from `TaskRow`. Bind dnd-kit's public `sortable.ref` (sortable geometry) and `sortable.sourceRef` (pointer source) to the same Astryx `ListItem` `<li>` through one callback ref. The ListItem click path remains the one selection owner; dnd-kit owns drag activation on the whole sortable row.
5. Use the pinned `PointerSensor` for mouse, touch and pen with pointer-specific activation constraints:
   - mouse/pen: 5px distance threshold;
   - touch: approximately 250ms delay with 5px tolerance so vertical page scrolling remains usable until drag intent is established.
6. Because Astryx `ListItem onClick` uses its own accessible whole-row interactive control, configure dnd-kit's public `preventActivation` callback rather than relying on generic interactive-element detection. Jig marks only genuine nested controls (completion checkbox, reference/copy action and Task overflow trigger) with the Jig-owned `data-jig-drag-excluded="true"` boundary; `preventActivation` rejects only targets within that boundary. Do not inspect private Astryx classes/DOM. The remaining ordinary card surface, including Astryx's row-selection overlay, may initiate drag.
7. A pointer sequence that activates drag must not subsequently execute the ListItem selection/open action on release. Ordinary press/release that never activates drag remains the one Task-selection gesture. This is verified in the browser rather than implemented with a second manual pointer-state machine.
8. Same-day Move up/down and Edit date remain non-drag alternatives using the same canonical commands.

No touch-specific ordering model, gesture framework or second DnD library is permitted.

#### JIG-105-SD-03 — One responsive Planner semantic composition

**Functional owner:** JIG-105-FR-03.

The Planner's dated-section/Task hierarchy is identical at both responsive widths.

1. Render one `jig-week-board` DOM/composition for all layouts.
2. Use the existing seven `DatedSection` instances and one shared `PlannerTaskList`; remove the `jig-planner-narrow` semantic branch.
3. The 73rem breakpoint changes only CSS geometry:
   - desktop: seven equal tracks;
   - narrow: one stacked track flow.
4. Dated section, Add action, Task row, sortable/drop behavior, metadata, state classes and action menus are unchanged by the breakpoint.
5. Remove narrow-only container chrome that recreates a panel/surface around the whole Planner. The narrow canvas remains the same semantic body surface as desktop.
6. `layoutMode` remains only where the actual component primitive differs by product contract (desktop Drawer versus BottomSheet, and desktop header composition versus narrow header composition). It must not toggle Planner/task capabilities.

This is the DRY/SoC correction: responsive layout is a presentation projection over one semantic component tree, not a parallel Planner implementation.

#### JIG-105-SD-04 — One typed application-navigation definition

**Functional owner:** JIG-105-FR-04.

Define the navigation semantics once and render them through desktop and narrow Astryx presentations.

1. In `planner-header.tsx` (or one smaller adjacent UI module if extraction improves readability), define one immutable typed destination tuple whose icon field is Astryx `IconName | NamespacedIconName`, containing:
   - `planner / Planner / viewColumns`;
   - `history / History / jig:history`;
   - `settings / Settings / wrench`.
2. Derive the exported `Destination` union from that tuple rather than separately maintaining a union and item arrays.
3. Desktop `DestinationNav` maps that tuple to Astryx Buttons and renders each semantic key through `<Icon icon={destination.icon}>` into the Button's public `ReactNode` icon slot.
4. Narrow `DropdownMenu.items` maps the exact same tuple to Astryx `DropdownMenuItemData` and renders the same `<Icon icon={destination.icon}>` into the menu item's public `ReactNode` icon slot.
5. Both projections use the same label, semantic icon and active-destination predicate. The mobile menu therefore contains Planner, History and Settings.
6. No responsive-specific destination allowlist, copied labels or copied IDs remain.

This is a UI semantic constant, not a transport/domain DTO. It never crosses the UI boundary and contains no application state. Do not cast a namespaced key to `IconName`; use Astryx's exported `ExtendedIconName`/`NamespacedIconName` types.

#### JIG-105-SD-05 — One typed Task-action menu owner

**Functional owner:** JIG-105-FR-05.

Keep `TaskActionMenu` as the single Task menu owner and strengthen its contract.

1. Build menu items through one pure UI function returning Astryx's public `DropdownMenuItemData[]`; do not invent a Jig menu DTO.
2. Inputs are canonical Task state plus applicable `onMoveUp/onMoveDown` callbacks.
3. Outstanding/completed differences derive only from `task.completed_at`; move availability derives only from canonical sequence position.
4. Planner desktop/narrow and History all render the same `TaskActionMenu`; no layout mode is passed to it.
5. Menu commands continue to call existing edit/complete/reopen/move/delete paths.
6. Tests compare the complete menu item set for an outstanding Task at desktop and narrow widths and separately verify completed History state.

This preserves strict typing by using the design system's exported item type as the boundary type and avoids a parallel action model.

#### JIG-105-SD-06 — Astryx-first complete semantic icon system

**Functional owner:** JIG-105-FR-06.

Use the pinned Astryx icon registry as the one reusable icon system.

**Built-in semantic mapping:**

| Meaning | Astryx icon |
|---|---|
| Previous / Next | `chevronLeft` / `chevronRight` |
| Planner | `viewColumns` |
| History | `jig:history` namespaced extension |
| Settings | `wrench` |
| Mobile navigation trigger | `menu` |
| Task overflow | `moreHorizontal` |
| Reminder | `clock` |
| Web reference | `externalLink` |
| Copy-only reference | `copy` |
| Complete/current priority marker | `check` |
| Move up/down | `arrowUp` / `arrowDown` |
| Repository health/warning/error/unknown | existing `success/warning/error/info` |

Astryx 0.7.13 does not expose true semantic names for Add, History, Edit or Delete. Implement only those missing Jig-owned meanings through Astryx's documented extension seam:

- namespaced keys: `jig:add`, `jig:history`, `jig:edit`, `jig:delete`;
- one small Jig icon module with bundled 24×24 inline SVG fallbacks;
- resolve through `getExtendedIcon`/`Icon` so themes can override the namespaced keys;
- no Lucide/Heroicons dependency and no second icon registry.

Task menus use `jig:edit`, built-in `check` for Complete/Reopen, built-in `arrowUp`/`arrowDown` for movement and `jig:delete` for Delete. Priority rows retain text plus current-priority check because High/Normal/Low are semantic values rather than generic icon meanings.

Date/global Add use `IconButton` or Button `icon` with that semantic Jig icon. HTTP references show `externalLink`; copy references show `copy`. Essential meaning remains in accessible labels/text.

#### JIG-105-SD-07 — Flat, compact, invariant header bar

**Functional owner:** JIG-105-FR-07.

The header is a thin application bar, not a second surface/card.

- Desktop header background resolves to the same application/body background as the surrounding shell. Do not use `--color-background-surface`, muted gray fill, radius, shadow or framed container for the header.
- One `border-block-end: var(--border-width) solid var(--color-border)` is the only persistent header chrome.
- Existing semantics remain on the bar: canonical Jig Home wordmark at left; one centered inline temporal group `Previous · compact week range · Next · Today`; Add task + Planner/History/Settings + synchronization state at right.
- Desktop: target rendered height ~44px, hard maximum `2.75rem` — approximately half the shipped v1.0.4 `5.5rem` minimum. Use compact token padding and `sm` controls; do not preserve excess vertical breathing room.
- Narrow: target rendered height ~56px, hard maximum `3.5rem` — approximately half the shipped v1.0.4 `7rem` minimum. Render one row: compact complete Jig wordmark, Previous, compact range, Next, Today, Add, compact sync state and hamburger. Use `sm`/icon-only Astryx controls where horizontal density requires it, with accessible labels/tooltips; it follows the same flat-background/hairline principle.
- Planner/History/Settings share the same outer height within each layout.
- Remove the 5.5rem/7rem minimums and replace them with the explicit 2.75rem/3.5rem maxima rather than offsetting them with negative margins or private Astryx overrides.
- The shared destination definition supplies visible semantic icons to desktop Buttons and narrow menu items; header flattening must not remove any action, label, icon or state.
- Tests measure actual bounding boxes and computed header background/border, not merely equality.

#### JIG-105-SD-08 — One Task surface/contrast contract across layouts

**Functional owner:** JIG-105-FR-08.

The authored Jig theme owns Task/card separation through local semantic aliases:

- `--jig-task-surface`: Light White; Dark Ink 800.
- `--jig-task-border`: Light emphasized neutral/Ink 200; Dark emphasized neutral/Ink 700.

Planner canvas remains Paper 100 / Ink 950.

1. Planner Task cards and History Task rows consume the same aliases.
2. Remove narrow `.jig-content-frame` background/border/radius that turns the narrow Planner into another surface panel and causes card=container color collapse.
3. Responsive CSS may alter spacing/minimum touch height only; it may not redefine card background/border.
4. Selected Task info-blue, drag Amber, focus Amber and priority cues layer over this base surface without becoming the base surface.
5. Generated Jig theme artifacts are rebuilt and `theme:check` must pass.

#### JIG-105-SD-09 — Canonical compact header wordmark

**Functional owner:** JIG-105-FR-09.

`BrandHome` uses `assets/jig-logo.svg` and `jig-logo-on-dark.svg` as the complete wordmark and removes standalone-symbol + live-text composition.

- Scale the complete wordmark to compact header dimensions through Jig-owned wrapper geometry.
- Retain the existing accessible Button label `Planner home`; image artwork remains decorative to assistive technology.
- Light/Dark asset switching uses the existing theme selectors.
- Desktop and narrow render the same `BrandHome`; no second mobile brand component exists.

#### JIG-105-SD-11 — Zero-margin full-bleed viewport composition

**Functional owner:** JIG-105-FR-11.

Jig has no application-level viewport gutter. The browser viewport itself is the application canvas.

1. `.jig-app-shell` owns **zero** outer padding/margin at desktop and narrow widths.
2. `.jig-content-frame` is not an inset panel: no outer border, radius, shadow, background slab or margin.
3. `.jig-content` owns zero page-level padding on all four sides. Product/component spacing is applied by the actual semantic owners (header controls, date headers, Task lists, History groups, Settings sections, forms), not by a generic page inset.
4. The application header spans viewport edge-to-edge and its bottom hairline reaches the full viewport width.
5. Planner tracks consume the entire available content width. There is no artificial max-width and no left/right screen gutter.
6. Remove the narrow page-level `calc(5rem + env(safe-area-inset-bottom))` content padding. Safe-area handling, where a specific Astryx overlay/control requires it, stays with that primitive rather than creating a permanent page margin.
7. Removing the former 48px total desktop outer inset changes the seven-track semantic breakpoint. The minimum desktop width is now:
   - seven tracks × 160px = 1120px;
   - six inter-track gaps × 8px = 48px;
   - outer viewport inset = 0px;
   - total = **1168px = 73rem**.
   Therefore `DESKTOP_LAYOUT_MEDIA_QUERY` becomes `(min-width: 73rem)` and the CSS narrow query becomes `max-width: 72.999rem`.
8. No replacement wrapper may reintroduce the same inset under another class name.

**Verification:** at representative desktop and narrow viewports, bounding boxes for AppShell/header/content-frame/main content start at x=0 and extend to viewport width; application shell/page-level computed margin and padding are 0 on all sides; no content-frame border/radius/shadow exists; Planner first/last tracks align with the available canvas edges; responsive mode changes at the governed 73rem boundary.

---

#### JIG-105-SD-10 — Certification and architecture guards

**Functional owner:** JIG-105-FR-10.

The v1.0.5 verification gate must prove the corrected architecture as well as visible outcomes.

**Browser:**
1. capture `pageerror` and console-error events during desktop same/cross-date drag; any unallowlisted runtime error fails;
2. touch/narrow same-date, cross-date and empty-date drag, followed by canonical reload assertions;
3. open desktop navigation and narrow hamburger presentation and assert the same ordered destination IDs/labels;
4. compare outstanding Task menu items at desktop and narrow widths; verify completed History menu separately;
5. assert semantic icons for navigation/Add/reference/movement/status and absence of raw `+`, `•••`, `≡` stand-ins in governed controls;
6. desktop header <= 44px / 2.75rem and narrow <= 56px / 3.5rem, invariant across destinations;
7. computed Task-card background/border differs from Planner canvas in Light and Dark at desktop and narrow widths;
8. application shell/header/content-frame/main bounds are edge-to-edge with zero application-level margin/padding, no content-frame panel chrome, and responsive mode switches at the governed 73rem / 1168px boundary.

**Architecture/static:**
- no `enableDrag` or `isSortable` responsive capability flag in Planner composition;
- one `TaskDragProvider`, one `DateDropZone` path and one `SortableTaskRow` path;
- one destination tuple; tests must not encode a different narrow destination set;
- `TaskActionMenu` remains the sole Task action-menu owner;
- no layout-specific Task surface token or raw card color;
- no replacement application/page inset wrapper and no stale 76rem responsive owner;
- no new `any`, double cast, non-null assertion, DTO/mapping hierarchy, service/repository layer or second state framework;
- existing localized third-party dnd ref assertions remain permitted only if library typing still requires them and are not widened into product logic.

**Visual evidence:** desktop Planner Light/Dark, narrow Planner Light/Dark, narrow navigation menu open, desktop+narrow Task menu open, active drag target and workspace state are mandatory.

A green test run without these cases is not sufficient v1.0.5 certification.

#### v1.0.5 architecture-compliance matrix

The corrective design is intentionally presentation-local. It does not add a new domain concept, persistence representation, protocol envelope or shell subsystem.

| Solution | Owning layer / boundary | Canonical semantic owner | Architectural constraint |
|---|---|---|---|
| JIG-105-SD-01 drag reconciliation | `ui/src/drag.tsx` interaction adapter | existing canonical Task order + existing move command | dnd-kit may sense/measure only; no shadow order, drag DTO or per-frame domain writes |
| JIG-105-SD-02 responsive pointer drag | UI composition + dnd sensor configuration | one `SortableTaskRow` / one `DateDropZone` path | viewport must not decide capability; no touch-specific state model or second gesture framework |
| JIG-105-SD-03 responsive Planner | UI composition + CSS geometry | one dated-section/Task renderer | breakpoint changes geometry only; no mobile Task projection or duplicate renderer |
| JIG-105-SD-04 application navigation | UI semantic constant | one readonly destination tuple | type icon as Astryx `ExtendedIconName`; render through public Button/DropdownMenu slots; no navigation DTO or responsive copy |
| JIG-105-SD-05 Task action menu | pure UI item builder + one `TaskActionMenu` component | canonical Task state/sequence position | use Astryx `DropdownMenuItemData`; no mobile/desktop action models |
| JIG-105-SD-06 icon vocabulary | small UI presentation adapter over Astryx Icon | Astryx built-ins + four governed Jig namespaced keys | keys checked as `NamespacedIconName`; no second icon library/registry, no casts to `IconName` |
| JIG-105-SD-07 compact header | Jig-owned AppShell topNav composition + scoped CSS | one header geometry owner | public Astryx controls only; no private selectors, offset hacks or second shell |
| JIG-105-SD-08 Task surface contrast | `jig-theme.source.ts` + generated Astryx theme artifacts | one Task-surface token mapping | no raw responsive colors, no hand-edited generated theme artifacts |
| JIG-105-SD-09 wordmark | shared `BrandHome` UI composition | canonical Jig logo assets | no alternate mobile brand component or duplicate live brand text |
| JIG-105-SD-10 certification | architecture/browser/evidence tests | requirements/design contract | tests must prove owner singularity and observable outcomes, not encode divergent responsive behavior |
| JIG-105-SD-11 full-bleed layout | AppShell/content composition + scoped CSS | one viewport/layout geometry owner | zero application inset; no replacement wrapper/max-width; one 73rem breakpoint |

**FCIS boundary:** no v1.0.5 corrective solution requires new code in `src/core` or `src/shell`. Existing pure planning rules and canonical `TaskCommand`/move semantics remain authoritative. UI code translates pointer/navigation/menu events into existing callbacks/commands; it does not reimplement ordering, scheduling, rollover, completion or persistence semantics.

**Strict typing boundary:** external/browser/dnd data is narrowed at the smallest adapter boundary with public guards/runtime checks. UI semantic constants use exported Astryx types (`IconName`, `NamespacedIconName`, `DropdownMenuItemData`) and derived literal unions. Do not introduce `any`, `unknown as`, double casts, non-null assertions, duplicate domain shapes, DTO/ViewModel types or assertion-only compiler appeasement.

**SoC / DRY boundary:** responsive differences are presentation choices only. One meaning has one owner: one Task model, one order, one Planner renderer, one destination set, one Task menu builder, one icon mapping, one Task-surface mapping and one viewport breakpoint. Drawer versus BottomSheet and desktop versus narrow header composition remain legitimate presentation-primitive differences over shared state.

#### v1.0.5 traceability

| Functional requirement | Technical solution |
|---|---|
| JIG-105-FR-01 | JIG-105-SD-01 |
| JIG-105-FR-02 | JIG-105-SD-02 |
| JIG-105-FR-03 | JIG-105-SD-03 |
| JIG-105-FR-04 | JIG-105-SD-04 |
| JIG-105-FR-05 | JIG-105-SD-05 |
| JIG-105-FR-06 | JIG-105-SD-06 |
| JIG-105-FR-07 | JIG-105-SD-07 |
| JIG-105-FR-08 | JIG-105-SD-08 |
| JIG-105-FR-09 | JIG-105-SD-09 |
| JIG-105-FR-10 | JIG-105-SD-10 |
| JIG-105-FR-11 | JIG-105-SD-11 |


### 5.6.3 v1.0.6 technical solution designs

The designs below are the complete technical realization of JIG-106-FR-01 through JIG-106-FR-07. They are deliberately presentation/browser-shell scoped. They do not introduce a new Task representation, HTTP shape, SQLite table, Git record, service/repository layer, workflow framework or theme DTO.

#### Investigation facts fixed by the pinned environment

The following facts were verified before selecting the design and are implementation constraints, not assumptions:

- `@astryxdesign/core@0.7.13` `defineTheme()` accepts a string or a `[light, dark]` token pair, resolves pairs through CSS `light-dark()`, supports `extends`, `localTokens`, component overrides and built themes, and flattens an extended theme so the built output is self-contained.
- `Theme` in Astryx 0.7.13 accepts one `DefinedTheme` plus `mode: "system" | "light" | "dark"`. The root Theme synchronizes the active theme name to `data-astryx-theme`; explicit Light/Dark set `data-theme`; System removes that explicit attribute and lets `color-scheme: light dark` and `light-dark()` follow the platform preference. Jig therefore does **not** need a second `matchMedia`-driven color-mode owner.
- Astryx 0.7.13 publishes seven application-theme packages, but its Gothic source explicitly declares **“Gothic Theme — dark only”** and uses single-value color tokens. JIG-106-FR-02 selects the six coherent dual-mode pinned presets **Neutral, Butter, Chocolate, Matcha, Stone and Y2K** and explicitly excludes Gothic because JIG-106-FR-03 requires every selectable v1.0.6 theme to provide coherent Light and Dark. Jig does not fabricate a light inversion for an upstream dark-only preset.
- The current Jig implementation already has one root `<Theme>`, one generated Jig theme, a browser-local appearance preference, a Settings Appearance panel, semantic product aliases, and a browser Notification permission adapter. v1.0.6 extends those owners instead of creating parallel state or services.
- The current width CSS has the correct base `max-width: 50rem`, but a `max-width: 72.999rem` media rule removes that cap. The resulting 1168px→1167px transition expands a secondary screen from about 800px to about 1167px. That media reset is the defect.
- The current reminder monitor explicitly chooses Astryx Toast when `document.visibilityState === "visible"` and browser `Notification` only while hidden. That code matches the old technical contract but contradicts JIG-106-FR-06; both the contract and code path must become single-channel browser Notification.
- The current header renders two external SVG images, one fixed Ink/Amber and one fixed White/Amber, and CSS switches them by Light/Dark. External `<img>` SVG resources cannot consume the active application's semantic CSS custom properties, so that mechanism cannot satisfy theme-family-aware branding.
- The pinned supported Astryx preset surface mappings prove that Jig cannot choose one generic Task-surface token globally: Neutral dark resolves `--color-background-card` to the same value as body while its `--color-background-surface` is elevated, while Chocolate Light resolves surface to body and requires card. Jig therefore needs one **product semantic** `--jig-task-surface` whose value is supplied by each theme wrapper from the appropriate upstream elevated role. Feature CSS still has one owner and no theme branch.

Pinned Astryx evidence:
- `defineTheme`: https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/theme/defineTheme.ts
- root `Theme`: https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/theme/Theme.tsx
- published themes: https://github.com/meta/astryx/tree/v0.7.13/packages/themes

#### JIG-106-SD-01 — Continuous History/Settings content measure

**Functional owner:** JIG-106-FR-01.

v1.1 adds one heading-ownership refinement without changing this width owner: History/Settings destination title and subtitle are rendered exactly once by the application header. Their bounded 50rem content surfaces begin with semantic page content and contain no duplicate page-level heading block. The versioned v1.1 solution specifies the exact header composition and accessibility semantics.

The 50rem budget belongs continuously to the History/Settings screen content. It is **not** a desktop-only rule and it is unrelated to the Planner's 73rem semantic composition breakpoint.

1. Keep the existing base owner:
   ```css
   .jig-history-view,
   .jig-settings-view {
     width: 100%;
     max-width: 50rem;
     margin-inline: auto;
   }
   ```
2. Delete the `.jig-history-view, .jig-settings-view { max-width: none; margin-inline: 0; }` reset from the `max-width: 72.999rem` media query. Do not replace it with another width breakpoint.
3. Keep Planner, AppShell, header, `.jig-content-frame` and `.jig-content` full-bleed.
4. Keep Settings' internal grid independent from the outer measure. `repeat(2, minmax(0, 1fr))` remains the wide/composition form and may switch to `1fr` at the existing 73rem layout boundary. That reflow does not alter the 50rem outer cap.
5. No React wrapper, width state, ResizeObserver, container-query owner, new breakpoint, DTO or private Astryx override is permitted.

Expected width function is simply `min(availableWidth, 50rem)`. Representative acceptance: 1440→800, 1168→800, 1167→800, 1024→800, 900→800, 800→800, 600→600, 390→390 CSS px, subject only to browser subpixel rounding. A dedicated browser assertion must compare both sides of 73rem and prove no secondary-screen width discontinuity.

**Affected implementation:** `ui/src/styles.css`, architecture/static width guard, browser conformance tests only. No core/shell/protocol/persistence change.

#### JIG-106-SD-02 — One typed Astryx theme-family registry

**Functional owner:** JIG-106-FR-02.

v1.0.6 has exactly thirteen selectable application themes. The type and registry are closed and compile-time exhaustive:

```ts
type ThemePreset =
  | "jig"
  | "astryx-neutral"
  | "astryx-butter"
  | "astryx-chocolate"
  | "astryx-matcha"
  | "astryx-stone"
  | "astryx-y2k"
  | "gruvbox"
  | "dracula"
  | "solarized"
  | "nord"
  | "catppuccin"
  | "tokyo-night";
```

There is one registry entry per value containing the user-facing label/group and the compiled `DefinedTheme`. Settings derives its options from this registry; no second theme list is allowed.

**Astryx presets.** Add the five missing dual-mode exact-pinned packages at 0.7.13 (Butter, Chocolate, Matcha, Stone, Y2K); Neutral remains. Do not add `@astryxdesign/theme-gothic` to the selectable Jig catalogue because the pinned upstream theme is explicitly dark-only. Do not copy Astryx palettes into Jig. Create a thin Jig theme source for each selectable preset that `extends` the corresponding pinned Astryx built theme and adds the shared Jig product-local tokens from JIG-106-SD-04. Because Astryx flattens inheritance, each compiled Jig wrapper is self-contained. Import the published `fonts.css` for every selectable Astryx preset whose typography is exposed to the user, including Neutral.

**Jig default.** The existing Jig theme remains the default and retains its governed Ink/Amber/Paper palette. It also consumes the exact same shared product-local token contract as every other preset.

**Community themes.** Community presets are **palette themes over Astryx Neutral mechanics**: keep Neutral's component anatomy, typography, icons, radius/motion behavior and accessibility mechanics; replace its complete color-semantic inventory with the selected community palette. This is intentionally not an attempt to embed Vim/Neovim/editor plugin code or reproduce editor-specific chrome.

The Light/Dark pair and semantic anchors are fixed as follows; no extra contrast/flavor/style setting is introduced in v1.0.6:

| Preset | Light member | Dark member | Surface basis | Accent/direct manipulation | Information/selection | Current day | Success | Warning | Error |
|---|---|---|---|---|---|---|---|---|---|
| Gruvbox | canonical **medium** Light | canonical **medium** Dark | upstream `bg0/bg1/bg2` | orange | blue | aqua | green | yellow | red |
| Dracula | **Alucard Classic** | **Dracula Classic** | Background + Selection/Current Line ramps | purple | Current Line/Selection blue-gray | cyan | green | orange/yellow | red |
| Solarized | canonical Light rebase | canonical Dark rebase | `base3/base2` ↔ `base03/base02` | orange | blue | cyan | green | yellow | red |
| Nord | Snow Storm bright ambience | Polar Night dark ambience | `nord6/nord5/nord4` ↔ `nord0/nord1/nord2` | Frost `nord10` | Frost `nord9` | Frost `nord7` | Aurora `nord14` | Aurora `nord13` | Aurora `nord11` |
| Catppuccin | **Latte** | **Mocha** | Base/Mantle/Crust + Surface levels | Mauve | Blue | Teal | Green | Yellow | Red |
| Tokyo Night | **Day** | **Night** | upstream Day/Night background/surface roles | purple/magenta family | blue | cyan/teal | green | yellow/orange | red |

Community palette values are copied once into committed theme-authoring constants; there is no runtime network lookup. Each source records upstream repository/file and the reviewed source blob/commit plus license attribution. The repository currently has no third-party notice file, so v1.0.6 introduces root `THIRD_PARTY_NOTICES.md` as the single notice owner for copied Gruvbox/Dracula/Solarized/Nord/Catppuccin/Tokyo Night palette material and retains Jig's existing Apache-2.0 `LICENSE` unchanged. The upstream sources selected for this design are:

- Gruvbox: https://github.com/morhetz/gruvbox — its canonical source defaults both light and dark contrast to `medium`, supplies Light/Dark ramps and states MIT/X11.
- Dracula: https://github.com/dracula/draculatheme.com/blob/main/content/spec.mdx — explicitly defines Dracula Classic dark and Alucard Classic light and requires 4.5:1 minimum text contrast.
- Solarized: https://github.com/altercation/solarized — canonical 16-color Light/Dark rebase and MIT license.
- Nord: https://www.nordtheme.com/docs/colors-and-palettes/ — Polar Night, Snow Storm, Frost and Aurora semantic guidance.
- Catppuccin: https://catppuccin.com/palette/ and https://github.com/catppuccin/palette — Latte is the light flavor; Mocha is the darkest/original dark flavor; palette repository is MIT.
- Tokyo Night: https://github.com/folke/tokyonight.nvim — use its Night palette and official Day transformation; upstream repository is Apache-2.0.

**Reviewed provenance snapshot (2026-11-18):**

| Family | Reviewed authority |
|---|---|
| Gruvbox | `colors/gruvbox.vim` blob `66246fba24fd49eeb50dd833094d272f0bbab640`; README blob `008de69c071f2b783b8822739e0d6258dbde18c4`. The source itself defaults `gruvbox_contrast_light` and `gruvbox_contrast_dark` to `medium`. |
| Dracula | `content/spec.mdx` blob `34a22aa05be158b5524a7355c8e39f548a877e8a`, defining Dracula Classic + Alucard Classic and its accessibility requirements. |
| Solarized | canonical README/palette blob `d18ee9450251ea1b9a02ebd4d6fce022df9eb5e4`, including the exact base/accent values and Light/Dark rebase. |
| Nord | official Colors and Palettes documentation, site version `v0.23.0` as reviewed on 2026-11-18; use the documented `nord0..nord15` semantic palette, not a third-party port. |
| Catppuccin | official `palette.json` version `1.8.0`, blob `2a5d25cb0b00033bb049d11ab12c8bed478bf4e8`; select Latte and Mocha only. |
| Tokyo Night | `storm.lua` blob `dfba7a1b2277628e6a9b87ad4a1dad8387b4d2f6`, `night.lua` blob `09ea61be78bf57946bf429de17973ceff19e8195`, and `day.lua` blob `653a12e652ea3a5756e50e071a01da528818c356`. Author the resulting Day/Night constants into Jig; do not execute Lua or fetch upstream at runtime/build time. |

**Theme build and loading.** Every Jig-owned theme source is compiled ahead of time with the pinned `@astryxdesign/cli@0.7.13`; runtime code imports built theme objects only. Extend `theme:check` to enumerate the explicit 13-source manifest and run the CLI `--check` for each Jig-owned compiled theme. Generated CSS for all thirteen themes is imported once before Jig composition CSS; its `data-astryx-theme` scoping means inactive themes do not paint the application. Do not dynamically inject unbuilt themes at runtime and do not create one stylesheet of feature-level overrides per theme.

**No plugin subsystem.** v1.0.6 has no arbitrary JSON theme import, user-authored palette loader, marketplace, runtime theme discovery or external theme API.

#### JIG-106-SD-03 — Independent ThemePreset and AppearanceMode state

**Functional owner:** JIG-106-FR-03.

Split the current overloaded `ThemePreference = "system" | "light" | "dark"` presentation state into exactly two typed values:

```ts
type AppearanceMode = "system" | "light" | "dark";
type ThemePreset = /* JIG-106-SD-02 union */;
```

One presentation module owns the unions, guards, registry lookup and browser-local persistence. `settings.tsx` consumes the types; it does not redefine them.

The root remains exactly one owner:

```tsx
<Theme theme={themeRegistry[themePreset].theme} mode={appearanceMode}>
```

Do not resolve System in application JavaScript. Astryx 0.7.13 already makes System use `color-scheme: light dark`, removes explicit root `data-theme`, and resolves each `[light,dark]` token through `light-dark()`; platform preference changes therefore repaint the selected family without a third Jig color implementation or duplicated state. Browser acceptance must change the emulated platform color scheme **while the same mounted application remains in System mode** and prove that computed theme values change without changing `ThemePreset`, destination, Planner/workspace state or local persistence.

Browser-local persistence is explicit and backwards compatible:

- `jig-theme-family` stores a valid `ThemePreset`; missing/invalid → `"jig"`.
- `jig-appearance-mode` stores `"system" | "light" | "dark"`; missing/invalid falls back to the legacy `jig-theme` key when that key contains a valid old appearance value, otherwise → `"system"`.
- Any successful new appearance write removes the legacy `jig-theme` key best-effort. Store `"system"` explicitly in the new key; do not overload “missing” with a mode again.
- localStorage failure changes only persistence; the in-memory selection continues to work and Task/domain state is unaffected.

There is no SQLite column, portable record, HTTP endpoint, Task command, repository sync field or revision change for appearance.

#### JIG-106-SD-04 — Complete semantic color contract and state precedence

**Functional owner:** JIG-106-FR-04.

All feature code continues to consume one semantic contract. Theme sources own palette-to-semantics mapping; feature CSS never branches on theme name and never contains community/Jig raw palette literals.

The Jig product-local aliases become **palette-independent references to Astryx semantics**:

```text
--jig-state-today-border         -> --color-border-teal
--jig-state-today-text           -> --color-text-teal
--jig-state-task-selected-bg     -> --color-info-muted
--jig-state-task-selected-border -> --color-border-info
--jig-state-nav-active-bg        -> --color-neutral
--jig-state-nav-active-text      -> --color-text-primary
--jig-state-drag-border          -> --color-accent
--jig-state-drag-bg              -> --color-accent-muted
--jig-priority-high              -> --color-text-error
--jig-priority-normal            -> --color-text-secondary
--jig-priority-low               -> --color-text-success
--jig-status-healthy-bg          -> --color-success-muted
--jig-status-healthy-border      -> --color-border-success
--jig-status-healthy-text        -> --color-text-success
--jig-state-hover-bg             -> opaque tint of --jig-task-surface toward --color-tint-hover
--jig-state-pressed-bg           -> stronger opaque tint of --jig-task-surface toward --color-tint-hover
--jig-task-surface               -> theme wrapper's elevated Task-surface role
--jig-task-border                -> --color-border-emphasized
--jig-brand-primary              -> --color-icon-primary
--jig-brand-accent               -> --color-icon-accent
```

`--jig-task-surface` is the one product owner for Task elevation, but its theme-source value is selected once per theme wrapper because the pinned presets do not expose one universally elevated core token. The mapping is fixed, not left to implementation judgment:

| Theme wrapper | `--jig-task-surface` source |
|---|---|
| Jig | existing governed Jig pair: Light `var(--jig-white)`, Dark `var(--jig-ink-800)` |
| Astryx Neutral | `--color-background-surface` |
| Astryx Butter | `--color-background-surface` |
| Astryx Chocolate | `--color-background-card` |
| Astryx Matcha | `--color-background-surface` |
| Astryx Stone | `--color-background-surface` |
| Astryx Y2K | `--color-background-surface` |
| Gruvbox / Dracula / Solarized / Nord / Catppuccin / Tokyo Night | their authored `--color-background-surface`, which must be distinct from body |

This mapping preserves the published Jig v1.0.5 contrast fix and follows the actual 0.7.13 preset values: Jig Dark intentionally keeps Ink 800 above its Ink 950 canvas; Neutral dark has card==body; Chocolate Light has surface==body; the listed alternate role is elevated in each supported case. This is not feature-level branching: the Task component always consumes only `--jig-task-surface`.

For Jig-owned Task wrappers, hover/pressed are **surface variants, not replacement translucent overlays**. Define them from the active Task surface, e.g. an opaque `color-mix()` toward `--color-tint-hover` (5% hover, 10% pressed), or use an equivalent two-layer background that keeps `--jig-task-surface` underneath. A hover/press must never make an unselected Task transparent onto the Planner canvas. Astryx controls continue to own their own interaction overlays.

For **published Astryx presets**, inherit their complete semantic/component mapping and add only the shared Jig aliases above. For each **community theme**, override the entire Astryx color-semantic inventory used by Core/Jig rather than only body/text/accent. At minimum this includes: body/surface/card/popover/muted/inverted backgrounds; accent/accent-muted/on-accent/neutral; primary/secondary/disabled/accent text and icons; overlays/hover/pressed; ordinary/emphasized borders; skeleton/track/shadow/tint; info/success/warning/error strong, muted, on-fill, text, icon and border roles; and the named blue/cyan/gray/green/orange/pink/purple/red/teal/yellow background/border/icon/text families. This prevents a community theme from leaking Neutral blue/green/red or neutral surfaces through an Astryx component.

State precedence is fixed and does not vary by theme:

1. keyboard focus remains an independent outer focus indication and is never replaced by selection/priority;
2. transient drag/drop owns the Task's interaction surface/border while the drag is active;
3. persistent Task selection owns the non-drag selected surface/border;
4. priority remains its narrow leading semantic cue in selected, focused and dragged states;
5. current-day treatment belongs to the date/header structure, not Task selection;
6. operational status remains on the status control and never becomes Task selection/priority.

The implementation-facing semantic coverage is exhaustive. Existing feature composition keeps these exact owners; theme work changes only the values behind them:

| Governed FR-04 surface/state | Technical owner |
|---|---|
| page / Planner canvas / flat application header | `--color-background-body`; header hairline `--color-border` |
| ordinary surface / Section-like content | `--color-background-surface` through Astryx public component semantics |
| elevated Task card / History Task row | `--jig-task-surface` + `--jig-task-border` |
| card / popover / dialog / menu layers | Astryx `--color-background-card` / `--color-background-popover` and public component mappings |
| muted surface | `--color-background-muted` |
| Task workspace / fields / selectors / segmented controls / buttons | Astryx public component semantics; no Jig theme-name CSS branch |
| primary / secondary / disabled text | `--color-text-primary` / `--color-text-secondary` / `--color-text-disabled` |
| primary / secondary / disabled icons | `--color-icon-primary` / `--color-icon-secondary` / `--color-icon-disabled` |
| ordinary / emphasized borders | `--color-border` / `--color-border-emphasized` |
| hover / pressed | opaque Task-surface tint through `--jig-state-hover-bg` / `--jig-state-pressed-bg` where Jig owns the Task wrapper; Astryx interaction semantics inside Astryx controls |
| keyboard focus | Astryx `--focus-outline-*`, with the theme's active accent/focus role |
| active navigation | `--jig-state-nav-active-bg` + `--jig-state-nav-active-text` |
| exact current day | `--jig-state-today-border` + `--jig-state-today-text` |
| selected Task | `--jig-state-task-selected-bg` + `--jig-state-task-selected-border` |
| drag/drop | `--jig-state-drag-bg` + `--jig-state-drag-border` |
| High priority | `--jig-priority-high` plus the existing explicit High text/meaning where rendered |
| Normal priority | `--jig-priority-normal`; remains visually quiet |
| Low priority | `--jig-priority-low` plus the existing explicit Low text/meaning where rendered |
| completion | Astryx success `check` icon + completed-title line-through + `--color-text-secondary`; completion never relies on color alone |
| informational state | Astryx info family: `--color-info(-muted)`, `--color-text-info`, `--color-border-info` as owned by the component |
| healthy / success repository state | `--jig-status-healthy-bg` + `--jig-status-healthy-border` + `--jig-status-healthy-text` |
| pending / retrying | `--color-warning-muted` + `--color-text-warning` + warning icon; retain explicit Pending/Retrying label |
| destructive / error / sync issue | `--color-error-muted` + `--color-text-error` (and `--color-border-error` where a border is present); retain explicit error/sync-issue copy |
| unknown / neutral operational state | `--color-background-muted` + `--color-text-secondary` + info/neutral icon and explicit Status label |
| brand guide/wordmark / pin | `--jig-brand-primary` / `--jig-brand-accent` from JIG-106-SD-05 |

This table is the current v1.0.6 owner map. Earlier Jig-specific hue names such as “Amber drag”, “teal today” or “info-blue selection” describe the default Jig palette only; other theme families preserve the **semantic roles and precedence**, not those literal hues.

Theme certification must check computed values, not only screenshots. For every preset in forced Light and Dark, and for System under emulated Light and Dark:

- normal text and status text on their governed surfaces meet WCAG AA 4.5:1 where the existing contract requires normal-text readability;
- content on accent/status fills meets 4.5:1;
- focus/current-day/selection/drag outlines used as non-text state signals meet at least 3:1 against adjacent surfaces or retain an independent non-color affordance;
- Task surface is visibly distinct from Planner body/canvas before hover/selection;
- selected, today, drag, priority and status treatments do not collapse into the same computed treatment;
- no feature CSS changes when switching theme; only the semantic token values do.

The raw-color architecture guard must permit palette literals only in governed theme-authoring/palette sources and fixed external brand assets. It continues to reject raw color literals in `ui/src/styles.css` and product components.

#### JIG-106-SD-05 — One semantic in-application Jig logo

**Functional owner:** JIG-106-FR-05.

The current two-`<img>` header implementation is replaced for application chrome by one canonical inline SVG React component, e.g. `JigLogo`. Copy the existing approved path geometry exactly once; do not redraw or maintain per-theme geometry variants.

The in-application SVG uses the shared theme roles:

- guide/wordmark foreground → `--jig-brand-primary`;
- alignment pin/accent → `--jig-brand-accent`.

The header button already owns the accessible name (`Planner home`), so the decorative inline wordmark remains `aria-hidden`. Desktop and narrow composition render the same component.

Delete the application CSS that switches `.jig-brand-logo-light`/`.jig-brand-logo-dark` through `data-theme` and `prefers-color-scheme`. Theme-family and System-mode switching then require no logo-specific JavaScript or media query: the SVG consumes the same active semantic variables as the rest of the application.

Existing fixed-color external assets — favicon, app icon, README/release/marketing-safe lockups — remain valid theme-independent brand artifacts unless separately governed. They are not used as the runtime application-header color authority.

Browser certification verifies invariant SVG geometry/one logo instance and compares its computed primary/accent paint against the active theme roles. Both must remain distinguishable on the actual header/body surface; use at least 3:1 non-text contrast as the certification floor for the in-app mark treatment.

#### JIG-106-SD-06 — One browser Notification reminder channel

**Functional owner:** JIG-106-FR-06. Section 6 contains the full lifecycle.

Retain the existing `ReminderMonitor` eligibility owner, 30-second bounded poll, local-time calculation, session-start guard and device-local duplicate key. Delete only the presentation split:

- remove `useToast`, the reminder Toast content/Button and `document.visibilityState === "visible"` delivery branch;
- if `browserNotificationState() !== "granted"`, do not dispatch and do not mark delivered;
- with permission granted, call `new Notification("Jig reminder", { body: task.title, tag: key })` regardless of visibility/focus;
- mark the key delivered only after the constructor succeeds; if it throws, leave the key undelivered for a later bounded retry while still eligible;
- focus/visibility events may remain as **recheck triggers** to recover from timer throttling, but they never select a different channel.

Do not introduce a notification service class, server scheduler, new shell process, service worker, push API, background queue or protocol endpoint. `browser-notifications.ts` remains the narrow browser capability/permission adapter. Remove reminder-toast CSS and architecture tests must reject a Toast dependency from the reminder module.

#### JIG-106-SD-07 — Settings is the sole appearance-control surface

**Functional owner:** JIG-106-FR-07.

Keep appearance configuration inside the existing Settings → Appearance panel:

1. Add one Astryx `Selector` bound to `ThemePreset`. It renders the registry-derived catalogue grouped as **Jig**, **Astryx** and **Community**. Thirteen options are well within Selector's intended bounded-list use; do not build a custom picker.
2. Keep one Astryx `SegmentedControl` for exactly `System | Light | Dark`, now bound to `AppearanceMode`.
3. The App/root owns the two values and passes setters only to Settings. Planner, `PlannerHeader`, Task cards, Task workspace and History receive no theme setter or theme-specific props.
4. Browser-notification permission can remain an independent Settings row; changing notification permission is not a theme action.
5. Theme/mode changes apply immediately because the root Theme receives the new registry theme/mode; the **setting event itself** changes presentation state only and does not mutate destination, displayed week or canonical Task data. Appearance controls exist only in Settings, and the existing navigation-to-Settings behavior has already dismissed any Planner/History Task workspace before the user can operate them; v1.0.6 does not change that workspace lifecycle.
6. No header sun/moon icon, keyboard theme shortcut, context-menu theme item, Planner quick switch or duplicate appearance list is introduced.

Browser tests assert that the Theme selector and Appearance segmented control exist in Settings and are absent from Planner/header/History/Task workspace.

#### v1.0.6 theme build/source layout

The implementation may choose filenames consistent with the repository, but ownership must remain this small and explicit:

- one presentation module owns `ThemePreset`, `AppearanceMode`, guards, storage keys and the exhaustive theme registry;
- one shared theme-authoring module owns the Jig product-local token map;
- one source per Jig/Astryx/community preset defines or extends a `DefinedTheme`;
- generated theme JS/CSS/declarations remain compiler-owned and are never hand-edited;
- one inline JigLogo component owns in-application wordmark geometry;
- `styles.css` remains composition-only and imports all built theme CSS before feature composition rules.

There is no Theme DTO, ViewModel, repository, service, command or projection layer.

#### v1.0.6 verification matrix

Permanent verification must cover the complete Cartesian behavior without relying on manual visual inspection alone:

1. **Theme registration/build:** all 13 registry entries resolve to a built theme with the expected `data-astryx-theme` name; every authored source passes pinned CLI `theme build --check`.
2. **Forced modes:** each of 13 presets × Light/Dark verifies representative surfaces, product-state aliases, status families and logo semantics.
3. **System mode:** each of 13 presets is exercised under emulated OS Light and OS Dark with `data-theme` absent and computed colors changing accordingly; at least one test changes the emulated OS scheme live without remount/reload and proves the selected family and application state remain unchanged. No JavaScript-resolved third mode is accepted.
4. **Detailed state coexistence:** representative fixtures verify selected+focused, selected+priority and drag+priority without losing either meaning.
5. **Responsive width:** verify 1440, 1168, 1167, 1024, 900, 800, 600 and 390 widths for History/Settings and separately verify Settings 2→1-column reflow at the existing semantic breakpoint.
6. **Reminder:** with a stubbed browser Notification constructor, visible/hidden and focused/unfocused due reminders all invoke Notification and never render a reminder Toast; denied/default/unsupported states do not claim delivery; repeated checks do not duplicate a successfully delivered key.
7. **Placement:** only Settings contains Theme/Appearance controls.
8. **Architecture:** production CSS/components contain no community/Jig raw palette literals outside governed theme sources/assets, no theme-name branches in feature code, exactly one root Theme owner, and no private Astryx selectors/custom properties.

#### v1.0.6 traceability

| Functional requirement | Technical solution |
|---|---|
| JIG-106-FR-01 | JIG-106-SD-01 |
| JIG-106-FR-02 | JIG-106-SD-02 |
| JIG-106-FR-03 | JIG-106-SD-03 |
| JIG-106-FR-04 | JIG-106-SD-04 |
| JIG-106-FR-05 | JIG-106-SD-05 |
| JIG-106-FR-06 | JIG-106-SD-06 + §6 |
| JIG-106-FR-07 | JIG-106-SD-07 |

### 5.7 Drag, accessibility and copy discipline

Use one dnd-kit drag owner around the seven Planner dated sections across desktop and narrow/mobile: one sortable task ID, dated droppables including empty dates, and exact target index. The sortable Task-card element itself is the pointer source so dragging can begin anywhere on ordinary card surface. Do not create a title/body-only handle. Checkbox/menu/reference/form controls remain genuine interactive descendants and must be rejected by pointer activation; their ordinary control behavior remains independent. Do not enable Astryx List `createReorderable` on the same rows.

Keyboard Move up/Move down remains available on desktop and narrow layouts. Completion, Task selection, reference actions and overflow controls must not initiate dragging.

Production copy must not expose design/meta explanations such as “selected date view”, “Today is a shortcut”, “Your ordered plan”, “full available canvas”, or “seven fluid day tracks”. The interface communicates these facts through layout and controls.

Presentation uses consistent spacing/density, accessible focus distinct from selection, restrained priority signaling, text/icon status, no hover-only essential action and reduced-motion compliance. Jig CSS may own only the header grid, seven-track Planner geometry, narrow composition, drag/drop state, Task-card accent and other product-specific wrappers; no `!important`, private Astryx selectors/custom properties, or internal DOM coupling.

## 6. Browser reminders

A reminder is optional HH:mm on a scheduled date. Reminder eligibility remains browser presentation behavior over canonical Tasks; it does not become a Task status, shell scheduler or persistence workflow.

### 6.1 Eligibility and bounded recheck lifecycle

While Jig is open, the browser reminder monitor evaluates outstanding Tasks using the device's local civil date/time every **30 seconds**. It also performs an immediate check on mount and may recheck on window focus and document visibility changes. Those events exist only to recover promptly from browser timer throttling/suspend; **visibility and focus never choose a delivery channel**.

A Task is eligible only when:
- it is outstanding;
- `scheduled_date` is the browser's current local civil date;
- `reminder_time` is non-null;
- its derived local due instant is not before the current app session's start;
- its due instant is at or before the current check time; and
- its device-local delivery key has not already been marked delivered.

The existing session-start rule is retained: opening Jig after a reminder's time does not replay stale reminders from before the session. This prevents launch floods and matches the functional promise “while Jig is open”.

### 6.2 Single browser/OS delivery channel

The only reminder delivery channel is the browser Notification API.

1. If the browser does not expose Notification, no delivery is claimed.
2. If `Notification.permission !== "granted"`, no notification is created and the delivery key remains undelivered.
3. When permission is granted, call:
   ```ts
   new Notification("Jig reminder", {
     body: task.title,
     tag: deliveryKey,
   });
   ```
   for an eligible reminder regardless of `document.visibilityState` and window focus.
4. Mark the delivery key only after construction succeeds.
5. If construction throws, leave the key undelivered so a later bounded check can retry while the reminder remains eligible.

There is no Astryx Toast fallback, no duplicate Toast + Notification delivery, and no branch that prefers in-app presentation while visible. Ordinary persistence/synchronization failures continue to use their existing durable application feedback; removing reminder Toast does not remove Banner-style operational feedback.

### 6.3 Permission ownership

Notification permission is requested only from an explicit Settings action. `browser-notifications.ts` remains the narrow browser capability adapter that reports exactly `unsupported | default | granted | denied` and invokes `Notification.requestPermission()` only in response to that user action.

Startup, page load, reminder polling and Task creation/editing must never request permission implicitly. Settings reflects the browser's current permission state honestly and refreshes it after browser focus changes as it already does.

If permission changes from default to granted while a same-session reminder is already due, the next bounded reminder check may deliver it; no extra event bus or cross-component notification service is required.

### 6.4 Duplicate suppression and rollover

Use one device-local delivery key:

```text
task ID + scheduled date + reminder time
```

The browser Notification `tag` uses the same key where supported. Local suppression remains best-effort presentation bookkeeping and is not canonical state, SQLite authority, HTTP protocol or Git-exported data.

- successful notification → mark delivered;
- denied/default/unsupported → do not mark;
- constructor failure → do not mark;
- completion → Task is no longer eligible;
- editing date/time → changed tuple produces the new key;
- daily rollover changes `scheduled_date` while preserving `reminder_time`, therefore the rolled-forward reminder has the new date key.

Old local keys may continue to be pruned by scheduled date. Failure to persist suppression may permit a duplicate browser notification on a later check, but must never affect Task state.

### 6.5 Explicit non-goals

v1.0.6 does not add a push sender, service worker notification daemon, persistent OS scheduler, server-side notification queue, background browser requirement, mobile push contract or guarantee when Jig/browser is closed or the machine sleeps. Delivery remains best effort while the UI is running, through the browser/OS capability the user explicitly permitted.

## 7. Repository-contained data, automatic Git sync and recovery

### 7.1 Data ownership and Git integration boundary

The selected repository is the **only configured data home**. Jig's operational SQLite database remains under `<repo>/.jig/local/`; deterministic portable task records are represented through the repository adapter for Git synchronization.

The application-level contract is intentionally independent of Git topology:

- Jig owns the canonical Task state, SQLite durability, portable Jig snapshot format, automatic synchronization scheduling and coarse sync outcome.
- Git owns repository acquisition, branch/ref/worktree mechanics, signing and identity policy, remotes/credentials, history and reconciliation.
- The repository adapter may use an isolated branch/ref/worktree or another Git-native mechanism when necessary to guarantee that unrelated repository content is never staged, committed, rewritten or pushed. That choice is private to the adapter and must not appear as Jig domain state, user configuration, migration workflow or UI terminology.
- Jig never modifies the user's global or repository Git policy to make synchronization work.
- A repository with no usable remote remains a fully usable local Jig installation and reports `local-only`.

Existing valid Jig portable data in the selected repository is continuity authority for a fresh local installation. Obtaining, cloning, moving or reorganizing the repository is done with ordinary Git/filesystem tooling; Jig simply installs against the resulting existing checkout and adopts valid Jig data it finds there.

### 7.2 Portable snapshot format

`format.json` includes a version discriminator and a UUID **dataset_id**, created once at first initialization and stable on every replica. Recurrence is a product-driven portable-contract extension, so v1.1 recurrence advances the portable format to **version 2**. Every task remains `tasks/<uuid>.json` using exactly the canonical Task fields in §4, including nullable recurrence membership/occurrence date. Each recurrence rule is `recurrences/<uuid>.json` using the canonical `RecurrenceSeries` fields/pattern. Both trees use sorted key order, UTF-8, normalized newlines and strict date/instant formats. No SQLite binary, Git credentials, device-local reminder-delivery receipts, secrets, private system paths, temporary files or browser state enter commits. Completed and unfinished tasks are both included.

Portable-format v1 remains an accepted upgrade input: it contains Tasks only and is interpreted as every Task having null recurrence fields with no recurrence-series records. After canonical adoption/migration, the next export emits format v2. A v2 snapshot is valid only when every non-null Task recurrence reference resolves to exactly one recurrence record and no duplicate `(recurrence_series_id, recurrence_occurrence_date)` pair exists.

The portable tree is a **complete snapshot**; every file path ID matches its embedded ID; duplicate task IDs or missing/duplicate active positions invalidate the entire import. Once the repository integration boundary presents a complete candidate snapshot, Jig validates it before adoption. Its Task membership is then exact: a Task present in the previously adopted dataset but absent from the newly adopted snapshot is deleted locally in the same transactional import. A missing file in an arbitrary, incomplete or unvalidated worktree is **not** a deletion signal. User deletion is therefore represented naturally by absence of `tasks/<uuid>.json` in a later complete snapshot; no tombstone file or deleted-state record is introduced. Jig never interprets partial Git merge state or repository topology as planning data.

### 4.3 Daily rollover lifecycle

Daily rollover is owned by the planning core + service shell, not the browser.

Core operation:

```ts
rollForwardOutstanding(
  tasks,
  currentLocalDate,
  updatedAt,
): { tasks, moved_task_ids }
```

Rules:
- select outstanding Tasks with `scheduled_date < currentLocalDate`;
- sort selected Tasks by source `scheduled_date` ascending, then source `position`;
- move all selected Tasks directly to `currentLocalDate`;
- place them before Tasks already scheduled for `currentLocalDate`;
- preserve relative order within both groups;
- rewrite destination positions contiguously from zero;
- compact each affected source date;
- preserve Task id/title/context/priority/reference/note/reminder time;
- update `scheduled_date` and `updated_at` for moved Tasks;
- do not mutate completed Tasks;
- no intermediate per-day history is created when catching up after multiple missed days.

Shell lifecycle:
1. run rollover once during service startup before normal planning state is served;
2. maintain one timer for the next local civil-day boundary;
3. at the boundary, execute one SQLite transaction applying the pure core result;
4. increment SQLite revision once when at least one Task moved;
5. mark portable state dirty so the existing sync worker exports/synchronizes it;
6. reschedule the next day-boundary timer;
7. before serving canonical planning state or accepting a Task mutation, perform an idempotent catch-up check so suspend/sleep/timer delays cannot leave stale dates visible.

HTTP command admission order is strict:
1. `ensureCurrentDayRollover()`;
2. read post-rollover current revision;
3. compare `expected_revision`;
4. return 409/refetch if stale;
5. only then execute the requested Task mutation.

Do not validate `expected_revision` first and perform rollover afterward.

The already-open browser must also revalidate canonical state across a local-day transition. The UI keeps the last observed local civil date and:
- schedules a recheck for the next local day boundary;
- rechecks on `focus` and `visibilitychange`;
- when the observed civil date changes, calls the existing canonical-state refresh path;
- if the displayed week was the week containing the previous observed local date and the day boundary enters a new week, advance `displayedWeekStart` to the week containing the new current date; otherwise preserve the user's viewed week;
- preserves an explicitly selected historical/future date;
- refreshes the Task array used by Planner, History where relevant, and the reminder monitor without a manual user action.

If rollover makes the browser's `expected_revision` stale, normal HTTP 409/refetch behavior applies. Do not create a special rollover transport protocol.

A Task's reminder time remains the same local clock time while its scheduled date changes, so the reminder naturally applies to the new rolled-forward date.

### 7.3 Write and automatic synchronization loop

**On each UI mutation:** validate the canonical command; in one SQLite transaction apply Task state and increment the durable local revision/dirty marker. Return saved state to the UI immediately on commit. Do not wait for Git or network.

**Export worker:** coalesce rapid local mutations, read one consistent SQLite state and deterministically regenerate the portable Jig snapshot. The worker asks the repository adapter to synchronize that snapshot. It does not contain Git topology logic and does not expose branch/ref/worktree mechanics to the rest of Jig.

**Repository adapter:** perform only the minimum Git operations needed to synchronize Jig-owned portable records while guaranteeing that unrelated repository content is untouched. The adapter must not modify user Git configuration, signing policy, identity, credentials or repository organization. Machine-generated Jig synchronization commits must not fail merely because the user's ordinary commit-signing policy is incompatible with Jig's synthetic synchronization identity; solve that at the individual adapter invocation boundary without changing persistent Git configuration.

The planning/domain layers receive only these outcomes:

- **Local only:** no usable repository transport is configured; local Task mutations and portable export continue. The compact UI status remains labeled `Local only` but uses the restrained success family because local durability is healthy; it must not be visually grouped with unknown status or mislabeled as repository-synchronized.
- **Pending / retrying:** export or synchronization has not completed yet.
- **Synchronized:** the latest portable Jig snapshot has synchronized successfully.
- **Sync issue:** synchronization cannot currently complete. Preserve SQLite/local Jig data; Git diagnosis/reconciliation remains external.

Retry/backoff may remain bounded and automatic, but Git error categories, ancestry, merge bases, branch divergence and conflict states do not become Jig workflow. When the selected repository exposes a valid complete Jig snapshot, Jig may validate/adopt it transactionally without modelling how Git produced it.

**Guarantee:** successful SQLite save is immediate local durability; portable export and Git synchronization are eventual and independent. Git failure cannot turn a successful Task save into a failed Task operation or corrupt installation.

### 7.4 Existing-data adoption, restore and safety

On installation, inspect the selected existing repository for a complete valid Jig portable snapshot. If one exists and no compatible SQLite database is present, initialize SQLite from that snapshot transactionally. If compatible SQLite already exists, preserve it and verify dataset compatibility without implicit destructive replacement.

There is **no Jig repository-migration subsystem**. To move/use Jig elsewhere, the repository is cloned/moved by Git/filesystem tooling and Jig is installed against that resulting checkout. Existing valid Jig portable data is then adopted through the same installation path.

Never leave a partially initialized Git state that a subsequent Jig installation interprets as valid data. The first observable Jig portable state created by a fresh installation must itself satisfy the portable snapshot contract. For v1.0.1, the installer/adapter must also recognize the exact non-data bootstrap residue produced by the v1.0.0 failed-install path and recover only when that state is unambiguously Jig-created and contains no user Jig data; unknown malformed states remain non-destructive sync/install errors.

When a complete candidate Jig snapshot is presented, validate the entire snapshot before changing SQLite and adopt it in one transaction. Validation/adoption failure leaves prior SQLite state intact. Git history/topology reconciliation is never attempted by Jig.

### 7.5 Failure truth table

| Failure | Canonical state | Operator-visible outcome |
|---|---|---|
| SQLite transaction fails | No change committed | Save failed with retry, never fake success |
| Browser closes | SQLite already holds accepted saves | Service keeps exporting/syncing |
| Bun/service restarts mid-operation | SQLite rollback plus persisted dirty revision | Resume interrupted export or import idempotently |
| Repository adapter write/commit fails | SQLite remains authority | Saved locally; synchronization retrying or sync issue |
| Git commit succeeds but metadata update fails | Exported data recoverable from Git head | Reconcile snapshot/revision at restart |
| No usable repository transport | Local database and portable Jig data remain intact | Local-only badge/status |
| Repository transport/push failure | SQLite and local exported records intact | Automatic retry with backoff; persistent failure becomes generic sync issue |
| Candidate canonical snapshot invalid | Previous SQLite state intact | Refuse adoption and report generic sync issue; repository correction remains external |
| Selected personal repo has unrelated staged/dirty files | No impact on those files | Jig auto-sync continues through the isolated repository adapter |
| Installer fails during setup | Existing user data/branch remains | Clear failure and idempotent safe rerun |
| Uninstall | Personal repo data preserved | Service/binary removed, data retained by default |

### 7.6 Resource/resource-ownership contract

Use one serialized export/sync loop in the Bun service with a durable dirty marker and the fixed timers/backoff in §7.3. Never launch a separate perpetual Git daemon, background browser tab, job-queue server, or per-task worker. On the project reference Linux test host, after 60 seconds of warm-up with no browser connected, the service must remain at **≤128 MiB RSS** and **≤1.0% of one CPU core averaged over 5 minutes**. With the service already running, `jig` must hand off a ready local UI URL within **500 ms p95 over 20 runs** excluding external browser startup; from a stopped service, loopback HTTP readiness must occur within **2 seconds p95 over 20 runs**. A platform-specific exception requires measured evidence and design review rather than silently weakening these thresholds.

## 8. Security and trust boundaries

Run HTTP only on `127.0.0.1` at the configured port; no publicly bound listener and no external login. Require same-origin requests and reject cross-origin mutation attempts. Use the per-service-start 256-bit write token defined in §3.2 for state-changing requests, with no permissive CORS. Do not assume “localhost” alone prevents cross-site request abuse.

All external input (HTTP, imported JSON, Git configuration, user-selected repository path and installer arguments) is untrusted. Check canonical Task formats and commands at the admission boundary. Use prepared SQL; invoke Git with an argument-array subprocess, never interpolated shell commands. Validate app-managed paths stay inside the configured data root. Never execute Task reference strings, clone arbitrary task references, or expose local filesystem contents through a task URL. Avoid logging personal titles, notes and references. Keep Git credentials in the user's normal Git/SSH mechanism, never in portable JSON.

The data directory belongs to the user. A Git remote is optional; source/public repository and personal data repository must never be confused. Imported snapshots may carry personally sensitive content and must be handled as user-controlled private data.

## 9. Source module ownership (proposed minimal layout)

~~~text
src/
  core/
    task.ts                 canonical Task and operations
    planning.ts             ordering, date selection, completion rules
  shell/
    http.ts                 same-origin admission and command dispatch
    sqlite.ts               schema, query, transactional mutation
    git.ts                  isolated repository adapter, export/synchronization, validated snapshot admission
    main.ts                 daemon startup, sync loop and static UI serving
scripts/
  install.sh                 single non-root installation and configuration
  jig                       local CLI launcher and service control
ui/
  src/
    app.tsx                 AppShell, destination state, one root Theme and selected appearance state
    appearance.ts           ThemePreset/AppearanceMode types, guards, local persistence and exhaustive registry
    themes/
      product-tokens.ts     one palette-independent Jig product semantic alias map
      *.source.ts           Jig, six Astryx-wrapper and six community theme authoring sources
      built/                compiler-owned generated theme JS/CSS/declarations
    jig-logo.tsx            one canonical inline application wordmark geometry using semantic brand tokens
    planner.tsx             shared Planner state + responsive desktop/narrow composition
    planner-header.tsx      centered week range + Previous/Today/Next + desktop/mobile header zones
    week.tsx                desktop seven-date tracks and cross-date drag composition
    task-editor.tsx         Task workspace form content for create/edit
    task-workspace.tsx      one existing/create editable workspace state rendered as desktop Drawer or narrow BottomSheet
    browser-notifications.ts narrow Notification capability/permission adapter
    reminder.tsx            browser due check + browser Notification delivery
    theme.css               raw Jig default-theme palette primitives only
    styles.css              Jig-owned product composition/geometry only
tests/
  core/
  persistence/
  sync/
  browser/
docs/
~~~

Paths are a suggested semantic decomposition, not a mandate to manufacture separate abstractions where a small cohesive module is sufficient. Do not add DTO files, domain-to-transport mapper stacks, repository/service classes, a general component framework, or generic command handler infrastructure. Every module has one present owner, and future decomposition is justified only by a real second responsibility.

## 10. Requirement-to-design traceability and acceptance

### v1.0.4 corrective requirement traceability

| Requirement | Technical ownership | Required evidence |
|---|---|---|
| JIG-104-FR-01 card-body drag | §5.7 one dnd-kit Sortable with row ref + body handleRef + 5px PointerSensor threshold | Real pointer drag from card body; ordinary click still selects; checkbox/menu/reference do not initiate drag |
| JIG-104-FR-02 exact current day | §5.6 Today identity | Only exact local date gets today treatment across week navigation |
| JIG-104-FR-03 distinct visual semantics | §5.6 + JIG-106-SD-04 | Today temporal role, selected Task information role, drag/focus active-theme accent and priority/status roles remain distinct in every selected theme and mode |
| JIG-104-FR-04 outside dismissal | §5.6 content-owned dismissal | Blank Planner/History interaction closes; workspace/menu/dialog interaction does not |
| JIG-104-FR-05 stable header geometry | §5.3 + §5.6 header geometry | Planner/History/Settings header bounding heights are equal at the same viewport |
| JIG-104-FR-06 complete Task menu | §5.6 Task menu command ownership | Required actions invoke existing canonical commands; priority edit does not reorder |
| JIG-104-FR-07 one editable workspace | §5.4 TaskWorkspaceState | Existing Task opens full editable draft directly |
| JIG-104-FR-08 full Add form | §5.4 unified editor | Add and existing Task expose the same field hierarchy |
| JIG-104-FR-09 responsive draft continuity | §5.4/§5.5 shared state, Drawer/BottomSheet adapters | Breakpoint change preserves exact draft/workspace state |
| JIG-104-FR-10 healthy Local only | §5.6 operational-status semantics | Local only uses success family while retaining its distinct label |
| JIG-104-FR-11 date-header Add | §5.3/§5.5.1 dated-section owner | Compact per-date + uses explicit date; no lane-footer Add |
| JIG-104-FR-12 content-driven lanes | §5.3/§5.5.1 Planner geometry | Equal widths, independent heights, empty drop target remains usable |
| JIG-104-FR-13 no selected-day state | §5.2 PlannerState + §5.5 responsive composition | No selectedDate/selectDate/DateStrip/selected-day projection remains |
| JIG-104-FR-14 derived global Add date | §5.2 pure defaultAddDate + §5.4 create | Derived weekday-matching date is correct and editable before Save |
| JIG-104-FR-15 full weekday labels | §5.3/§5.5 explicit English long-weekday formatter | Monday–Sunday render in full; no browser-locale abbreviation substitution |
| JIG-104-FR-16 reduced chrome + explicit top navigation | §5.3 + §5.5.2 reduced-chrome/iconography ownership | Planner/History/Settings stay together on right; open lanes use whitespace/hairlines rather than panel chrome; Task cards remain restrained discrete surfaces |

| Requirement | Technical ownership | Required evidence |
|---|---|---|
| JIG-FR-01 quick create | Task creation through the unified Task form | Originating date/defaults are pre-populated; Title and Date are required; optional fields remain optional |
| JIG-FR-02 navigate weeks | Pure Planner calendar helpers + header UI | Previous/Next shift displayed week by seven days; Today restores the current week; no date-selection state exists and no Task write occurs |
| JIG-FR-03 within-day order | dnd-kit + core move + SQLite transaction | Reorder persists through reload/restart |
| JIG-FR-04 cross-day move | Dated droppables + core move | Exact target position, no duplicate ID; empty day works |
| JIG-FR-05 priority insertion | Pure insert function | Mixed-list insertion preserves all earlier relative order |
| JIG-FR-06 priority change | Edit operation | Only priority changes; position unchanged |
| JIG-FR-07 unrestricted edit | Astryx edit surface + core update | All optional fields and date edited without workflow gate |
| JIG-FR-08 completion/reopen | Core transition + timestamp + DB | Date-scheduled completion, history query, reopen same ID |
| JIG-FR-09 daily rollover | Pure core rollover + one SQLite transaction + service day-boundary/catch-up trigger | Earlier outstanding Tasks physically move to the current date; desktop and narrow Planner show the same moved Task in the current bucket; completed Tasks never move |
| JIG-FR-10 reminder delivery | JIG-106-SD-06 + §6 one browser reminder monitor + browser Notification API | Granted permission => one browser/OS Notification regardless visibility/focus; no reminder Toast; one delivery key suppresses duplicates; no closed-app guarantee |
| JIG-FR-11 external context | Reference open/copy UI | Link/path accessible; no source-content import |
| JIG-FR-12 honest outcome | HTTP/SQLite/repository-boundary outcome and UI | Failed local save or repository sync never rendered as success |
| JIG-FR-13 responsive continuity | One PlannerState + one TaskWorkspaceState; Drawer/BottomSheet are presentation adapters | Narrow/wide reflow preserves displayed week, selected Task/workspace state and unsaved draft |
| JIG-FR-14 local retention | SQLite inside configured personal Git repository | All Task fields survive service restart, checkout/re-import restores complete state |
| JIG-FR-15 installer | scripts/install.sh, pinned runtime, user service | Single invocation configures source install, repo data area and launcher |
| JIG-FR-16 data locality / continuity | selected repository `.jig/local` plus portable repository snapshot through the adapter | Existing valid Jig data is adopted on install; no separate migration subsystem |
| JIG-FR-17 desktop availability | jig launcher + systemd --user | jig opens existing local service or starts it; restart survives |
| JIG-FR-18 automatic Git sync | durable dirty revision + isolated repository sync adapter | Local save immediately, background export/synchronization without user action |
| JIG-FR-19 safe coexistence | thin repository adapter with private isolation mechanism | Unrelated staged/unstaged user content unchanged; generic sync issue never becomes planning/domain conflict state |
| JIG-FR-20 low-friction idle | one Bun service, bounded timers/backoff | Measured low idle CPU/RSS and responsive reopen |
| JIG-FR-21 delete | Core delete + SQLite transaction + complete-snapshot export/import | Confirmation precedes mutation; row/file disappear; outstanding positions compact; Git round trip preserves deletion |
| JIG-FR-22 appearance | JIG-106-SD-02 through SD-05 + SD-07 | One 13-preset registry + independent System/Light/Dark mode fully re-theme all governed surfaces/states and in-app branding from Settings only, without Task/Git mutation |
| JIG-FR-23 bounded recurrence | §4.2.1 recurrence core + schema v3 + portable format v2 | One shared series owns recurrence configuration; materialized Tasks own occurrence-local content/lifecycle; Repeat performs membership reconciliation from the invoking immutable slot without rewriting retained siblings; Stop repeating keeps the invoking Task, preserves completed History and removes every other outstanding series occurrence |
| JIG-110-FR-30 secondary heading ownership | v1.1 SD-40 + UI solution | Application header owns the sole History/Settings title+subtitle; body-level duplicate heading is removed |
| JIG-110-FR-31 user-level continuity/synchronization | structured repository status above + v1.1 SD-41 | Technical local/remote truth remains structured once; primary UI derives minimal planning-data-home/local-safety/continuity language while exact Git/service/database facts remain secondary diagnostics |
| JIG-110-FR-24 cross-installation continuity | v1.1 SD-30 + SD-41 | Four normal outcomes (Local only / Synchronized / Adopt remote / Push local) plus exactly six bounded edge cases SYNC-E1..SYNC-E6. One pure classifier owns the decision; shell/native adapters supply effects only; unsafe states preserve both boundaries and stop rather than adding reconciliation. |

### 10.1 Test boundaries

**Core tests:** Exhaustive representative priority mix, insertion at both ends, same-day and cross-day movement, empty destinations, cancellation/no mutation, rank compaction, priority changes, daily rollover ordering/date mutation, multi-day catch-up, completed-task non-rollover, reminder preservation, completed-task rescheduling, reopening, outstanding/completed deletion, recurrence enumeration/reconciliation and edge dates including month/year boundaries. Recurrence coverage includes multiple weekdays, all-seven daily pattern, every-four-weeks cadence, inclusive end date, monthly 28/29/30/31 behavior, rollover without cadence shift, occurrence-only completion/move/delete/edit, shared-series visibility from every occurrence, Repeat membership reconciliation that preserves retained sibling IDs/content, creation-time-only copying into new slots, no bulk content propagation, and Stop repeating that preserves completed History while removing every other outstanding series occurrence including rolled/overdue siblings.

**SQLite integration:** One failed transaction rolls back every affected position/date; uniqueness and completeness checks; restart with WAL; task query by scheduled and completion dates; migration from a fresh empty database; corrupted input rejected before persistence.

**Repository/Git integration:** Use existing-repository fixtures with unrelated dirty/staged files and normal developer Git configurations, including commit signing enabled with no Jig key. Verify automatic export/synchronization touches only Jig-owned portable data; user Git configuration is unchanged; installation/retry survives synchronization failure; existing valid Jig data is adopted; the exact v1.0.0 empty-bootstrap residue recovers safely; unknown malformed states are non-destructive; ordinary repository content remains untouched.

For v1.1, exercise only the governed SD-41 matrix: ordinary Desktop → Android → Desktop and Android → Desktop → Android round trips plus SYNC-E1..SYNC-E6. Prove stale-base export is prevented, rejected/ambiguous pushes re-observe before another write, auth/transport failure preserves local work under existing bounded retry, restart/bookkeeping repair cannot overwrite a newer SQLite revision, and unsafe/incompatible remote state is non-destructive. Do not expand the suite into general Git repair or semantic planning-data merge behavior.

**Browser interaction:** Real Astryx components and dnd-kit are tested together using Playwright: Planner startup on today/current week; centered one-row Previous/range/Next/Today controls; exact seven-day Previous/Next behavior; Today reset; Jig-home state preservation; no desktop sidebar; explicit desktop Planner/History/Settings navigation with correct active state; reduced-chrome open seven-track board with full weekday labels and per-date +; mobile Planner/History/Settings hamburger popover with no drawer and seven stacked dated sections; same-day whole-card drag, cross-date drag and empty-day drop; persisted daily rollover visible in both responsive Planner compositions; open-browser local-midnight revalidation; full-card drag overlay; Escape cancel; Task checkbox/link/workspace non-interference; keyboard/touch move alternatives; desktop Drawer overlays without narrowing the board; Drawer↔BottomSheet responsive switching with unsaved editor state preserved; confirmed/cancelled deletion; long-list scrolling; the JIG-106 13-theme × Light/Dark/System matrix and semantic-state/contrast assertions; theme-aware inline wordmark; continuous History/Settings width on both sides of 73rem; Settings-only Theme/Appearance controls; visible/hidden and focused/unfocused browser Notification delivery with no reminder Toast; permission default/denied/unsupported behavior; duplicate suppression/catch-up; and durable save-error visibility.

**Installer/service:** Non-root one-script setup in both supported target modes: an existing local repository via `--repo`, and a repository URL cloned by Git into a new/empty checkout via `--repo-url` + `--checkout`. Verify both modes converge on the same repository-validation/setup path, plus exact target selection, idempotent rerun, invalid target refusal, existing-data adoption, failed-install retry, launcher/service restart and auto-sync while the browser is closed. Repository migration/reorganization remains outside Jig.

**Security:** Loopback-only listener, same-origin/token checks, no arbitrary task-reference execution, no shell invocation via Git parameters, path containment and no task data in public source.

### 10.2 Technical acceptance gate

The design is closed at the **architecture and dependency selection** level, not proven implemented. Release/implementation acceptance requires the tests above to pass against the **actual pinned package versions**, plus real one-script installations through both `--repo` and `--repo-url` + `--checkout`, a working `jig` command, enabled service, repository-contained SQLite/JSON, automatic repository synchronization while the browser is closed, safe unrelated working-tree coexistence, generic repository-failure behavior, and successful resumption after the repository is reconciled externally.

If the Astryx ListItem/dnd-kit integration fails in the browser, fix the smallest view composition while keeping Astryx tokens and one drag owner; do not import another whole UI kit or silently broaden dependencies. If exact pinned versions cannot install/build, document the proven incompatibility and resolve the single affected dependency through explicit design review rather than silently upgrading all packages.

## 11. Explicitly deferred capabilities

Independent phone installation, native mobile Git/process/filesystem integration, application-level trash/soft-delete/undo/restore, background/push notifications, Order WorkItem creation, automatic project-task synchronization, metrics/dashboard, team collaboration, subtasks, duration estimation and general workflow constraints are excluded. Git history, branch, merge and conflict reconciliation are explicitly **outside Jig's domain**, not deferred Jig features. The canonical Task format and repository record identity intentionally leave room for later extension, but none of these capabilities is represented as implemented by this design.

## 12. Decision history and minimality rationale

- **SQLite primary inside the selected personal repository:** Operational queries, atomic multi-item reordering and crash recovery remain simple; only deterministic logical records are Git committed. No user task data is stored by default in the public Jig source repo.
- **One exporter and one importer instead of two live authorities:** SQLite owns local edits; Git versions validated snapshots at explicit synchronization boundaries.
- **Isolation is an adapter responsibility, not an application responsibility:** The repository adapter must guarantee that automatic Jig synchronization cannot touch unrelated repository content. A dedicated branch/worktree may be one implementation technique, but it is not part of Jig's domain, user configuration or lifecycle contract.
- **Automatic bounded Git sync instead of manual export:** Local SQLite saves trigger background commit/fetch/push with safe retries even when the browser is closed; network status is separately visible.
- **Repository boundary instead of a Jig Git state machine:** Jig exports/validates portable snapshots and receives only operational synchronization outcomes. Git acquisition, topology, policy, credentials, history and reconciliation stay with Git tooling and never become Jig domain/configuration/state.
- **Astryx directly instead of copying Order:** Reuses published UI semantics without coupling Jig to software-factory workflows.
- **One proof-gated drag adapter instead of framework layering:** the failed Pangea implementation is removed. Current dnd-kit is the candidate sensor/drop engine behind Jig-owned explicit insertion-slot semantics; it may ship only after desktop and physical-Android proof, and canonical movement remains one move command.
- **Browser-side reminder monitor instead of background infrastructure:** one browser Notification channel while Jig is open and permission is granted, independent of visibility/focus, with no Toast fallback and no closed-app delivery guarantee.
- **One Task and derived views instead of multiple planning objects:** Satisfies all Task semantics without building a project manager.
- **One Planner state instead of Day/Week destinations:** `displayedWeekStart` alone drives both the desktop seven-column board and narrow seven-section stack; responsive composition never creates another planning authority or selected-day subview.
- **Header composition instead of SideNav:** AppShell remains the shell but omits SideNav/auto mobile drawer; Jig's small topNav composition owns the approved home/date/actions/navigation hierarchy using public Astryx leaves.
- **Drawer on desktop, BottomSheet on narrow:** one TaskWorkspaceState is rendered through the public Astryx surface appropriate to the layout; presentation changes without draft/state duplication.

**Implementation planning can now be derived from this document and [the UI solution](../design/ui-solution.md).** The plan must preserve the boundaries above, prove the specified acceptance gates, and must not interpret non-goals as implied features.


## v1.1 binding architecture

The detailed normative solution contracts are [JIG-110-SD-01..41](v1.1-mobile-technical-solution.md). They are canonical for v1.1 and supersede affected v1.0.x implementation choices. In particular:

- runtime has explicit bootstrap/configured modes; missing config is bootstrap, malformed config remains an error; both modes render inside the same canonical Jig application frame, with onboarding as a distinct body state rather than a standalone technical setup page; the governed v1.1 references own the user-visible composition: Android/narrow uses the bounded single-column flow, desktop uses the stable value/context region plus bounded setup pane, and successful setup transitions directly to Planner without persisted onboarding progress; Astryx remains reusable component authority;
- Linux and Android share one governed **Jig Desktop & Mobile** public GitHub App registration and the same intent-level onboarding contract. One Connect GitHub repository action starts automatic authorization/access/acquisition/adoption orchestration; provider-owned consent and repository selection when genuinely required are the only normal user interruptions. Linux additionally supports the genuine choice of an existing local repository;
- Android is a committed Capacitor 8 shell using the same React UI/core/protocol contracts, package ID `com.pontivus.jig`, private app-owned repository storage and F-Droid-compatible FLOSS dependencies;
- root `package.json.version` is the sole release-version authority; Android `versionName` equals it and `versionCode = major*1_000_000 + minor*1_000 + patch`;
- canonical SQLite semantics move to one asynchronous TypeScript persistence owner with a Bun driver on Linux and a narrow AndroidX bundled-SQLite native driver on Android;
- Android Git uses the selected isomorphic-git/native-filesystem/native-HTTP adapter only after the mandatory automated/emulator feasibility gate; the same transport is physically confirmed in the final device-certification wave, and failure at either gate returns to design review rather than silently adding another transport;
- reminders use one pure due predicate, one UI clock, browser service-worker delivery and Android local scheduling with exact typed outcomes; notification side-effect state is non-canonical;
- narrow header is one sticky application region with two Planner rows; mobile rows are >=56px, ordinary touch targets are >=48×48px with deliberate separation, and the navigation menu remains a popover but its trigger/rows are touch-sized rather than compact desktop controls;
- physical Android use rejected the Pangea owner under the v1.1 hard gate. The replacement uses one proof-gated current dnd-kit adapter only if it passes desktop + physical Android validation; a dedicated grip targets N+1 explicit before/between/after insertion slots per date, Task body remains normal scroll/open content, and every terminal path clears drag/overlay state;
- bounded recurrence remains one pure series/occurrence owner, while the UI integrates Repeat into the one complete Title → Date → Repeat → Reminder → Priority → Context → Reference → Notes form with progressive disclosure governed by the v1.1 mobile/desktop references. On mobile the same BottomSheet remains normally scrollable under expanded Repeat controls, weekday targets wrap rather than compress, persistent actions do not cover fields/validation/Notes and IME resize does not make later fields or Save/Cancel unreachable. Existing-Task edit carries an optional recurrence change so ordinary occurrence edits and series reconciliation commit atomically in one transaction/revision; the separate public set_recurrence command is removed after migration;
- History/Settings destination title + subtitle have one application-header owner; their content surfaces contain no duplicate page-heading block;
- repository synchronization follows v1.1 SD-41's bounded audit: one pure FC/IS classifier yields Local only / Synchronized / Adopt remote / Push local / Attention from already-observed facts; Desktop/system-Git and Android/isomorphic-git keep their imperative mechanics separate and do not duplicate policy. SYNC-E1..SYNC-E6 are the complete v1.1 exception set. Existing persistence metadata is reused for crash-safe revision/export truth; no synchronization table, DTO hierarchy, service/repository class stack, Task merge engine or Git merge/rebase/force workflow is introduced. Settings still uses one content-sized sequence: Data & sync → Appearance → Notifications → subordinate/collapsed Diagnostics;
- development APKs are local certification artifacts; F-Droid is the first public Android distribution target; no Google Play/iOS release work is part of v1.1.

The complete FR→SD traceability remains owned by the versioned v1.1 functional/technical documents and the complete v1.1 implementation plan.
