# Jig — technical solution design

**Status:** Corrected binding desktop MVP technical solution, v0.7 (2026-11-16), with the v1.0.1 authority-boundary correction: automatic Git synchronization remains required, while repository acquisition, topology, policy and reconciliation remain Git responsibilities rather than Jig product/application responsibilities.
**Concern owner:** Jig architecture, canonical task representation, persistence, repository integration boundary, UI realization, operation admission, and verification.
**Governing documents:** [Product definition](../product/product-definition.md) and [Planning workbench functional design](../requirements/planning-workbench.md), JIG-FR-01 through JIG-FR-22.
**Scope boundary:** One-script Linux user installation, user-selected personal Git repository as the entire planning-data home, always-available local service, background Git commit/synchronization, responsive desktop UI, no hosted Jig service.

**Foundational authority rule:** For every external integration, identify the authoritative owner first. Jig implements only the minimum interface needed for Jig's product job and must not absorb that external system's configuration, topology, provisioning, migration, reconciliation or policy. For Git specifically, Jig owns deterministic Jig records, automatic synchronization intent and coarse sync outcome; Git owns repository acquisition, branches/refs/worktrees, signing/identity, credentials, remotes, history and reconciliation. A Git isolation technique may exist inside the adapter, but it is not Jig domain, user workflow or configuration.

## 1. Decisions, baseline and user experience

Jig is a date-based personal planner, not a project manager or an Order lifecycle client. **The user chooses an existing personal or organizational Git repository during installation. All authoritative planning data, including the live SQLite database, lives under a dedicated directory inside that selected repository.** The public pontivus-com/jig source code repository contains no personal data and is not a valid default data target.

The normal experience is: run one installer; assign repository; installer configures local application/runtime, a Git-managed data area, the `jig` command and a Linux user service; thereafter `jig` opens the planner or starts its service, saves happen immediately in SQLite, and the repository integration boundary exports and synchronizes deterministic records without interaction in the normal case. User Task operations are never blocked on repository transport. Any repository synchronization failure retains local work and is surfaced only as an operational sync issue; the planning/domain layers never model Git branch topology, divergence, merge bases or conflict reconciliation.

**Authoritative product requirements:** [JIG-FR-01–22](../requirements/planning-workbench.md). This document makes the following technical selections:

| Area | Chosen solution |
|---|---|
| Runtime and service | One Bun 1.4.4 process on Linux, `systemd --user` service, loopback HTTP, no external database or remote service |
| Command and installer | `jig` launcher in ~/.local/bin; `scripts/install.sh --repo /absolute/existing/repo` or `--repo-url URL --checkout /new/empty/path`. URL mode delegates acquisition to Git and then converges on the same selected-checkout installation path. |
| UI | React 19.3.1, TypeScript 7.0.2, Vite 8.3.5; pinned Astryx 0.7.13 with Jig theme derived from Neutral |
| Cross-day drag | `@dnd-kit/react@0.5.3`, one drag owner; Astryx handles visual primitives |
| Live data | One Bun SQLite database at `<selected-repo>/.jig/local/jig.sqlite`; immediate transactional writes |
| Versioned data | Deterministic Task JSON and manifest synchronized through Git inside the selected repository. The adapter may use an isolated Git namespace internally, but branch/ref/worktree lifecycle is an implementation detail confined to that adapter rather than Jig application state or user configuration. |
| Repository sync boundary | Daemon automatically debounces Jig-record export and invokes a thin Git adapter. The adapter is responsible only for synchronizing Jig-owned portable data without touching unrelated repository content and returns coarse synchronization outcomes plus validated Jig snapshots; Git topology, policy, credentials and reconciliation remain external. |
| Notifications | One browser-side reminder monitor: Astryx Toast while visible; browser Notification while hidden/open and permission-granted; no closed-app/background push guarantee |
| Mobile | Narrow mobile-first layout and touch accessibility in desktop web UI; standalone phone installation deferred |

The selected repository's ordinary working state, staged files and unrelated content are **never** touched by Jig's automatic synchronization. The adapter must provide this isolation using the smallest Git mechanism that satisfies the requirement; the application must not model or manage that mechanism outside the adapter.

This is an architecture contract; actual interaction, installation, repository-adapter behavior and resource use still need verification against the exact pinned environment. No unresolved technology choice may be delegated casually to implementers.

