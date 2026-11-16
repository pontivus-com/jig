# Jig — technical solution design

**Status:** Proposed binding desktop MVP technical solution, v0.3 (2026-11-16), reflecting JIG-FR-01–22. Not yet implemented, performance-tested or runtime-certified.
**Concern owner:** Jig architecture, canonical task representation, persistence, Git exchange, UI realization, operation admission, and verification.
**Governing documents:** [Product definition](../product/product-definition.md) and [Planning workbench functional design](../requirements/planning-workbench.md), JIG-FR-01 through JIG-FR-22.
**Scope boundary:** One-script Linux user installation, user-selected personal Git repository as the entire planning-data home, always-available local service, background Git commit/synchronization, responsive desktop UI, no hosted Jig service.

## 1. Decisions, baseline and user experience

Jig is a date-based personal planner, not a project manager or an Order lifecycle client. **The user chooses an existing personal or organizational Git repository during installation. All authoritative planning data, including the live SQLite database, lives under a dedicated directory inside that selected repository.** The public pontivus-com/jig source code repository contains no personal data and is not a valid default data target.

The normal experience is: run one installer; assign repository; installer configures local application/runtime, a Git-managed data area, the `jig` command and a Linux user service; thereafter `jig` opens the planner or starts its service, saves happen immediately in SQLite, and background Git commits/fetches/pushes happen without interaction in the normal case. User task operations are never blocked on the network. Git auto-sync failures must retain local work and show a truthful state.

**Authoritative product requirements:** [JIG-FR-01–22](../requirements/planning-workbench.md). This document makes the following technical selections:

| Area | Chosen solution |
|---|---|
| Runtime and service | One Bun 1.4.4 process on Linux, `systemd --user` service, loopback HTTP, no external database or remote service |
| Command and installer | `jig` launcher in ~/.local/bin, one `scripts/install.sh --repo /absolute/existing/repo` command or `--repo-url URL --checkout /new/empty/path`; optional interactive selection if omitted |
| UI | React 19.3.1, TypeScript 7.0.2, Vite 8.3.5; pinned Astryx 0.7.13 and Neutral theme |
| Cross-day drag | `@dnd-kit/react@0.5.3`, one drag owner; Astryx handles visual primitives |
| Live data | One Bun SQLite database at `<selected-repo>/.jig/local/jig.sqlite`; immediate transactional writes |
| Versioned data | Deterministic Task JSON and manifest committed to a dedicated `jig-data` Git branch/ref **of the same selected repository**, through an isolated linked worktree under `<selected-repo>/.jig/git/` |
| Sync | Daemon automatically debounces exports, commits Jig-only data, fetches and pushes the Jig data branch; fast-forward import if safe; divergence is never silently overwritten |
| Notifications | Astryx Toast while browser is open; no background push or notification delivery promise |
| Mobile | Narrow mobile-first layout and touch accessibility in desktop web UI; standalone phone installation deferred |

The selected repository's ordinary working branch, index, dirty files and unrelated commits are **never** touched by Jig's automatic Git operations. Using a separate branch/worktree in the same repository provides this isolation without creating an unrelated second Git repository or requiring an external service.

This is an architecture contract; actual interaction, installation, Git branch/worktree lifecycle and resource use still need verification against the exact pinned environment. No unresolved technology choice may be delegated casually to implementers.

## 2. Dependency contract and provenance

The initial dependency set is exact-pinned; no wholesale Order package manifest is copied.

**Production:** react 19.3.1; react-dom 19.3.1; @astryxdesign/core 0.7.13; @astryxdesign/theme-neutral 0.7.13; @stylexjs/stylex 0.19.1 (Astryx peer); @dnd-kit/react 0.5.3.

**Development:** typescript 7.0.2; vite 8.3.5; @types/react 19.3.0; @types/react-dom 19.3.0; @types/bun 1.4.4; vitest 5.0.5; @playwright/test 1.64.1. Use Bun 1.4.4 as the installed runtime; pin it in repository runtime metadata. The exact baseline is a reproducibility selection, not a claim that later packages are incompatible.

