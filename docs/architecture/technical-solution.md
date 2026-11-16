# Jig — technical solution design

**Status:** Decision-complete desktop MVP technical design, proposed for adoption (2026-11-16). Not yet implemented or runtime-certified.
**Concern owner:** Jig architecture, canonical task representation, persistence, Git exchange, UI realization, operation admission, and verification.
**Governing documents:** [Product definition](../product/product-definition.md) and [Planning workbench functional design](../requirements/planning-workbench.md), JIG-FR-01 through JIG-FR-14.
**Scope boundary:** Single-user desktop installation, local browser UI, mobile-first responsive semantics, Git-backed portability, no hosted Jig service.

## 1. Decision and acceptance boundary

Jig is a date-oriented planner, not a project manager or an Order WorkItem frontend. The smallest implementation is one Bun application serving a React/Astryx web interface, one local SQLite database containing authoritative active task state, and a separate Git repository containing deterministic portable exports. Task changes are immediately saved in SQLite; Git is used only at explicit backup/synchronization boundaries.

This document closes the implementation architecture for the desktop MVP. It defines a **safe single-writer, fast-forward Git exchange model**. It does not claim to provide automatic reconciliation of divergent concurrent device edits or a standalone phone installation. Both remain future capabilities and must not be represented as complete. These limits preserve the product's eventual independent-device direction without turning the MVP into a distributed database.

| Decision | Selected solution | Reason |
|---|---|---|
| Runtime | Bun 1.4.4 local process, one HTTP listener bound to loopback | Reuses Order's audited baseline; direct filesystem, SQLite and Git access |
| UI | React 19.3.1, TypeScript 7.0.2, Vite 8.3.5 | Same basic technology as Order |
| UI foundation | @astryxdesign/core 0.7.13 and @astryxdesign/theme-neutral 0.7.13; @stylexjs/stylex 0.19.1 as peer dependency | Existing tested public component and token vocabulary |
| Drag interaction | @dnd-kit/react 0.5.3, one drag coordinator for all task lists | Handles cross-day moves and empty days; avoids two competing reorder systems |
| Local store | bun:sqlite, one authoritative writer | Atomic positional edits, fast date queries, simple history |
| Git | Task-per-file stable JSON export with format/version metadata, private data repository | Textual, portable, versioned logical state instead of an unmergeable live database |
| Notifications | Browser-side due-check and Astryx Toast while the application is open | Meets JIG-FR-10 without servers or background delivery |
| Mobile | Same domain and controls, day-oriented narrow layout; independently installable phone excluded from desktop MVP | Maintains responsive continuity without premature native/Git architecture |
| Work integration | Optional outbound reference only | Order, SPAN, and project authority stay external |

The original Day-labelled concept imagery is layout exploration, not an authority for colors, shadows, typography, extra navigation destinations, sample dates or domain status.

## 2. Dependency contract and provenance

The initial dependency set is exact-pinned; no wholesale Order package manifest is copied.

**Production:** react 19.3.1; react-dom 19.3.1; @astryxdesign/core 0.7.13; @astryxdesign/theme-neutral 0.7.13; @stylexjs/stylex 0.19.1 (Astyx peer); @dnd-kit/react 0.5.3.

**Development:** typescript 7.0.2; vite 8.3.5; @types/react 19.3.0; @types/react-dom 19.3.0; @types/bun 1.4.4; vitest 5.0.5; @playwright/test 1.64.1. Use Bun 1.4.4 as the installed runtime; pin it in repository runtime metadata. The exact baseline is a reproducibility selection, not a claim that later packages are incompatible.

Use Bun built-ins for SQLite and spawning Git. Do not add an ORM, repository object abstraction, task mapper/DTO layer, date utility package, notification service, state-management framework, CodeMirror, OpenCode SDK, Tailwind build integration, a StyleX compiler plugin or a second UI toolkit without demonstrated necessity. Astryx's published core CSS and built Neutral theme are sufficient for the initial presentation; custom Jig board geometry uses a small stylesheet consuming public Astryx tokens.