## 2. Dependency contract and provenance

The initial dependency set is exact-pinned; no wholesale Order package manifest is copied.

**Production:** react 19.3.1; react-dom 19.3.1; @astryxdesign/core 0.7.13; @astryxdesign/theme-neutral 0.7.13; @stylexjs/stylex 0.19.1 (Astryx peer); @dnd-kit/react 0.5.3.

**Development:** typescript 7.0.2; vite 8.3.5; @types/react 19.3.0; @types/react-dom 19.3.0; @types/bun 1.4.4; vitest 5.0.5; @playwright/test 1.64.1. Use Bun 1.4.4 as the installed runtime; pin it in repository runtime metadata. The exact baseline is a reproducibility selection, not a claim that later packages are incompatible.

Use Bun built-ins for SQLite and spawning Git. Do not add an ORM, repository object abstraction, task mapper/DTO layer, date utility package, notification service, state-management framework, CodeMirror, OpenCode SDK, Tailwind build integration, a StyleX compiler plugin or a second UI toolkit without demonstrated necessity. Astryx's published core and Neutral theme are the foundation; Jig owns one derived semantic theme whose raw Ink/Amber/Paper primitives are centralized in `ui/src/theme.css` and whose public Astryx role mapping lives in `ui/src/theme.ts`. Custom Jig geometry uses a small stylesheet consuming only those semantic roles.