Use Bun built-ins for SQLite and spawning Git. Do not add an ORM, repository object abstraction, task mapper/DTO layer, date utility package, notification service, state-management framework, CodeMirror, OpenCode SDK, Tailwind build integration, a StyleX compiler plugin or a second UI toolkit without demonstrated necessity. Astryx's published core CSS and built Neutral theme are sufficient for the initial presentation; custom Jig board geometry uses a small stylesheet consuming public Astryx tokens.

**Verified references:**
- [Order manifest](https://github.com/pontivus-com/order/blob/master/package.json), [runtime pin](https://github.com/pontivus-com/order/blob/master/.bun-version), [UI imports](https://github.com/pontivus-com/order/blob/master/ui/src/styles.css), [theme](https://github.com/pontivus-com/order/blob/master/ui/src/theme.css).
- [Pinned Astryx core package](https://github.com/meta/astryx/blob/v0.7.13/packages/core/package.json), [Calendar](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Calendar/index.ts), [List](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/List/List.doc.mjs), [Toast](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Toast/index.ts), [date input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/DateInput/index.ts), [time input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TimeInput/index.ts), [AppShell](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/AppShell/index.ts).
- [dnd-kit current React API](https://dndkit.com/react/quickstart/) and [multiple-sortable-lists guide](https://dndkit.com/react/guides/multiple-sortable-lists/).
- [Bun SQLite API](https://bun.com/docs/runtime/sqlite) and [Git merge/fast-forward contract](https://git-scm.com/docs/git-merge).

## 3. Runtime, process ownership and configuration

~~~text
Jig application source/distribution  (separate from personal planning repo)
    install.sh --> ~/.local/share/jig/      binaries + built static UI
               --> ~/.config/jig/config     selected target path + remote/ref
               --> ~/.local/bin/jig         desktop launcher
               --> systemd --user jig       persistent low-idle Bun process
                                |
 Browser (loopback)  <-----------+------->  Bun HTTP + functional core
 React / Astryx / dnd-kit                         |
 Browser-only reminder toasts                     v
                                selected PERSONAL Git repository
                                <repo>/.jig/
                                   local/jig.sqlite      operational authority
                                   git/.git              linked-worktree pointer
                                   git/format.json
                                   git/tasks/<uuid>.json
                                  [jig-data ref belongs to this same repo]
                                         |
                                       optional configured Git remote
~~~

The application binary and runtime may be installed under normal user application directories; **all task data and recoverable canonical planning records must be inside the configured Git repository**. The local service keeps only its own noncanonical logs and launch configuration outside that repository. Do not install the program into or modify the public source checkout when it is not the selected personal target.

**Functional core:** Typed pure operations for task creation, date and ordering rules, move, completion and reopening; no I/O, SQL or presentation dependencies. **Imperative shell:** one SQLite owner, one Git sync owner, one HTTP admission boundary, startup/installer orchestration and browser toast callback. No DTO layer, services/repositories hierarchy, event bus, workflow framework, second task authority or browser persistent task cache.

Only one Bun process may write the configured SQLite file. Enforce a single active instance for each configured data root. The process has a serialized, bounded synchronization loop; a browser need not remain open for Git operations. UI state is limited to selected date/task, modal draft, transient drag preview and local appearance preference. Theme preference is presentation state and never part of canonical Task or Git-synchronized planning data. Date/week/history views are queries over the same canonical Task set.

**Local HTTP:** bind `127.0.0.1` only by default; one fixed or user-configured loopback port, HTTP same-origin UI, versioned canonical task commands. Read operations return canonical tasks plus revision. Mutations return success only after SQLite commit; the sync status is separately presented as local-only, pending, synchronized, retrying or blocked. The user can continue editing regardless of transport status.

**Idle behavior:** One service, no worker farm, no browser needed for task storage/sync, no polling-heavy UI while closed. Coalesce edits into short Git bursts, use a timer/backoff instead of permanent busy loops, and never wake a job per drag animation frame. Resource limits are verified in a real idle/workload test rather than inferred from technology choice.

### 3.1 Installer and executable lifecycle

A **single installer script** `scripts/install.sh` is the canonical entry point and must be reproducible, noninteractive when flags are supplied, and able to prompt for missing user configuration. `--repo` names the absolute path of an existing writable local Git worktree; alternatively `--repo-url` plus `--checkout` safely clones a specified remote into a new empty local directory. `--remote` selects a configured remote, defaulting to `origin` when present. The modes are mutually exclusive and must not overwrite an existing checkout. The script must:

1. Verify Linux, Git, writable user directories and target path. When given `--repo`, validate the existing target is a writable Git repository **other than Jig's public source checkout**. When given `--repo-url` and `--checkout`, clone only into a new empty user-selected directory, use the normal Git credential mechanism, and validate the checkout after cloning. Never silently `git init`, force-overwrite a checkout, or convert a nonrepository directory.
2. Install/reuse the exact-pinned Bun runtime, install frozen-lock dependencies and build the React assets, with clear failure if pinned artifacts cannot be installed. Do not download unspecified floating versions or require root for the ordinary user install.
3. Safely establish `<repo>/.jig/`. Add only a narrowly scoped exclusion to the selected repository's local `.git/info/exclude` (or equivalent repo-local exclude); do not edit the user's tracked .gitignore or stage unrelated changes. Handle .git-as-file linked worktrees by resolving the Git common directory correctly.
4. Create/adopt the **dedicated `jig-data` ref** inside that same Git repository and attach the isolated worktree at `<repo>/.jig/git/`. Initialize the branch from an empty Git tree, *not* by copying all personal documentation into a new branch. When a remote already has the Jig branch, fetch and validate its format and dataset identity before adopting it. Refuse an existing unrelated branch name or incompatible format; never force reset or force push.
5. Create/migrate SQLite under `<repo>/.jig/local/`, or hydrate it from a validated Jig Git snapshot when installing on another device. Preserve source data on failure; no destructive reinstall or unconfirmed restore.
6. Save the target absolute path and chosen Git remote/ref in user-local configuration; install a `jig` command. Install/enable/start a `systemd --user` service if available; otherwise provide a documented foreground fallback and mark the service feature unavailable rather than claiming it installed.
7. Verify `jig status`, local HTTP readiness, Task storage, and Git local commit (remote transport only when configured). Print exactly where database, Git records and service live and whether remote auto-sync is enabled.

`jig` opens the local UI in the default browser, starting the service on demand if it is not up. `jig status` reports service, configured repository, local save state and Git sync health. `jig sync` is an optional diagnostic/retry command, not the normal way to make data durable. `jig doctor` diagnoses repo/worktree/service problems; `jig configure --repo <path>` changes target only via explicit migration/validation and never silently starts a second empty plan. Uninstall removes app/service configuration but preserves all `.jig/` data by default.

User-session service availability is guaranteed only while the user's user-service manager is active. Login persistence beyond that (e.g. linger policy) is an explicit administrator/OS configuration, not silently enabled by Jig.

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
6. No automatic rollover changes yesterday's tasks. Carry-over is a derived read/presentation rule over unchanged scheduled dates.
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

**Read:** Week is seven consecutive local civil dates beginning Monday and shows Tasks on their actual scheduled dates only. Day is the selected date plus a derived carry-over prefix of outstanding Tasks whose scheduled_date is earlier than the selected date; order those earlier Tasks by scheduled_date ascending and then by their persisted position, followed by selected-date Tasks in persisted position order. Carry-over never mutates scheduled_date. Completed by scheduled date remains distinct from History grouped by local completion date. Date navigation does not modify tasks.

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

Technical input validation must also enforce canonical date/time formats, nonblank titles and valid IDs before SQL insertion; CHECK constraints alone do not validate those strings. One app metadata table records schema version, dataset identity, monotonically increasing SQLite state revision, last exported revision and Git head, last safely imported Git head, configured data-ref identity and durable pending-sync state. A separate local reminder-delivery key set can suppress duplicate toasts; it is non-authoritative presentation bookkeeping and is **not included in Git exports**. SQLite lives under the selected personal repository's .jig/local/ path and is excluded from version control; JSON records under the dedicated Jig worktree are the portable Git-authoritative snapshot of each successful export.

Apply reordering in one SQLite transaction. To satisfy the active-position uniqueness constraint while changing multiple indices, first move affected positions to distinct temporary nonconflicting values within that same transaction, then write final 0..N-1 positions. No intermediate ordering can be observed outside the transaction. If the transaction fails, the whole operation rolls back.

Use prepared statements and explicit transactions. WAL may be enabled for local concurrent reading, but the WAL/SHM sidecars are runtime files and never Git-managed or treated as standalone recoverable backup. Do not assume copying a live SQLite file is a consistent portable export.

## 5. Astryx UI composition and responsive behavior

Consume the public Astryx components directly; do not import Order's internal Workbench* modules or duplicate their lifecycle semantics. Use the Neutral theme and public semantic roles, not the original green decorative screenshot palette. One application theme owner **must** support System/Light/Dark. System follows the browser/platform color preference; an explicit Light or Dark choice overrides it locally. Browser visual preference is presentation state, not Task state, and is not exported to Git. The same semantic roles, structure and interaction hierarchy must remain valid in both themes; no parallel dark-mode component tree or hard-coded per-feature palette is permitted.

| Jig region | Astryx foundation | Jig-specific part |
|---|---|---|
| App frame | AppShell, Layout, Grid/Stack | Minimal Week / Day / History navigation |
| Week planner | Grid/Stack, List/ListItem, Button/IconButton | Seven dated columns; visible droppable column areas |
| Day planner | List/ListItem, section heading, Button | Derived carry-over prefix + selected-date outstanding sequence + completed query |
| Capture/editor | TextInput, TextArea, Selector or SegmentedControl, DateInput, TimeInput, Dialog/FormLayout | Task field rules and save/admission |
| Inspector/compact editor | Drawer, Dialog, responsive composition | Show only task details and external reference |
| Status/feedback | Banner, Toast/useToast/LayerProvider | Persistence error and reminder messages |
| Completion/navigation | CheckboxInput, Link/Buttons | Complete, reopen, open/copy reference |
| Interaction mechanics | @dnd-kit/react | Same-day order and cross-date placement |

Use **a single drag owner**: DragDropProvider around the week, useSortable per outstanding task and useDroppable per dated column, including empty dates. The drag adapter supplies only (task ID, destination date, insertion index) to the functional core; it may animate a transient preview but cannot write canonical tasks until a valid drop commits. Escape/cancel restores pre-drag presentation. A failed save restores the committed order or keeps it visibly pending with an actionable retry; it must never silently pretend success.

**Do not simultaneously enable the Astryx List createReorderable behavior on those same rows.** Its pinned 0.7.13 callback reports same-list (key, to) moves and is insufficient for destination-date transfer. Dnd-kit owns all drag handles, sensors and drop geometry; Astryx owns appearance, focus/field treatment and reusable row structure. Verify ref/handle interaction with actual Astryx ListItem; if direct ListItem integration is incompatible, compose the same Astryx leaves/tokens in a thin Jig task row instead of adding a second DnD system.

Keyboard alternative: expose Move up, Move down and Move to date actions with descriptive accessible labels, even if library sensors also support keyboard dragging. These commands call the **same move operation**; no second order representation. Completion, task editing and reference opening must not accidentally start dragging.

Desktop: week is the default with seven dated columns; maintain a usable minimum column width and allow horizontal board scrolling when necessary rather than compressing task text below readability. A column with a long list scrolls without hiding its date heading or preventing other dates from being reached. Week shows Tasks only on their actual scheduled dates. Day detail is one selected date whose attention sequence is the deterministic carry-over prefix defined in §4.2 followed by the selected-date sequence; carried-over rows use a subtle semantic treatment and originating-date label but no persisted carry-over state. Dragging a carried-over Task into the selected-date sequence is an explicit cross-date move to that selected date and exact position. The completed section is compact. Do **not** add a duplicate generic Board destination: Week is the Kanban surface.

Mobile-first composition: at narrow widths present a compact horizontal week strip and one date's list, not seven tiny columns; preserve the exact selected task and in-progress editor on responsive change. Use touch-sized targets and a move-to-date alternative. Standalone phone installation, native filesystem and on-device Git are future implementation work, not promises of this desktop runtime. Choose one responsive breakpoint owner in Jig UI; do not replicate independent layout breakpoints in each component.

Presentation rules: consistent spacing and density, one primary action, accessible focus distinct from selection, restrained priority signaling, text labels with semantic status, no hover-only essential action, and reduced-motion compliance. Any custom CSS exists only for Jig-specific calendar columns, drag indicators and responsive composition and consumes verified public Astryx tokens.

## 6. Browser reminders

A reminder is optional HH:mm on a scheduled date. The browser UI evaluates due outstanding tasks while Jig is open; it uses the device's local civil date/time, periodically checks active reminders (at least once per minute when scheduling is permitted), and rechecks on tab visibility/focus. Browser timer throttling may delay delivery in hidden tabs; resume checks handle reminders that became due since this app session started. An eligible reminder produces an Astryx dismissible toast; an OS/browser notification is an optional permitted enhancement, not an acceptance dependency.

Keep the implementation bounded: no push sender, persistent scheduler, service worker notification daemon, background queue, or alert guarantee when Jig is closed or the machine sleeps. Delivery is best effort while the UI is running. A locally stored key (task ID + scheduled date + reminder time) suppresses repeated display on each timer tick and reload. On changing date/time, the new key becomes eligible; on completion it is no longer eligible. Suppression state remains device-local and cannot change Task completion or scheduled order. Only reminders due since the current app session began are eligible for catch-up on resume; do not replay stale reminders from earlier sessions or past dates as a flood on launch.

Failure to use system notifications must not suppress the in-app toast. Reminder messages are transient; failed persistence/synchronization messages require durable visible feedback instead of only a toast.

## 7. Repository-contained data, automatic Git sync and recovery

### 7.1 Data ownership and branch isolation

The selected personal or organization repository is the **only configured data home**. Example:

~~~text
/home/user/personal-docs/       <-- user's EXISTING repository
  .git/                         <-- same repository Git object database
  existing-documents/           <-- untouched by Jig
  .jig/                         <-- locally excluded from ordinary branch
    local/
      jig.sqlite                <-- SQLite operational authority, not Git committed
      jig.sqlite-wal            <-- optional transient local WAL file
      jig.sqlite-shm
    git/                        <-- linked worktree attached to jig-data branch
      .git                      <-- worktree pointer into parent's .git metadata
      format.json               <-- Git-tracked canonical snapshot format
      tasks/
        <stable-uuid>.json      <-- Git-tracked canonical Task records
~~~

Do not create a second standalone Git repository. The `jig-data` branch/ref lives in the **existing chosen repository**, and only Jig touches the linked worktree's index and app-owned paths. The ordinary docs branch, its index and user edits are never staged, committed, merged, reset, rebased, checked out or pushed by Jig. Background `git push` targets **only** the `jig-data` ref. Local user data never appears in pontivus-com/jig by default.

The ordinary branch's tracked files will not show the `jig-data` contents: they live on a separate branch, inside the linked worktree under `.jig/git/`. This explicit placement is intentional to make unattended Git operations safe when the selected repository also holds personal documents and has unrelated staged changes.

An unconfigured Git remote is allowed: Jig remains a fully usable, automatically locally committed planner, and displays **Local only — no remote configured**. If the target repo has a remote, choose its existing connection; no Jig-hosted account is necessary. Future independent mobile installations can join the same private branch and rebuild their SQLite database from the versioned records, but standalone phone deployment is not an MVP promise.

### 7.2 Portable snapshot format

`format.json` includes a version discriminator and a UUID **dataset_id**, created once at first initialization and stable on every replica. Every task is `tasks/<uuid>.json` using exactly the canonical Task fields in §4, sorted key order, UTF-8, normalized newlines and strict date/instant formats. No SQLite binary, Git credentials, device-local toast receipts, secrets, private system paths, temporary files or browser state enter commits. Completed and unfinished tasks are both included.

The portable tree is a **complete snapshot**; every file path ID matches its embedded ID; duplicate task IDs or missing/duplicate active positions invalidate the entire import. Once a complete snapshot has been fetched, validated and safely adopted at a known Git commit, its Task membership is exact: a Task present in the previously adopted dataset but absent from the newly adopted snapshot is deleted locally in the same transactional import. A missing file in an arbitrary, incomplete or unvalidated worktree is **not** a deletion signal. User deletion is therefore represented naturally by absence of `tasks/<uuid>.json` in a later complete snapshot; no tombstone file or deleted-state record is introduced. Do not use plain Git text auto-merges as valid domain reconciliation.

### 7.3 Write and automatic synchronization loop

**On each UI mutation:** validate the canonical command; in one SQLite transaction apply Task state and increment the durable local revision/dirty marker. Return saved state to the UI immediately on commit. Do not wait for network or Git. Task operations never write SQLite and Git simultaneously as a pseudo-two-phase transaction.

**Export worker:** when the durable revision differs from last exported revision, coalesce rapid edits over a short quiet interval (suggest 3–5 seconds, configurable). Read a consistent database snapshot, deterministically regenerate app-owned JSON/manifest in the isolated worktree, remove stale app-owned Task files that are no longer present in that database snapshot, stage only those paths and create a local commit if content changed. Commit only within the `jig-data` worktree and update the exported revision/head metadata afterward. If newer SQLite changes arrived during export, leave them pending for the next pass. At startup, compare the existing Git snapshot and SQLite revision to reconcile a commit that succeeded immediately before a crash/metadata update. A failed export is retried with backoff and does not roll back a successful local task save.

**Git sync worker:** after local export/commit, attempt fetch/push without waiting for a user click; when idle, poll the configured Git remote at a bounded cadence (e.g. once a minute while reachable, exponentially backed off after failure). Fetch only the dedicated Jig branch/ref; never run unbounded pull, force reset, force push, or merge operations against the user's working branch.

- **Remote absent:** local-only, all Task mutations and local Git commits continue.
- **Local ahead, remote unchanged:** push only the dedicated Jig branch. On push failure retain local commits and retry.
- **Remote ahead, no unsaved/unexported local edits or local commits:** fast-forward the isolated worktree, validate every Task and format, import the complete snapshot into SQLite transactionally—including removal of local Tasks absent from the adopted snapshot—then mark the remote head adopted.
- **Both advanced independently / local dirty plus remote ahead:** preserve local data, local/remote Git commits and enter a durable `sync blocked: divergent histories` state. Do not silently select last writer, merge arbitrary text, or overwrite a user's local edits. Display an actionable reconciliation explanation; optional `jig doctor`/support workflow may assist. This is an explicit exception to otherwise hands-off operation, not a claim that concurrent conflict-free sync is implemented.
- **Equal:** mark synchronized after all local revisions have been exported and the target remote confirms the pushed ref.

Startup resumes pending export/fetch/push from durable local metadata. Incoming remote changes are checked before an outward push; remote failure never discards local tasks. Browser open state is irrelevant to auto-sync scheduling. Do not automatically generate commits for each intermediate pixel/drag event: one saved drop is one task operation, and rapid edits are batched for Git.

**Guarantee:** a successful SQLite save is durable locally immediately; automatic export and Git transfer are separate eventual steps with explicit status. The UI must never conflate “Saved locally” with “Synchronized remotely.” A hidden permanent failure is unacceptable.

### 7.4 Import, restore, migration and safety

On a fresh installation with an existing valid remote `jig-data` ref, the installer automatically fetches and validates the full snapshot before populating a fresh SQLite DB. It does not overwrite an existing database without explicit confirmation and a recoverable local backup.

For normal remote fast-forward sync, import a validated full snapshot by one SQLite transaction **only when the local dataset is clean relative to its known Git head**. Reconcile the entire Task membership in that transaction, including deletion of Tasks absent from the adopted complete snapshot, then update the imported-head marker. On validation error or transaction failure, keep the prior DB intact and mark sync blocked. If a crash occurs after ref fast-forward but before DB adoption, the imported-head metadata reveals the unfinished step and startup resumes import.

Moving Jig to another selected repository is a deliberate operation: block writers briefly, export the latest local state, validate the destination Git root and branch ownership, copy/rehydrate the database/records without touching unrelated files, and switch the active config atomically only on success. On failure remain attached to the original repository. Never leave two independent active installation writers for one Task dataset.

### 7.5 Failure truth table

| Failure | Canonical state | Operator-visible outcome |
|---|---|---|
| SQLite transaction fails | No change committed | Save failed with retry, never fake success |
| Browser closes | SQLite already holds accepted saves | Service keeps exporting/syncing |
| Bun/service restarts mid-operation | SQLite rollback plus persisted dirty revision | Resume interrupted export or import idempotently |
| Git worktree write/commit fails | SQLite remains authority | Saved locally; backup/sync retrying or blocked |
| Git commit succeeds but metadata update fails | Exported data recoverable from Git head | Reconcile snapshot/revision at restart |
| No remote | Local database and local Jig branch persist | Local-only badge/status |
| Offline/push failure | SQLite and local Git commits intact | Automatic retry with backoff; never erase |
| Branch histories diverge | Both heads preserved | Explicit sync-blocked state, no silent conflict loss |
| Remote snapshot invalid | Previous SQLite state intact | Refuse import, report failure |
| Selected personal repo has unrelated staged/dirty files | No impact on those files | Jig auto-sync continues on isolated worktree |
| Installer fails during setup | Existing user data/branch remains | Clear failure and idempotent safe rerun |
| Uninstall | Personal repo data preserved | Service/binary removed, data retained by default |

### 7.6 Resource/resource-ownership contract

Use one serialized export/sync loop in the Bun service with a durable dirty marker, bounded timers and exponential network backoff. Never launch a separate perpetual Git daemon, background browser tab, job-queue server, or per-task worker. Idle resource acceptance measures RSS, CPU activity and wake frequency in the installed service; no numeric maximum is asserted without host measurements.

## 8. Security and trust boundaries

Run HTTP on 127.0.0.1 only by default; no publicly bound listener and no external login. Require same-origin requests and reject cross-origin mutation attempts. Use a per-install or per-session unpredictable write token supplied to the same-origin UI for state-changing requests, with no permissive CORS. Do not assume “localhost” alone prevents cross-site request abuse.

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
    git.ts                  isolated worktree, auto export, validated import, fast-forward sync
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
    reminder.tsx            browser due check + Astryx toast
    theme.css               Jig-specific board/layout roles only
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
| JIG-FR-09 carry-over | Derived Day query over unchanged scheduled dates | Earlier outstanding remains visible and marked until completed, explicitly moved or deleted; Week never duplicates it |
| JIG-FR-10 in-app reminder | Browser clock + Astryx Toast | Due while open => one dismissible toast; no closed-app guarantee |
| JIG-FR-11 external context | Reference open/copy UI | Link/path accessible; no source-content import |
| JIG-FR-12 honest outcome | HTTP/SQLite/Git outcome and UI | Failed save or sync never rendered as persisted success |
| JIG-FR-13 responsive continuity | Same Task + Astryx responsive composition | Narrow/wide navigation preserves selection and draft |
| JIG-FR-14 local retention | SQLite inside configured personal Git repository | All Task fields survive service restart, checkout/re-import restores complete state |
| JIG-FR-15 installer | scripts/install.sh, pinned runtime, user service | Single invocation configures source install, repo data area and launcher |
| JIG-FR-16 data locality | selected .jig/local and .jig/git linked worktree | No personal data in Jig source checkout or separate default data location |
| JIG-FR-17 desktop availability | jig launcher + systemd --user | jig opens existing local service or starts it; restart survives |
| JIG-FR-18 automatic Git sync | durable dirty revision + one Git worktree worker | Local save immediately, background commit/fetch/push without user action |
| JIG-FR-19 safe coexistence | dedicated jig-data branch/worktree; no main-branch writes | Unrelated staged/unstaged user docs unchanged; truthful blocked state |
| JIG-FR-20 low-friction idle | one Bun service, bounded timers/backoff | Measured low idle CPU/RSS and responsive reopen |
| JIG-FR-21 delete | Core delete + SQLite transaction + complete-snapshot export/import | Confirmation precedes mutation; row/file disappear; outstanding positions compact; Git round trip preserves deletion |
| JIG-FR-22 appearance | One Astryx Neutral theme owner + local preference | System/Light/Dark render equivalent hierarchy and state semantics without Task/Git mutation |

### 10.1 Test boundaries

**Core tests:** Exhaustive representative priority mix, insertion at both ends, same-day and cross-day movement, empty destinations, cancellation/no mutation, rank compaction, priority changes, carry-over query ordering without date mutation, completed-task rescheduling, reopening, outstanding/completed deletion and edge dates including month/year boundaries.

**SQLite integration:** One failed transaction rolls back every affected position/date; uniqueness and completeness checks; restart with WAL; task query by scheduled and completion dates; migration from a fresh empty database; corrupted input rejected before persistence.

**Git integration:** An existing personal-repo fixture with deliberately dirty/staged unrelated files, an isolated jig-data linked worktree and a local bare remote. Verify the installer creates/adopts only the Jig branch; deterministic auto export; JSON round trip; deletion removes the Task file and survives fast-forward import without a tombstone; commit/metadata crash recovery; schema/order rejection; push failure/retry; divergence retains both heads; clean separation from ordinary repo branch and index.

**Browser interaction:** Real Astryx components and dnd-kit are tested together using Playwright: same-day drag, Thursday-to-Friday drag, empty-day drop, carried-over earlier work with originating-date treatment, carry-over drag that explicitly reschedules, Escape cancel, task checkbox/link/editor non-interference, keyboard move alternatives, confirmed/cancelled deletion, long-list scrolling, mobile narrow layout, responsive switching with unsaved editor, System/Light/Dark parity, in-app due toast, and durable save-error visibility.

**Installer/service:** Non-root one-script setup in existing-local and remote-URL clone modes, exact target selection, idempotent rerun, invalid Git target refusal, existing-branch identity checks, two-repo rehydration, launcher/service restart and auto-sync while browser closed. Measure idle CPU/RSS and reopen responsiveness against an explicit acceptance threshold chosen before performance testing.

**Security:** Loopback-only listener, same-origin/token checks, no arbitrary task-reference execution, no shell invocation via Git parameters, path containment and no task data in public source.

### 10.2 Technical acceptance gate

The design is closed at the **architecture and dependency selection** level, not proven implemented. Release/implementation acceptance requires the tests above to pass against the **actual pinned package versions**, plus a real one-script installation against an existing personal Git repository, working jig command, enabled service, repository-contained SQLite/JSON, automatic commit/push and pull while browser closed, safe unrelated working-tree coexistence, and explicit conflict/failure demonstrations.

If the Astryx ListItem/dnd-kit integration fails in the browser, fix the smallest view composition while keeping Astryx tokens and one drag owner; do not import another whole UI kit or silently broaden dependencies. If exact pinned versions cannot install/build, document the proven incompatibility and resolve the single affected dependency through explicit design review rather than silently upgrading all packages.

## 11. Explicitly deferred capabilities

Independent phone installation, native mobile Git/process/filesystem integration, concurrent offline multi-device merge, domain-level conflict-resolution UI, application-level trash/soft-delete/undo/restore, background/push notifications, Order WorkItem creation, automatic project-task synchronization, metrics/dashboard, team collaboration, repeated scheduling, subtasks, duration estimation and general workflow constraints are excluded. The canonical Task format and Git record identity intentionally leave room for later extension, but none of these capabilities is represented as implemented by this design.

## 12. Decision history and minimality rationale

- **SQLite primary inside the selected personal repository:** Operational queries, atomic multi-item reordering and crash recovery remain simple; only deterministic logical records are Git committed. No user task data is stored by default in the public Jig source repo.
- **One exporter and one importer instead of two live authorities:** SQLite owns local edits; Git versions validated snapshots at explicit synchronization boundaries.
- **Dedicated branch + linked worktree in the selected repository:** Automatic Jig commits cannot accidentally stage, push, modify or merge unrelated personal documentation. Same Git object store, not a second repository.
- **Automatic bounded Git sync instead of manual export:** Local SQLite saves trigger background commit/fetch/push with safe retries even when the browser is closed; network status is separately visible.
- **Fast-forward/single-writer synchronization instead of premature merging:** Prevents silent data loss; truthful limits when both replicas edit independently. Domain-aware merge requires future design.
- **Astryx directly instead of copying Order:** Reuses published UI semantics without coupling Jig to software-factory workflows.
- **dnd-kit instead of Astryx same-list reordering plus custom cross-day dragging:** One coordinated drag system across all seven date columns with a single canonical move command.
- **Browser-side toasts instead of background infrastructure:** Exact compliance with open-app reminder requirements.
- **One Task and derived views instead of multiple planning objects:** Satisfies all 22 functional requirements without building a project manager.

**Implementation planning can now be derived from this document and [the UI solution](../design/ui-solution.md).** The plan must preserve the boundaries above, prove the specified acceptance gates, and must not interpret non-goals as implied features.