**Verified references:**
- [Order manifest](https://github.com/pontivus-com/order/blob/master/package.json), [runtime pin](https://github.com/pontivus-com/order/blob/master/.bun-version), [UI imports](https://github.com/pontivus-com/order/blob/master/ui/src/styles.css), [theme](https://github.com/pontivus-com/order/blob/master/ui/src/theme.css).
- [Pinned Astryx core package](https://github.com/meta/astryx/blob/v0.7.13/packages/core/package.json), [Calendar](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Calendar/index.ts), [List](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/List/List.doc.mjs), [Toast](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/Toast/index.ts), [date input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/DateInput/index.ts), [time input](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/TimeInput/index.ts), [AppShell](https://github.com/meta/astryx/blob/v0.7.13/packages/core/src/AppShell/index.ts).
- [dnd-kit current React API](https://dndkit.com/react/quickstart/) and [multiple-sortable-lists guide](https://dndkit.com/react/guides/multiple-sortable-lists/).
- [Bun SQLite API](https://bun.com/docs/runtime/sqlite) and [Git merge/fast-forward contract](https://git-scm.com/docs/git-merge).

## 3. Runtime and responsibilities

~~~text
Desktop browser (same-origin localhost)
    React + Astryx screen composition
    @dnd-kit/react presentation gestures
    browser clock + transient reminder toast
             |
             | HTTP, typed canonical task operations
             v
Bun process (loopback only; single writer)
    request admission / boundary checks
    pure task and date/ordering functions
    bun:sqlite transactional persistence
    Git export / import / optional fetch-push adapter
             |
             +--> jig.sqlite (authoritative local operational state)
             |
             +--> sync/.git + sync/tasks/*.json (portable snapshot)
~~~

**Functional core:** Pure functions define scheduling, priority-assisted insertion, order relocation, completion, reopening, date navigation helpers and invariant validation. They consume typed values and return typed updated values or explicit classified failures. They do not access React, SQL, clock, filesystem, Git, process environment, or notification APIs.

**Imperative shell:** One owning module per effect boundary: HTTP and boundary validation, SQLite transactions, Git operations, current time, and browser notification delivery. Avoid service classes, an object/repository hierarchy, a second browser task store, an event bus, or redundant representations of the Task.

**Browser:** Controls selected date, open editor, unsaved input and temporary drag preview. It does not own authoritative tasks; week/day/history views consume canonical task read results. Do not load full task state into localStorage or IndexedDB. One currently selected task is a view reference by ID, not another task copy.

**Single writer:** Only the local Bun service mutates SQLite. The same daemon serializes task mutations and import/export. During an import/export critical section, affected writes wait or return a clearly identified retryable busy outcome; reads remain observational. No browser directly edits the Git working tree.

**HTTP baseline:** Same-origin GET for task/date/history read and POST/PATCH for canonical mutations. The minimum command vocabulary is create, edit, move, complete, reopen, export, import and sync; no generic workflow-command engine. A task mutation returns the committed canonical state (or the affected-date lists derived from it) and a revision. Transport-specific HTTP parsing is confined to request admission and does not introduce independent task DTO classes.

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

There is **no persisted WorkItem, Day, Week, Board, project workflow, task status enum, scheduled duration, time estimate, completion-history duplicate, or separate ordering authority**. An outstanding task is precisely one with completed_at = null. Its position is non-null. A completed task has completed_at non-null and position null. Reopening preserves id and scheduled_date but clears completed_at and assigns the end position for that date.

A task's scheduled civil date is stable across devices and must not be recalculated from UTC. The browser's current local calendar determines “today.” A reminder is a local clock indication for the device using Jig, not a guaranteed cross-timezone event at one globally fixed instant. Actual completion instants remain UTC; the history groups those instants by the viewing device's local calendar date.

Task references are treated as data: safe http(s) links may open with normal browser navigation; other paths/locators are copied rather than executed. No reference dereferencing, shell interpolation, repository scanning or automatic Order integration.

### 4.1 Invariants

1. Every task has a stable unique ID and exactly one scheduled_date.
2. Within a date, outstanding positions form exactly 0..N-1 with no duplicates or gaps; completed tasks have no active position.
3. The user-selected sequence is authoritative; priority updates never reorder it.
4. Date moves preserve all task metadata and identity except scheduled_date and position; reminder_time stays the same and is interpreted on the new date.
5. Completion records an instant and removes the item from its outstanding sequence; reopening appends it, rather than guessing its former position.
6. No automatic rollover changes yesterday's tasks.
7. A failed mutation leaves all affected dates unchanged; UI reports failure without implying a save.
8. Every imported snapshot passes the same invariants before it can replace local state.

### 4.2 Operation algorithms

**Create:** Validate title and date; default priority NORMAL. Find the last existing outstanding task on that date whose priority is equal to or higher than the new item's priority; insert immediately after it, otherwise insert at index 0. Preserve all existing items' relative order; renumber only the affected day. Example: HIGH=3, NORMAL=2, LOW=1, find the last item with score >= new score. This is exactly the functional specification's insertion law even in a manually mixed list.

**Explicit drag movement:** Remove ID from source sequence; insert at the indicated target index in target date; when source=target, index means the position in the list **after removal**. Renumber the affected one or two dates. Drag target date and position must be explicit, not derived from priority. Moving to a date using the date editor applies the priority-based initial insertion law instead of a drag-index rule.

**Edit:** Title, note, reference, context, priority or reminder edit keeps date and position unchanged. An explicit date edit removes the task from its original outstanding sequence and inserts into the destination via priority law. Editing a completed task's date preserves completed_at and leaves it outside active ordering.

**Complete:** Set completed_at using the shell's current instant; set position to null and compact the remaining outstanding sequence. No attempt is made to complete the referenced work in Order or any project.

**Reopen:** Clear completed_at; keep scheduled_date, priority and reference; append at the end of the outstanding sequence. No completion history event log is required in v1.

**Read:** Week is seven consecutive local civil dates beginning Monday; day is the selected date; past unfinished work is the same outstanding query for dates earlier than today; completed by scheduled date is distinct from history grouped by local completion date. Date navigation does not modify tasks.

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

Technical input validation must also enforce canonical date/time formats, nonblank titles and valid IDs before SQL insertion; CHECK constraints alone do not validate those strings. One app metadata table records schema version, monotonically increasing local state revision, last exported revision and the last successfully imported/exported Git commit. A separate local reminder-delivery key set can suppress duplicate toasts; it is non-authoritative presentation bookkeeping and is **not included in Git exports**.

Apply reordering in one SQLite transaction. To satisfy the active-position uniqueness constraint while changing multiple indices, first move affected positions to distinct temporary nonconflicting values within that same transaction, then write final 0..N-1 positions. No intermediate ordering can be observed outside the transaction. If the transaction fails, the whole operation rolls back.

Use prepared statements and explicit transactions. WAL may be enabled for local concurrent reading, but the WAL/SHM sidecars are runtime files and never Git-managed or treated as standalone recoverable backup. Do not assume copying a live SQLite file is a consistent portable export.

## 5. Astryx UI composition and responsive behavior

Consume the public Astryx components directly; do not import Order's internal Workbench* modules or duplicate their lifecycle semantics. Use the Neutral theme and public semantic roles, not the original green decorative screenshot palette. One application theme owner supports System/Light/Dark; browser visual preference is not task state.

| Jig region | Astryx foundation | Jig-specific part |
|---|---|---|
| App frame | AppShell, Layout, Grid/Stack | Minimal Week / Day / History navigation |
| Week planner | Grid/Stack, List/ListItem, Button/IconButton | Seven dated columns; visible droppable column areas |
| Day planner | List/ListItem, section heading, Button | Selected date, outstanding and completed query |
| Capture/editor | TextInput, TextArea, Selector or SegmentedControl, DateInput, TimeInput, Dialog/FormLayout | Task field rules and save/admission |
| Inspector/compact editor | Drawer, Dialog, responsive composition | Show only task details and external reference |
| Status/feedback | Banner, Toast/useToast/LayerProvider | Persistence error and reminder messages |
| Completion/navigation | CheckboxInput, Link/Buttons | Complete, reopen, open/copy reference |
| Interaction mechanics | @dnd-kit/react | Same-day order and cross-date placement |

Use **a single drag owner**: DragDropProvider around the week, useSortable per outstanding task and useDroppable per dated column, including empty dates. The drag adapter supplies only (task ID, destination date, insertion index) to the functional core; it may animate a transient preview but cannot write canonical tasks until a valid drop commits. Escape/cancel restores pre-drag presentation. A failed save restores the committed order or keeps it visibly pending with an actionable retry; it must never silently pretend success.

**Do not simultaneously enable the Astryx List createReorderable behavior on those same rows.** Its pinned 0.7.13 callback reports same-list (key, to) moves and is insufficient for destination-date transfer. Dnd-kit owns all drag handles, sensors and drop geometry; Astryx owns appearance, focus/field treatment and reusable row structure. Verify ref/handle interaction with actual Astryx ListItem; if direct ListItem integration is incompatible, compose the same Astryx leaves/tokens in a thin Jig task row instead of adding a second DnD system.

Keyboard alternative: expose Move up, Move down and Move to date actions with descriptive accessible labels, even if library sensors also support keyboard dragging. These commands call the **same move operation**; no second order representation. Completion, task editing and reference opening must not accidentally start dragging.

Desktop: week is the default with seven dated columns; maintain a usable minimum column width and allow horizontal board scrolling when necessary rather than compressing task text below readability. A column with a long list scrolls without hiding its date heading or preventing other dates from being reached. Day detail is one selected date; completed section is compact. Do **not** add a duplicate generic Board destination: Week is the Kanban surface.

Mobile-first composition: at narrow widths present a compact horizontal week strip and one date's list, not seven tiny columns; preserve the exact selected task and in-progress editor on responsive change. Use touch-sized targets and a move-to-date alternative. Standalone phone installation, native filesystem and on-device Git are future implementation work, not promises of this desktop runtime. Choose one responsive breakpoint owner in Jig UI; do not replicate independent layout breakpoints in each component.

Presentation rules: consistent spacing and density, one primary action, accessible focus distinct from selection, restrained priority signaling, text labels with semantic status, no hover-only essential action, and reduced-motion compliance. Any custom CSS exists only for Jig-specific calendar columns, drag indicators and responsive composition and consumes verified public Astryx tokens.

## 6. Browser reminders

A reminder is optional HH:mm on a scheduled date. The browser UI evaluates due outstanding tasks only while Jig is open and visible; it uses the device's local civil date/time, periodically checks active reminders (at least once per minute), and rechecks on tab visibility/focus. An eligible reminder produces an Astryx dismissible toast; an OS/browser notification is an optional permitted enhancement, not an acceptance dependency.

Keep the implementation bounded: no push sender, persistent scheduler, service worker notification daemon, background queue, or alert guarantee when Jig is closed or the machine sleeps. Delivery is best effort while the UI is running. A locally stored key (task ID + scheduled date + reminder time) suppresses repeated display on each timer tick and reload. On changing date/time, the new key becomes eligible; on completion it is no longer eligible. Suppression state remains device-local and cannot change Task completion or scheduled order. Do not replay stale reminders from past dates as a flood on application launch.

Failure to use system notifications must not suppress the in-app toast. Reminder messages are transient; failed persistence/synchronization messages require durable visible feedback instead of only a toast.

## 7. Local filesystem, Git export and recovery

### 7.1 Data ownership and location

The public pontivus-com/jig source repository contains no user planning data. A single selectable private data directory holds the entire portable installation state, for example:

~~~text
jig-data/
  jig.sqlite
  jig.sqlite-wal / jig.sqlite-shm     (transient, if WAL is active)
  sync/
    .git/
    format.json
    tasks/
      <task-uuid>.json
~~~

On a normal install, use the OS application-data directory; an explicit JIG_DATA_DIR override selects a portable location. The SQLite database is never committed to Git. Do not point the data repo at the public source repo by default. The user may configure a separate user-controlled Git remote, including a filesystem or SSH URL, without any Jig-hosted account/service.

**Authority:** SQLite is the authority for live local edits and queries. The Git tree is a versioned exchange **snapshot**, not a second continuously editable datastore. Only the Jig export/import boundaries may translate between them. Import validates before adopting a Git snapshot. External manual edits to task JSON are not accepted as a live mutation or silently synchronized into SQLite.

### 7.2 Portable representation

The Git repository stores one UTF-8 JSON file per Task, keyed by its UUID, and a small format.json specifying a recognized format version. The task JSON contains exactly the canonical Task fields from §4, in fixed key order, UTF-8, with stable ISO date/time representation, normalized newline and deterministic serialization. No local SQLite row IDs, database file paths, browser state, per-device toast receipts, credentials, local timezone/locale or cache content enter the portable snapshot.

The snapshot invariant is: each path ID equals its Task ID, every imported Task passes validation, and all scheduled dates contain a valid contiguous active sequence. A snapshot includes completed tasks as well as unfinished tasks. Missing records during a **full snapshot restore** mean those records are absent; such a replace operation requires explicit operator confirmation because data may otherwise be lost. Task deletion is not an MVP UI capability; v1 neither invents a hidden delete command nor treats a missing file as a request to delete one task during incremental sync.

### 7.3 Minimum desktop operations

**Export / local backup:**
1. Read a consistent SQLite snapshot and its local revision, without changing Task state.
2. Serialize all canonical tasks deterministically into the private Git worktree using temporary writes and safe replace operations; validate resulting files.
3. Stage the exact app-owned paths and commit if content changed. Do not stage unrelated user files or the SQLite database.
4. Record exported revision and Git commit in SQLite only after Git success. If interrupted after Git commit but before metadata update, compare the committed snapshot with SQLite on recovery and reconcile the marker idempotently.
5. On Git error, leave SQLite intact and show unsynchronized/backup-failed status with a retry path.

**Import / restore:** Work from a named Git commit or validated local snapshot. Read into temporary application memory, validate all records and ordering, present the replacement consequence, then replace the Task set atomically in a single SQLite transaction. Record the source commit on success. Invalid format, duplicate UUID, missing/duplicate positions, or failed transaction reject the entire import without changing local Task state. An import never erases unsynchronized local edits implicitly; require explicit confirmed replacement, with a recoverable local backup first.

**Remote fast-forward sync:** The default contract is one active editing device at a time. Remote configuration uses existing Git mechanisms; no service is hosted by Jig.
- Fetch remote first and determine common ancestry and whether SQLite has unexported edits.
- If remote is ahead and local has no unpublished changes, fast-forward the private Git checkout, validate and atomically import remote state.
- If local is ahead and remote has not changed, export locally and push; treat push rejection as **not synchronized**, while keeping local data.
- If remote and local are equal, export any new SQLite edits, commit and push.
- If both sides advanced or remote advanced while SQLite contains unsynchronized edits, stop with an actionable divergence result; **do not use git pull --rebase, silent last-writer-wins or automatic merge**.
- A sync claim is successful only when the relevant Git operation and any required SQLite adoption have both completed. A local save remains successful even if a later Git transfer fails.

This limited model provides truthful versioned backup and transport, including a viable future sequential desktop/phone workflow. It does **not** claim to merge independently edited offline replicas. For a divergent replica, preserve local and fetched remote commits so neither is lost; direct the operator to explicit manual reconciliation outside the MVP, then validate and import the reconciled snapshot. Before multi-device concurrent editing is promoted to a product capability, design and test a domain-aware reconciliation policy for same-task edits, same-day order changes, date moves and deletions.

### 7.4 Failure and recovery truth table

| Failure | Canonical effect | Visible outcome |
|---|---|---|
| SQLite mutation fails | No task/date/order change committed | Save failed; retry without claiming success |
| Browser reload mid-edit | Previously committed Task unchanged | Draft may be lost unless the editor remained open; never claim unsaved draft was stored |
| Process dies during DB transaction | SQLite rollback/recovery | Last committed task state on restart |
| Git export fails before commit | SQLite unchanged; worktree may be dirty | Local saved, backup incomplete; next attempt cleans/rebuilds app-owned export |
| Git commit succeeds; marker update fails | Git commit is recoverable; SQLite remains authority | Reconcile by checking snapshot equality; no duplicate user item |
| Fetch/push fails | Local tasks unchanged | Clearly display unsynchronized state |
| Remote diverges | Both Git histories retained, no auto-import | Conflict requiring explicit resolution |
| Imported file invalid | No SQLite replacement | Import refused with exact reason |
| User selects older restore snapshot | Original DB remains until confirmation and successful transaction | Explicit destructive restore confirmation and recoverable pre-restore backup |

No Git failure can retroactively negate a successfully committed local SQLite task edit.

## 8. Security and trust boundaries

Run HTTP on 127.0.0.1 only by default; no publicly bound listener and no external login. Require same-origin requests and reject cross-origin mutation attempts. Use a per-install or per-session unpredictable write token supplied to the same-origin UI for state-changing requests, with no permissive CORS. Do not assume “localhost” alone prevents cross-site request abuse.

All external input (HTTP, imported JSON, Git configuration) is untrusted. Check canonical Task formats and commands at the admission boundary. Use prepared SQL; invoke Git with an argument-array subprocess, never interpolated shell commands. Validate app-managed paths stay inside the configured data root. Never execute Task reference strings, clone arbitrary task references, or expose local filesystem contents through a task URL. Avoid logging personal titles, notes and references. Keep Git credentials in the user's normal Git/SSH mechanism, never in portable JSON.

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
    git.ts                  deterministic export, validated import, ff sync
    main.ts                 app startup and static UI serving
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
| JIG-FR-09 past outstanding | Date queries | Yesterday remains outstanding until explicitly moved/done |
| JIG-FR-10 in-app reminder | Browser clock + Astryx Toast | Due while open => one dismissible toast; no closed-app guarantee |
| JIG-FR-11 external context | Reference open/copy UI | Link/path accessible; no source-content import |
| JIG-FR-12 honest outcome | HTTP/SQLite/Git outcome and UI | Failed save or sync never rendered as persisted success |
| JIG-FR-13 responsive continuity | Same Task + Astryx responsive composition | Narrow/wide navigation preserves selection and draft |
| JIG-FR-14 local retention | SQLite + Git export/import | Full state survives restart; export/restore yields equivalent tasks/order/history |

### 10.1 Test boundaries

**Core tests:** Exhaustive representative priority mix, insertion at both ends, same-day and cross-day movement, empty destinations, cancellation/no mutation, rank compaction, priority changes, completed-task rescheduling, reopening, and edge dates including month/year boundaries.

**SQLite integration:** One failed transaction rolls back every affected position/date; uniqueness and completeness checks; restart with WAL; task query by scheduled and completion dates; migration from a fresh empty database; corrupted input rejected before persistence.

**Git integration:** Two temporary repositories and a file/SSH-independent local bare remote; deterministic export twice produces no spurious changes; export/import round trip matches all canonical fields; interrupted export/commit marker recovery; invalid JSON and invalid order are rejected atomically; fast-forward in both directions; push rejection and divergent histories preserve both sides; restore of older snapshot is explicit.

**Browser interaction:** Real Astryx components and dnd-kit are tested together using Playwright: same-day drag, Thursday-to-Friday drag, empty-day drop, Escape cancel, task checkbox/link/editor non-interference, keyboard move alternatives, long-list scrolling, mobile narrow layout, responsive switching with unsaved editor, in-app due toast, and durable save-error visibility.

**Security:** Loopback-only listener, same-origin/token checks, no arbitrary task-reference execution, no shell invocation via Git parameters, path containment and no task data in public source.

### 10.2 Technical acceptance gate

The design is closed at the **architecture and dependency selection** level, not proven implemented. Release/implementation acceptance requires the tests above to pass against the **actual pinned package versions**, plus a real desktop installation with a selectable data directory, successful restart, Git snapshot round trip, and explicit conflict/failure demonstrations.

If the Astryx ListItem/dnd-kit integration fails in the browser, fix the smallest view composition while keeping Astryx tokens and one drag owner; do not import another whole UI kit or silently broaden dependencies. If exact pinned versions cannot install/build, document the proven incompatibility and resolve the single affected dependency through explicit design review rather than silently upgrading all packages.

## 11. Explicitly deferred capabilities

Independent phone installation, native mobile Git/process/filesystem integration, concurrent offline multi-device merge, conflict-resolution UI, background/push notifications, Order WorkItem creation, automatic project-task synchronization, metrics/dashboard, team collaboration, repeated scheduling, subtasks, duration estimation and general workflow constraints are excluded. The canonical Task format and Git record identity intentionally leave room for later extension, but none of these capabilities is represented as implemented by this design.

## 12. Decision history and minimality rationale

- **SQLite primary instead of Git text primary:** Operational date queries, atomic multi-item reordering, and crash recovery are simpler with one SQLite writer. Git receives deterministic logical exports and never the live SQLite database.
- **One exporter and one importer instead of two live authorities:** SQLite owns local edits; Git versions validated snapshots at explicit synchronization boundaries.
- **Fast-forward/single-writer synchronization instead of premature merging:** Prevents silent data loss; truthful limitations for the desktop MVP. Concurrent mobile editing requires a separate domain-aware policy before it can be claimed.
- **Astry​x directly instead of copying Order:** Reuses published UI semantics without coupling Jig to software-factory workflows. (The name in this sentence refers to Astryx.)
- **dnd-kit instead of Astryx same-list reordering plus custom cross-day dragging:** One coordinated drag system across all seven date columns with a single canonical move command.
- **Browser-side toasts instead of background infrastructure:** Exact compliance with open-app reminder requirements.
- **One Task and derived views instead of multiple planning objects:** Satisfies all 14 functional requirements without building a project manager.

**Implementation planning can now be derived from this document.** The plan must preserve the boundaries above, prove the specified acceptance gates, and must not interpret non-goals as implied features.