**Verified references:**
- [Order manifest](https://github.com/pontivus-com/order/blob/master/package.json), [runtime pin](https://github.com/pontivus-com/order/blob/master/.bun-version), [application composition](https://github.com/pontivus-com/order/blob/master/ui/src/app.tsx), [UI imports](https://github.com/pontivus-com/order/blob/master/ui/src/styles.css), [theme](https://github.com/pontivus-com/order/blob/master/ui/src/theme.css), [settings composition](https://github.com/pontivus-com/order/blob/master/ui/src/SettingsWorkspace.tsx), [action wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchAction.tsx), [confirmation wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchConfirmation.tsx), and [notice wrapper](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchNotice.tsx).
- [Pinned Astryx core package](https://github.com/meta/astryx/blob/v0.7.13/packages/core/package.json), [AppShell](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/AppShell/index.ts), [List](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/List/List.doc.mjs), [Button](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Button/index.ts), [IconButton](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/IconButton/index.ts), [Dialog](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Dialog/index.ts), [FormLayout](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/FormLayout/index.ts), [TextInput](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TextInput/index.ts), [TextArea](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TextArea/index.ts), [Selector](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Selector/index.ts), [CheckboxInput](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/CheckboxInput/index.ts), [Link](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Link/index.ts), [SegmentedControl](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/SegmentedControl/index.ts), [Toast](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Toast/index.ts), [date input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/DateInput/index.ts), and [time input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TimeInput/index.ts).
- [dnd-kit React quickstart](https://dndkit.com/react/quickstart/) and [multiple-sortable-lists guide](https://dndkit.com/react/guides/multiple-sortable-lists/). The installed/pinned `@dnd-kit/react@0.5.3` package and its TypeScript API are the implementation authority if the unversioned website differs.
- [Bun SQLite API](https://bun.com/docs/runtime/sqlite) and ordinary Git CLI documentation. Git mechanics remain confined to the repository adapter and do not define Task/domain behavior.

### 2.1 Implementation source map

Use the sources below to avoid rediscovery, while preserving Jig's own domain and architecture. **Order is implementation evidence, not a library dependency.** Do not copy Order's WorkItem domain, React Query state architecture, private `Workbench*` component layer, CSS class namespace, or workflow semantics into Jig.

| Jig concern | First implementation source to inspect | What to reuse / learn | What not to copy |
|---|---|---|---|
| Runtime and dependency pins | Order `package.json`, `.bun-version` | Proven React/TypeScript/Vite/Bun/Astryx versions and peer requirements | Order-only packages such as OpenCode, CodeMirror, React Query and Tailwind |
| Astryx CSS/bootstrap | Order `ui/src/styles.css` | Required Astryx reset/core import ordering and semantic body-token usage | Order CSS classes and Tailwind layers; Jig uses only the minimum stylesheet required by its own composition |
| System/Light/Dark mechanics | Order `ui/src/app.tsx` and `ui/src/theme.css` | Theme preference lifecycle, local presentation persistence, System fallback and semantic-token switching | Order-specific color literals, `pontivus-order-theme` key, WorkItem state or toolbar composition |
| Buttons/actions | Order `WorkbenchAction.tsx` + Astryx Button/IconButton public APIs | Exact public props/variants and accessible icon-button labeling | The `WorkbenchAction` wrapper itself |
| Destructive confirmation | Order `WorkbenchConfirmation.tsx` as behavior evidence plus Astryx destructive-dialog API | Modal confirmation semantics, destructive action tone, pending protection | The Order wrapper or repository-disconnect semantics; Jig confirmation owns Task deletion only |
| Persistent feedback/status | Order `WorkbenchNotice.tsx`, Settings composition + Astryx Banner/Toast | Banner-style durable failures versus Toast transient reminders | Order readiness/blocker model |
| Form/editor fields | Order `SettingsWorkspace.tsx` + Astryx TextInput/TextArea/Selector/DateInput/TimeInput/FormLayout | Direct controlled-field usage, labels, validation surface and public component APIs | Order repository/model settings domain |
| Theme selector | Order `app.tsx` + Astryx SegmentedControl | Direct `System | Light | Dark` selector composition | Order destination/navigation state |
| Week/Day rows | Astryx List/ListItem docs | Compact list semantics, density, focus and row presentation | Astryx `createReorderable` on Jig task rows; dnd-kit is the single drag owner |
| Completion | Astryx CheckboxInput | Accessible explicit completion control | Any Order lifecycle/status transition semantics |
| Reference action | Astryx Link/Button | Safe open/copy affordance | Automatic dereferencing or project-content import |
| Cross-date drag | Pinned `@dnd-kit/react@0.5.3` package API, then dnd-kit multi-list guide | One provider, sortable task IDs, dated droppables, drag overlay and exact destination index | A second reorder system or priority-derived drop position |
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
 Browser reminder monitor (toast / Notification)  v
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

Only one Bun process may write the configured SQLite file. Enforce a single active instance for each configured data root. The process has a serialized, bounded synchronization loop; a browser need not remain open for Git operations. UI state is limited to selected date/task, modal draft, transient drag preview and local appearance preference. Theme preference is presentation state and never part of canonical Task or Git-synchronized planning data. Date/week/history views are queries over the same canonical Task set.

**Local HTTP:** bind only to `127.0.0.1`. The default port is **47831**; `install.sh --port <1024..65535>` is the only supported override and persists the chosen value in local configuration. The HTTP API is `/api/v1`; reads return canonical Task values plus the current SQLite revision, and mutations return success only after the SQLite transaction commits. Repository status is exactly `local-only | pending | retrying | synchronized | sync-issue`. The user can continue editing regardless of repository synchronization status.

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

`repository_path` is the existing repository selected at installation and `http_port` is Jig's loopback port. Git remotes, refs, worktrees, signing, identity and credentials are **not Jig application configuration**; they remain Git repository/user configuration and are discovered/used only inside the thin repository adapter where required. Theme preference remains browser-local presentation state.

The browser API serializes canonical core types directly; do not create transport DTO classes or a second Task/command schema.

- `GET /api/v1/tasks` → `{ revision, tasks }`, where `tasks` is the complete canonical Task set.
- `GET /api/v1/status` → service readiness, selected repository path, and one synchronization status from `local-only | pending | retrying | synchronized | sync-issue`.
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

One Task is the sole durable representation of an intended item. Week, day, completed, and history are queries/views of it. Store the fields below in SQLite and the portable JSON files.

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

### 4.2 Operation algorithms

**Create:** Validate title and date; default priority NORMAL. Find the last existing outstanding task on that date whose priority is equal to or higher than the new item's priority; insert immediately after it, otherwise insert at index 0. Preserve all existing items' relative order; renumber only the affected day. Example: HIGH=3, NORMAL=2, LOW=1, find the last item with score >= new score. This is exactly the functional specification's insertion law even in a manually mixed list.

**Explicit drag movement:** Remove ID from source sequence; insert at the indicated target index in target date; when source=target, index means the position in the list **after removal**. Renumber the affected one or two dates. Drag target date and position must be explicit, not derived from priority. Moving to a date using the date editor applies the priority-based initial insertion law instead of a drag-index rule.

**Edit:** Title, note, reference, context, priority or reminder edit keeps date and position unchanged. An explicit date edit removes the task from its original outstanding sequence and inserts into the destination via priority law. Editing a completed task's date preserves completed_at and leaves it outside active ordering.

**Complete:** Set completed_at using the shell's current instant; set position to null and compact the remaining outstanding sequence. No attempt is made to complete the referenced work in Order or any project.

**Reopen:** Clear completed_at; keep scheduled_date, priority and reference; append at the end of the outstanding sequence. No completion history event log is required in v1.

**Delete:** Only after explicit UI confirmation, delete the Task in one SQLite transaction. For an outstanding Task, remove it and compact the remaining positions on its scheduled date to 0..N-1; for a completed Task, delete it without active-order compaction. Increment the normal durable revision. Do not write deleted_at, a tombstone, trash row or delete-event log. Git history, if an earlier export exists, is the only recovery mechanism.

**Read:** Week is seven consecutive local civil dates beginning Monday and shows Tasks on their canonical scheduled dates. Day is the selected date's canonical outstanding sequence plus completed-by-scheduled-date query. Before normal planning reads/commands, the service ensures daily rollover is current, so overdue outstanding Tasks have already been moved into the current local date and are therefore visible in the same bucket in Week and Day. Completed by scheduled date remains distinct from History grouped by local completion date. Date navigation itself does not modify tasks.

### 4.3 Persistence representation

SQLite schema is one Task table plus minimal app-local metadata and notification-delivery bookkeeping:

~~~sql
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
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (completed_at IS NULL AND position IS NOT NULL AND position >= 0)
    OR (completed_at IS NOT NULL AND position IS NULL)
  )
);
CREATE UNIQUE INDEX task_active_position
  ON task(scheduled_date, position)
  WHERE completed_at IS NULL;
CREATE INDEX task_completed_at ON task(completed_at);
~~~

Technical input validation must also enforce canonical date/time formats, nonblank titles and valid IDs before SQL insertion; CHECK constraints alone do not validate those strings. SQLite schema v2 uses one app metadata table for schema version, dataset identity, monotonically increasing SQLite state revision, last exported revision, last safely adopted portable snapshot identity and durable pending-sync state. The v1 `data_ref` field is migrated away in place because Git topology is not persistence-domain state. A separate local reminder-delivery key set can suppress duplicate toasts; it is non-authoritative presentation bookkeeping and is **not included in Git exports**. SQLite lives under the selected personal repository's `.jig/local/` path and is excluded from version control; deterministic JSON records are the portable snapshot synchronized through the repository adapter.

Apply reordering in one SQLite transaction. To satisfy the active-position uniqueness constraint while changing multiple indices, first move affected positions to distinct temporary nonconflicting values within that same transaction, then write final 0..N-1 positions. No intermediate ordering can be observed outside the transaction. If the transaction fails, the whole operation rolls back.

Use prepared statements and explicit transactions. WAL may be enabled for local concurrent reading, but the WAL/SHM sidecars are runtime files and never Git-managed or treated as standalone recoverable backup. Do not assume copying a live SQLite file is a consistent portable export.

## 5. Astryx UI composition and responsive behavior

Consume the pinned Astryx **public** APIs directly; do not import Order's internal Workbench* modules or duplicate their lifecycle semantics. Astryx is the first implementation authority for reusable UI mechanics. The required order is:

1. product/functional/UI reference defines the user-visible outcome and governed structural geometry;
2. pinned Astryx public APIs define shell, navigation, layout, list, form, dialog, field, feedback and responsive mechanics;
3. Jig React composition defines only product-specific regions that Astryx does not already own;
4. Jig CSS styles only Jig-owned composition, using public Astryx semantic/spacing/radius/type tokens;
5. Playwright and screenshot evidence verify the result and must not drive compensating CSS.

Use the canonical Jig theme from [Brand and theme system](../design/brand-and-theme.md), derived from Astryx Neutral and mapped only through public semantic roles. One application theme owner **must** support System/Light/Dark. System follows the browser/platform color preference; an explicit Light or Dark choice overrides it locally. Browser visual preference is presentation state, not Task state, and is not exported to Git. The same semantic roles, structure and interaction hierarchy must remain valid in both themes; no parallel dark-mode component tree or hard-coded per-feature palette is permitted.

The pinned Astryx 0.7.13 `AppShell` is the outermost application frame and already owns the `sideNav`, responsive mobile-navigation and main-content regions. `SideNav` is the public navigation primitive and can be sized/configured through its supported public API. Jig must therefore **not** mount a second complete application shell inside `AppShell`, recreate responsive navigation as raw parallel chrome, or add a second `<main>` landmark. Product-specific Week/Day/History/Settings composition belongs inside the one AppShell main region.

| Jig region | Astryx foundation | Jig-specific part |
|---|---|---|
| App frame | AppShell + SideNav/mobileNav public APIs; Layout/Stack for sub-page regions | Destination state and governed rail/canvas geometry only; no second application shell or navigation implementation |
| Week planner | Grid/Stack, List/ListItem, Button/IconButton | Seven dated columns; visible droppable column areas |
| Day planner | Task cards, section heading, Button | Current selected-date outstanding sequence + completed query after daily rollover |
| Capture/editor | TextInput, TextArea, Selector or SegmentedControl, DateInput, TimeInput, Dialog/FormLayout; destructive confirmation uses Astryx's destructive/alert-dialog primitive | Task field rules, save/admission and confirmed deletion |
| Inspector/compact editor | Drawer, Dialog, responsive composition | Show only task details and external reference |
| Status/feedback | Banner, Toast/useToast/LayerProvider | Persistence error and reminder messages |
| Completion/navigation | CheckboxInput, Link/Buttons | Complete, reopen, open/copy reference |
| Interaction mechanics | @dnd-kit/react | Same-day order and cross-date placement |

Use **a single drag owner**: DragDropProvider around the week, useSortable per outstanding task and useDroppable per dated column, including empty dates. The drag adapter supplies only (task ID, destination date, insertion index) to the functional core; it may animate a transient preview but cannot write canonical tasks until a valid drop commits. Escape/cancel restores pre-drag presentation. A failed save restores the committed order or keeps it visibly pending with an actionable retry; it must never silently pretend success.

**Do not simultaneously enable the Astryx List createReorderable behavior on those same rows.** Its pinned 0.7.13 callback reports same-list (key, to) moves and is insufficient for destination-date transfer. Dnd-kit owns all drag handles, sensors and drop geometry; Astryx owns appearance, focus/field treatment and reusable row structure. Verify ref/handle interaction with actual Astryx ListItem; if direct ListItem integration is incompatible, compose the same Astryx leaves/tokens in a thin Jig task row instead of adding a second DnD system.

Keyboard alternative: expose Move up, Move down and Move to date actions with descriptive accessible labels, even if library sensors also support keyboard dragging. These commands call the **same move operation**; no second order representation. Completion, task editing and reference opening must not accidentally start dragging.

Desktop: Day/current date is the default operational entry surface; Week remains the principal seven-day planning/rearrangement surface. Week shows Tasks only on their canonical scheduled dates after rollover, so an unfinished yesterday card physically appears in today's Week bucket once rollover commits. Day detail is one selected date's outstanding sequence plus compact completed section. Do **not** add a duplicate generic Board destination: Week is the Kanban surface.

Mobile-first composition uses one application-owned semantic breakpoint at **48rem / 768 CSS px**. Configure the pinned AppShell/mobile-navigation behavior to the same semantic boundary rather than implementing a competing breakpoint system. Below it, render the deliberate narrow product composition: compact application navigation, horizontal seven-date strip and one date's list; at or above it, render the desktop Week/Day composition. When the information hierarchy materially differs, make the choice in React from the one shared layout-mode state. Do not mount desktop chrome and then hide/reposition fragments with CSS to manufacture the narrow hierarchy. Preserve the exact selected Task and in-progress editor across the breakpoint. Use touch-sized targets and a move-to-date alternative. Standalone phone installation, native filesystem and on-device Git are future implementation work, not promises of this desktop runtime.

Presentation rules: consistent spacing and density, one primary action, accessible focus distinct from selection, restrained priority signaling, text labels with semantic status, no hover-only essential action, and reduced-motion compliance. Custom CSS exists only for **Jig-owned** geometry such as dated Week tracks, Day/Settings product grids, drag/drop state and reference-specific frame budgets. Preserve Astryx's published reset/core/theme ordering, but do not add a Jig cascade layer whose purpose is to outrank Astryx internals. Do not use `!important`, private/undocumented Astryx selectors/custom properties, or selectors that reshape Astryx component anatomy. Structural pixel dimensions are allowed only where the governed UI reference establishes the product-level budget; interior spacing, radii, typography and ordinary component sizing use Astryx public tokens and props. When composition changes, delete superseded rules rather than stacking corrective overrides.

## 6. Browser reminders

A reminder is optional HH:mm on a scheduled date. The browser UI evaluates due outstanding Tasks while Jig is open using the device's local civil date/time and checks every **30 seconds**, with immediate recheck on focus/visibility changes. Browser timer throttling may delay delivery in hidden tabs.

Delivery has two presentation channels over the same reminder eligibility calculation:
- when the document is visible, show the existing Astryx dismissible toast;
- when the document is open but not visible and `Notification.permission === "granted"`, issue a browser `Notification` for the same reminder.

Browser notification permission is requested only from an explicit user gesture, exposed through Settings. Do not call `Notification.requestPermission()` during startup, page load, or timer execution. Settings must show unsupported/default/granted/denied state honestly.

Use one device-local delivery key `task ID + scheduled date + reminder time` for both channels. Mark the key delivered only after one channel is successfully dispatched. A notification uses the same key as its `tag` where supported, so browser replacement behavior cannot create repeated notifications. On rollover, `scheduled_date` changes while `reminder_time` stays the same, producing a new eligibility/delivery key for the rolled-forward date.

Keep the implementation bounded: no push sender, persistent scheduler, service worker notification daemon, background queue, or alert guarantee when Jig/browser is closed or the machine sleeps. Delivery is best effort while the UI is running. On changing date/time, the new key becomes eligible; on completion it is no longer eligible. Suppression state remains device-local and cannot change Task completion or scheduled order. Only reminders due since the current app session began are eligible for catch-up; do not replay stale reminders from earlier sessions or past dates as a flood on launch.

Failure to use system notifications must not suppress the in-app toast. Reminder messages are transient; failed persistence/synchronization messages require durable visible feedback instead of only a toast.

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

`format.json` includes a version discriminator and a UUID **dataset_id**, created once at first initialization and stable on every replica. Every task is `tasks/<uuid>.json` using exactly the canonical Task fields in §4, sorted key order, UTF-8, normalized newlines and strict date/instant formats. No SQLite binary, Git credentials, device-local toast receipts, secrets, private system paths, temporary files or browser state enter commits. Completed and unfinished tasks are both included.

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
- if the selected date represented the previous "today", advances that selection to the new current date;
- preserves an explicitly selected historical/future date;
- refreshes the Task array used by Week, Day and the reminder monitor without a manual user action.

If rollover makes the browser's `expected_revision` stale, normal HTTP 409/refetch behavior applies. Do not create a special rollover transport protocol.

A Task's reminder time remains the same local clock time while its scheduled date changes, so the reminder naturally applies to the new rolled-forward date.

### 7.3 Write and automatic synchronization loop

**On each UI mutation:** validate the canonical command; in one SQLite transaction apply Task state and increment the durable local revision/dirty marker. Return saved state to the UI immediately on commit. Do not wait for Git or network.

**Export worker:** coalesce rapid local mutations, read one consistent SQLite state and deterministically regenerate the portable Jig snapshot. The worker asks the repository adapter to synchronize that snapshot. It does not contain Git topology logic and does not expose branch/ref/worktree mechanics to the rest of Jig.

**Repository adapter:** perform only the minimum Git operations needed to synchronize Jig-owned portable records while guaranteeing that unrelated repository content is untouched. The adapter must not modify user Git configuration, signing policy, identity, credentials or repository organization. Machine-generated Jig synchronization commits must not fail merely because the user's ordinary commit-signing policy is incompatible with Jig's synthetic synchronization identity; solve that at the individual adapter invocation boundary without changing persistent Git configuration.

The planning/domain layers receive only these outcomes:

- **Local only:** no usable repository transport is configured; local Task mutations and portable export continue.
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
    app.tsx                 app shell, selected destination and theme
    week.tsx                dated columns and cross-day drag composition
    day.tsx                 day and completed composition
    task-editor.tsx         title-first quick add and bounded edit
    reminder.tsx            browser due check + toast/Notification delivery
    theme.css               raw Jig palette primitives only
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

| Requirement | Technical ownership | Required evidence |
|---|---|---|
| JIG-FR-01 quick create | Task creation + quick-add | Title-only creates on selected date, default priority |
| JIG-FR-02 navigate dates | Pure calendar helpers + UI | Week/day/today navigation makes no DB writes |
| JIG-FR-03 within-day order | dnd-kit + core move + SQLite transaction | Reorder persists through reload/restart |
| JIG-FR-04 cross-day move | Dated droppables + core move | Exact target position, no duplicate ID; empty day works |
| JIG-FR-05 priority insertion | Pure insert function | Mixed-list insertion preserves all earlier relative order |
| JIG-FR-06 priority change | Edit operation | Only priority changes; position unchanged |
| JIG-FR-07 unrestricted edit | Astryx edit surface + core update | All optional fields and date edited without workflow gate |
| JIG-FR-08 completion/reopen | Core transition + timestamp + DB | Date-scheduled completion, history query, reopen same ID |
| JIG-FR-09 daily rollover | Pure core rollover + one SQLite transaction + service day-boundary/catch-up trigger | Earlier outstanding Tasks physically move to the current date; Week and Day show the same moved card in the current bucket; completed Tasks never move |
| JIG-FR-10 reminder delivery | One browser reminder monitor + Astryx Toast + browser Notification API | Visible page => one toast; hidden/open + granted permission => one browser Notification; one shared delivery key prevents duplicates; no closed-app guarantee |
| JIG-FR-11 external context | Reference open/copy UI | Link/path accessible; no source-content import |
| JIG-FR-12 honest outcome | HTTP/SQLite/repository-boundary outcome and UI | Failed local save or repository sync never rendered as success |
| JIG-FR-13 responsive continuity | Same Task + Astryx responsive composition | Narrow/wide navigation preserves selection and draft |
| JIG-FR-14 local retention | SQLite inside configured personal Git repository | All Task fields survive service restart, checkout/re-import restores complete state |
| JIG-FR-15 installer | scripts/install.sh, pinned runtime, user service | Single invocation configures source install, repo data area and launcher |
| JIG-FR-16 data locality / continuity | selected repository `.jig/local` plus portable repository snapshot through the adapter | Existing valid Jig data is adopted on install; no separate migration subsystem |
| JIG-FR-17 desktop availability | jig launcher + systemd --user | jig opens existing local service or starts it; restart survives |
| JIG-FR-18 automatic Git sync | durable dirty revision + isolated repository sync adapter | Local save immediately, background export/synchronization without user action |
| JIG-FR-19 safe coexistence | thin repository adapter with private isolation mechanism | Unrelated staged/unstaged user content unchanged; generic sync issue never becomes planning/domain conflict state |
| JIG-FR-20 low-friction idle | one Bun service, bounded timers/backoff | Measured low idle CPU/RSS and responsive reopen |
| JIG-FR-21 delete | Core delete + SQLite transaction + complete-snapshot export/import | Confirmation precedes mutation; row/file disappear; outstanding positions compact; Git round trip preserves deletion |
| JIG-FR-22 appearance | One Jig theme owner derived from Astryx Neutral + local preference | System/Light/Dark render equivalent hierarchy and state semantics without Task/Git mutation |

### 10.1 Test boundaries

**Core tests:** Exhaustive representative priority mix, insertion at both ends, same-day and cross-day movement, empty destinations, cancellation/no mutation, rank compaction, priority changes, daily rollover ordering/date mutation, multi-day catch-up, completed-task non-rollover, reminder preservation, completed-task rescheduling, reopening, outstanding/completed deletion and edge dates including month/year boundaries.

**SQLite integration:** One failed transaction rolls back every affected position/date; uniqueness and completeness checks; restart with WAL; task query by scheduled and completion dates; migration from a fresh empty database; corrupted input rejected before persistence.

**Repository/Git integration:** Use existing-repository fixtures with unrelated dirty/staged files and normal developer Git configurations, including commit signing enabled with no Jig key. Verify automatic export/synchronization touches only Jig-owned portable data; user Git configuration is unchanged; installation/retry survives synchronization failure; existing valid Jig data is adopted; the exact v1.0.0 empty-bootstrap residue recovers safely; unknown malformed states are non-destructive; ordinary repository content remains untouched.

**Browser interaction:** Real Astryx components and dnd-kit are tested together using Playwright: same-day drag, Thursday-to-Friday drag, empty-day drop, persisted daily rollover visible in both Day and Week, open-browser local-midnight revalidation, full-card drag overlay, Escape cancel, task checkbox/link/editor non-interference, keyboard move alternatives, confirmed/cancelled deletion, long-list scrolling, mobile narrow layout, responsive switching with unsaved editor, System/Light/Dark parity, visible-page reminder toast, hidden-page browser Notification with granted permission, permission fallback/catch-up, and durable save-error visibility.

**Installer/service:** Non-root one-script setup in both supported target modes: an existing local repository via `--repo`, and a repository URL cloned by Git into a new/empty checkout via `--repo-url` + `--checkout`. Verify both modes converge on the same repository-validation/setup path, plus exact target selection, idempotent rerun, invalid target refusal, existing-data adoption, failed-install retry, launcher/service restart and auto-sync while the browser is closed. Repository migration/reorganization remains outside Jig.

**Security:** Loopback-only listener, same-origin/token checks, no arbitrary task-reference execution, no shell invocation via Git parameters, path containment and no task data in public source.

### 10.2 Technical acceptance gate

The design is closed at the **architecture and dependency selection** level, not proven implemented. Release/implementation acceptance requires the tests above to pass against the **actual pinned package versions**, plus real one-script installations through both `--repo` and `--repo-url` + `--checkout`, a working `jig` command, enabled service, repository-contained SQLite/JSON, automatic repository synchronization while the browser is closed, safe unrelated working-tree coexistence, generic repository-failure behavior, and successful resumption after the repository is reconciled externally.

If the Astryx ListItem/dnd-kit integration fails in the browser, fix the smallest view composition while keeping Astryx tokens and one drag owner; do not import another whole UI kit or silently broaden dependencies. If exact pinned versions cannot install/build, document the proven incompatibility and resolve the single affected dependency through explicit design review rather than silently upgrading all packages.

## 11. Explicitly deferred capabilities

Independent phone installation, native mobile Git/process/filesystem integration, application-level trash/soft-delete/undo/restore, background/push notifications, Order WorkItem creation, automatic project-task synchronization, metrics/dashboard, team collaboration, repeated scheduling, subtasks, duration estimation and general workflow constraints are excluded. Git history, branch, merge and conflict reconciliation are explicitly **outside Jig's domain**, not deferred Jig features. The canonical Task format and repository record identity intentionally leave room for later extension, but none of these capabilities is represented as implemented by this design.

## 12. Decision history and minimality rationale

- **SQLite primary inside the selected personal repository:** Operational queries, atomic multi-item reordering and crash recovery remain simple; only deterministic logical records are Git committed. No user task data is stored by default in the public Jig source repo.
- **One exporter and one importer instead of two live authorities:** SQLite owns local edits; Git versions validated snapshots at explicit synchronization boundaries.
- **Isolation is an adapter responsibility, not an application responsibility:** The repository adapter must guarantee that automatic Jig synchronization cannot touch unrelated repository content. A dedicated branch/worktree may be one implementation technique, but it is not part of Jig's domain, user configuration or lifecycle contract.
- **Automatic bounded Git sync instead of manual export:** Local SQLite saves trigger background commit/fetch/push with safe retries even when the browser is closed; network status is separately visible.
- **Repository boundary instead of a Jig Git state machine:** Jig exports/validates portable snapshots and receives only operational synchronization outcomes. Git acquisition, topology, policy, credentials, history and reconciliation stay with Git tooling and never become Jig domain/configuration/state.
- **Astryx directly instead of copying Order:** Reuses published UI semantics without coupling Jig to software-factory workflows.
- **dnd-kit instead of Astryx same-list reordering plus custom cross-day dragging:** One coordinated drag system across all seven date columns with a single canonical move command.
- **Browser-side reminder monitor instead of background infrastructure:** Toast while visible and browser Notification while hidden/open with granted permission, with no closed-app delivery guarantee.
- **One Task and derived views instead of multiple planning objects:** Satisfies all 22 functional requirements without building a project manager.

**Implementation planning can now be derived from this document and [the UI solution](../design/ui-solution.md).** The plan must preserve the boundaries above, prove the specified acceptance gates, and must not interpret non-goals as implied features.
