# Jig — v1 MVP implementation plan

**Status:** Implementation-ready execution plan, v1.2 (2026-11-16), completeness-audited against JIG-FR-01–22, Technical solution v0.6 and UI solution v0.3.
**Target:** Build and certify the first Jig desktop MVP without reopening product, functional, technical, or UI design.
**Required baseline:** Implement only from a repository revision that contains the current canonical product definition, JIG-FR-01–22 functional design, technical solution v0.6 or later, and UI solution v0.3 or later.

## 1. Authority and execution rule

The implementation team MUST treat these documents as the design authority, in this order:

1. `docs/product/product-definition.md` — product job, scope and non-goals.
2. `docs/requirements/planning-workbench.md` — observable JIG-FR-01–22 behavior.
3. `docs/architecture/technical-solution.md` — runtime, data, API, persistence, repository boundary, source map and acceptance.
4. `docs/design/ui-solution.md` — information architecture, interaction composition and browser/UX acceptance.
5. `docs/design/reference/*.svg` — structural visual references only.

This plan owns execution order and implementation tasks. It does not redefine those contracts. If implementation evidence shows a pinned API is incompatible, stop at that exact dependency boundary, record the evidence, and make the smallest design-review correction. Do not silently redesign Jig.

## 2. Non-negotiable implementation constraints

- One canonical `Task` type. Week, Day, History, completed and carry-over are derived views/queries, not persisted copies.
- Functional core is typed, pure and I/O-free. It owns Task invariants and create/edit/move/complete/reopen/delete semantics.
- No DTO layer, mapper stack, service/repository class hierarchy, event bus, workflow framework or second task authority.
- One Bun process owns SQLite writes and repository synchronization scheduling.
- SQLite is immediate local authority. Repository export/synchronization is eventual and never blocks a successful Task save.
- Git history, branch, merge and conflict reconciliation stay outside Jig's domain.
- Repository integration uses the isolated `jig-data` ref/worktree and never stages or rewrites unrelated repository content.
- Directly consume published Astryx components. Order is implementation evidence only; do not copy its WorkItem domain or private `Workbench*` layer.
- `@dnd-kit/react` is the single drag owner. Do not enable Astryx List reordering on Jig task rows.
- No React Query/state framework, ORM, Git library, notification service, Tailwind integration or second UI toolkit.
- System/Light/Dark are mandatory. Theme is presentation state only.
- No soft delete, tombstone, trash or in-app restore.
- No automatic rollover mutation. Carry-over is derived from an earlier unchanged `scheduled_date`.

## 3. Target implementation surface

Start with the minimum cohesive layout below. Add another production module only when an existing module would otherwise acquire a second present responsibility.

```text
package.json
bun.lock
.bun-version
tsconfig.json
vite.config.ts
index.html
src/
  core/
    task.ts
    planning.ts
  shell/
    sqlite.ts
    git.ts
    http.ts
    main.ts
scripts/
  install.sh
  jig
ui/
  src/
    main.tsx
    app.tsx
    http.ts
    task-row.tsx
    week.tsx
    day.tsx
    history.tsx
    settings.tsx
    task-editor.tsx
    reminder.tsx
    styles.css
tests/
  core/
  persistence/
  sync/
  browser/
  install/
```

`task-row.tsx` and `ui/src/http.ts` are intentional small additions to the technical solution's illustrative tree. `task-row.tsx` centralizes one presentation of canonical Task semantics across Week/Day; `ui/src/http.ts` centralizes the same-origin canonical fetch/command boundary, revision handling and write-token use. Neither may introduce a second Task/command representation.

## 4. Required package scripts

Create only the scripts needed to build and certify the product:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "vite build",
    "test:browser": "playwright test",
    "verify": "bun run typecheck && bun run test && bun run build && bun run test:browser"
  }
}
```

Do not add a lint/format framework merely to satisfy this plan. Use repository-native formatting once one exists.

## 5. Master execution order

| Order | Task | Depends on | Primary outcome |
|---|---|---|---|
| 01 | V1-01 scaffold and exact dependency pins | design baseline | buildable empty application |
| 02 | V1-02 canonical Task and validation | V1-01 | one strict Task contract |
| 03 | V1-03 pure planning operations | V1-02 | all Task mutations implemented |
| 04 | V1-04 derived calendar/Day/History queries | V1-02 | Week/Day/History semantics implemented |
| 05 | V1-05 SQLite schema and metadata | V1-02 | durable local authority |
| 06 | V1-06 transactional persistence operations | V1-03,V1-05 | atomic canonical mutations |
| 07 | V1-07 loopback HTTP admission contract | V1-02,V1-06 | exact `/api/v1` boundary |
| 08 | V1-08 deterministic portable snapshot | V1-02,V1-05 | JSON/manifest round trip |
| 09 | V1-09 isolated repository adapter | V1-08 | safe `jig-data` worktree/ref operations |
| 10 | V1-10 snapshot admission/import | V1-05,V1-08,V1-09 | validated complete snapshot adoption |
| 11 | V1-11 serialized export/synchronization loop | V1-06,V1-09,V1-10 | background repository sync/status |
| 12 | V1-12 UI foundation and theme owner | V1-01,V1-07 | running Astryx shell |
| 13 | V1-13 shared Task row/editor | V1-07,V1-12 | canonical edit/complete/delete surfaces |
| 14 | V1-14 Week surface | V1-04,V1-13 | seven-day planner |
| 15 | V1-15 Day surface | V1-04,V1-13 | carry-over attention view |
| 16 | V1-16 History surface | V1-04,V1-13 | completion history + reopen/delete |
| 17 | V1-17 Settings/status surface | V1-11,V1-12 | repository/service/theme truth |
| 18 | V1-18 dnd-kit and keyboard movement | V1-03,V1-14,V1-15 | exact same/cross-date movement |
| 19 | V1-19 reminders and failure feedback | V1-07,V1-13,V1-15 | reminder/save/sync feedback |
| 20 | V1-20 responsive/mobile-sized composition | V1-14,V1-15,V1-16,V1-17,V1-18,V1-19 | 768px semantic reflow |
| 21 | V1-21 installer and configuration lifecycle | V1-05,V1-09,V1-11 | one-script installation |
| 22 | V1-22 launcher, user service and diagnostics | V1-07,V1-11,V1-21 | `jig` desktop lifecycle |
| 23 | V1-23 end-to-end browser and repository certification | V1-01..V1-22 | FR-01–22 evidence |
| 24 | V1-24 security/resource/installer certification | V1-21..V1-23 | technical acceptance evidence |
| 25 | V1-25 release-candidate evidence and documentation closeout | V1-23,V1-24 | implementation-ready MVP candidate |

Do not start V1-23 as a substitute for the lower-level tests. It certifies composition after the component boundaries are already proven.

## 6. Wave A — repository scaffold and functional core

### V1-01 — Scaffold the exact runtime and UI dependency baseline

**Files:** `package.json`, `.bun-version`, `tsconfig.json`, `vite.config.ts`, `index.html`, initial `src/shell/main.ts`, `ui/src/main.tsx`, `ui/src/styles.css`.

Implement the exact dependency pins from Technical solution §2. Use the implementation source map there for Order/Astryx provenance. Import Astryx reset/core/Neutral CSS directly; do not copy Order's CSS classes, Tailwind layers or application abstractions. Create the smallest Vite React app and Bun entry point needed to compile.

**Gate:** fresh checkout can install the frozen dependency graph, `bun run typecheck` succeeds, and `bun run build` produces the static UI.

### V1-02 — Implement the canonical Task contract

**Files:** `src/core/task.ts`, `tests/core/task.test.ts`.

Implement the exact fields and constraints from Technical solution §4. Export the canonical `Task`, priority values and input validation helpers. Validation must reject invalid UUIDs, blank titles, invalid civil dates/times, invalid priority, inconsistent completion/position state and malformed timestamps. Do not create separate persisted/HTTP/UI Task shapes.

Keep creation timestamps/UUID generation outside the pure core; the shell supplies them.

**Gate:** table-driven tests cover every field boundary and every invalid invariant; no other production Task type exists.

### V1-03 — Implement pure Task mutation algorithms

**Files:** `src/core/planning.ts`, `tests/core/planning.test.ts`.

Implement create insertion, metadata edit, date edit, exact same-date move, exact cross-date move, complete, reopen and delete exactly as Technical solution §4.1–4.2 and the functional design specify. Operate on canonical values/ordered collections and return canonical results without I/O.

Required adversarial tests include manually mixed priorities, insertion at beginning/end, source=destination after-removal indexing, empty destination, month/year boundary dates, completed-date edit, reopen append, outstanding delete compaction and completed delete.

**Gate:** all mutation tests are deterministic and no operation can create duplicate/gapped active positions.

### V1-04 — Implement derived views and calendar helpers

**Files:** `src/core/planning.ts`, `tests/core/views.test.ts`.

Implement Monday-start Week derivation, selected Day composition, carry-over prefix, completed-by-scheduled-date and History-by-local-completion-date queries. Carry-over order is original `scheduled_date` ascending then persisted position. Week never duplicates carry-over into later columns. Carry-over never mutates or re-arms a reminder.

**Gate:** tests demonstrate that navigation/query execution produces no Task mutation and that Thursday unfinished work appears on Friday/Saturday Day views with Thursday retained.

## 7. Wave B — local persistence and command boundary

### V1-05 — Create SQLite schema and app metadata

**Files:** `src/shell/sqlite.ts`, `tests/persistence/schema.test.ts`.

Create the Task table/indexes from Technical solution §4.3 plus one minimal metadata table for schema version, dataset identity, SQLite revision, last exported revision/head, last adopted snapshot marker and durable pending-sync state. Keep reminder delivery suppression local/noncanonical.

Initialize/migrate idempotently. SQLite path is `<selected-repo>/.jig/local/jig.sqlite`; WAL/SHM remain runtime-only.

**Gate:** fresh DB, restart, WAL use and schema-version checks pass; a malformed schema/version fails explicitly rather than being guessed.

### V1-06 — Implement atomic SQLite mutation/read operations

**Files:** `src/shell/sqlite.ts`, `tests/persistence/mutations.test.ts`.

Map each canonical command to the pure core inside one transaction. Use temporary nonconflicting positions before final 0..N-1 writes when reordering. Increment the local revision exactly once per successful Task mutation. Failed transactions leave all affected dates and the revision unchanged.

Expose canonical reads only: complete Task set + revision and the minimal persistence metadata needed by the shell.

**Gate:** injected failure tests prove rollback across one-date and cross-date mutations; restart reproduces the committed canonical state.

### V1-07 — Implement the exact loopback HTTP boundary

**Files:** `src/shell/http.ts`, `src/shell/main.ts`, `tests/persistence/http.test.ts`.

Implement Technical solution §3.2 exactly: `GET /api/v1/tasks`, `GET /api/v1/status`, `GET /api/v1/diagnostics`, `POST /api/v1/commands`, `POST /api/v1/sync`, `POST /api/v1/migrate`, `expected_revision` for Task commands, the specified status/error behavior, default port 47831 and the canonical repository-status vocabulary. `/sync` and `/migrate` are thin shell-operation admissions backed by the same sync/migration functions used elsewhere; they are not Task commands or a second domain model.

Generate one 256-bit token per service process, inject it into the same-origin application bootstrap, require `X-Jig-Write-Token` for mutations, reject cross-origin writes and do not enable permissive CORS. Serve the built Vite application from the same loopback origin so the token bootstrap and API share one trust boundary. HTTP envelopes wrap canonical values; they are not DTO/domain models.

**Gate:** HTTP tests prove stale revision makes no mutation, diagnostics contain no Task content/credentials/secrets, `/sync` only triggers the serialized worker, migration failure leaves the original data root active, missing/bad token is rejected on every state-changing POST, cross-origin mutation is rejected, static UI/bootstrap is served from the same loopback origin, and Task-command success is returned only after SQLite commit.

## 8. Wave C — portable snapshot and repository boundary

### V1-08 — Implement deterministic snapshot serialization/validation

**Files:** primarily `src/shell/git.ts`, `tests/sync/snapshot.test.ts`.

Implement Technical solution §7.2: `format.json` plus one deterministic `tasks/<uuid>.json` per canonical Task. Stable formatting/key ordering must make identical Task state byte-identical across exports. Snapshot validation rejects wrong format/dataset identity, path/embedded-ID mismatch, duplicate IDs, invalid Tasks and invalid active positions.

Do not persist a tombstone. Current Task membership is exact.

**Gate:** round-trip tests prove SQLite canonical values -> snapshot -> validated canonical values without semantic change; repeated export of identical data produces no content diff.

### V1-09 — Implement the isolated Git repository adapter

**Files:** `src/shell/git.ts`, `tests/sync/git-adapter.test.ts`.

Use Bun argument-array subprocess calls to ordinary Git. Create a new `jig-data` ref from an empty Git tree, or adopt an existing compatible ref only after validating portable format and dataset identity. Attach its linked worktree under `<repo>/.jig/git/`. Stage/commit only app-owned snapshot files. Refuse an existing unrelated/incompatible `jig-data` ref. Never use shell interpolation, force push/reset/rebase, arbitrary merge, or the user's ordinary branch/index.

Implement the four operational outcomes only: `local-only`, `pending/retrying`, `synchronized`, `sync-issue`. Do not expose Git topology to the core/UI.

**Gate:** fixture repository with unrelated staged and unstaged files remains byte/index unchanged while Jig exports/commits/pushes its isolated data; empty-tree initialization, compatible existing-ref adoption and incompatible-ref refusal are covered.

### V1-10 — Implement validated complete-snapshot adoption

**Files:** `src/shell/git.ts`, `src/shell/sqlite.ts`, `tests/sync/import.test.ts`.

When the repository adapter has one complete candidate snapshot, validate all of it before touching SQLite. Adopt membership and values in one SQLite transaction. A Task absent from the accepted complete snapshot is deleted locally. Invalid candidate data leaves the previous SQLite state intact and becomes a generic sync issue.

Persist enough adopted-snapshot metadata to resume safely after a process crash without inventing another authority.

**Gate:** valid import, deletion-by-absence, invalid snapshot rejection and crash/retry fixtures pass.

### V1-11 — Implement the serialized export/synchronization loop

**Files:** `src/shell/main.ts`, `src/shell/git.ts`, `tests/sync/worker.test.ts`.

Implement the exact 3-second debounce / 15-second maximum flush and 60-second healthy polling / 5,10,20,40,80,160,300-second retry schedule. Browser presence is irrelevant. If SQLite advances during export, leave the later revision pending for the next cycle.

Local saves never wait for Git. A Git/export failure never rolls back SQLite. The adapter may provide a candidate snapshot only after repository state outside Jig resolves to one concrete snapshot. On startup, reconcile the explicit failure window where a Git commit succeeded but the exported-revision/head metadata update did not; recover from the actual committed snapshot/head rather than duplicating or losing the export.

**Gate:** fake-clock/process tests prove batching, retry/reset behavior, browser-independent synchronization, preservation of local authority through failures, and commit-succeeded/metadata-update-failed crash recovery.

## 9. Wave D — UI foundation and functional surfaces

Before this wave, read Technical solution §2.1. The implementation source map is mandatory provenance. Use Astryx public components directly.

### V1-12 — Build app shell, navigation and one theme owner

**Files:** `ui/src/main.tsx`, `ui/src/app.tsx`, `ui/src/http.ts`, `ui/src/styles.css`.

Build Week / Day / History / Settings navigation with Today as a Day shortcut. `ui/src/http.ts` is the single browser-side API owner: read the injected write token, fetch canonical Tasks/revision/status, submit canonical commands with `expected_revision`, and update the in-memory revision only from server responses. On HTTP 409, refetch canonical state before offering/retrying the user operation; never blindly replay a stale mutation. Preserve any open editor draft while reconciling canonical state. Surface 400/404/500 outcomes without claiming success. Do not create transport DTO classes/shapes.

Use plain browser `fetch`; do not add React Query or another state framework. Hold only selected date/task, modal draft, drag preview and theme preference as presentation state.

Implement System/Light/Dark using Astryx Neutral semantic roles and local browser preference. Do not copy Order's color literals or private wrappers.

**Gate:** navigation makes no Task mutation; canonical reads/commands use one HTTP client; a forced 409 refetches current canonical state without a blind retry or draft loss; System follows media preference; explicit Light/Dark survives browser reload without entering Git/Task data.

### V1-13 — Build shared Task row and editor

**Files:** `ui/src/task-row.tsx`, `ui/src/task-editor.tsx`.

Task row must expose independent completion control, title, optional context, exceptional priority, optional reminder, drag handle and action affordance. Avoid duplicate focus stops and hover-only required actions.

Editor supports Title, Date, Context, Priority, Reminder, Reference and Notes with explicit Save/Cancel. New Task defaults to title + initiating date only. Existing Task supports destructive Delete -> Astryx confirmation -> canonical delete command. Priority edit never reorders. Date edit uses priority-assisted insertion. Safe `http`/`https` references may open with normal browser navigation; filesystem/repository/other locators are copied only. Never execute, shell-expand, scan, clone or dereference a Task reference.

**Gate:** component/browser tests cover title-only create, metadata edit with stable order, confirmation cancel/no mutation, confirmed delete, safe HTTP(S) reference opening, non-HTTP locator copy-only behavior, and keyboard focus behavior.

### V1-14 — Build Desktop Week

**Files:** `ui/src/week.tsx`, `ui/src/app.tsx`.

Render Monday–Sunday scheduled-date columns with date header/count, current/selected treatment, ordered outstanding rows, per-date quick add and a visible empty-date drop region. Preserve readable minimum column width; horizontal board scrolling is preferable to unreadable compression.

Do not add Board, backlog, progress metrics, Normal-priority badges or project workflow detail.

**Gate:** Week matches the structural reference and FR-01–06 behavior before drag mechanics are connected.

### V1-15 — Build Desktop Day

**Files:** `ui/src/day.tsx`, shared row/editor.

Render one attention sequence: derived earlier unfinished prefix then selected-date tasks, followed by compact completed content and selected Task detail. Carried-over rows use the subtle scan-visible surface/edge + originating-date label from the design references. Old reminders display their originating date and are not shown as newly due.

**Gate:** Thursday carry-over is visible on later days without changing Task state; selected-date tasks preserve their own persisted order.

### V1-16 — Build History

**Files:** `ui/src/history.tsx`.

Group completed Tasks by actual completion date in viewing-device local time, newest first. Show original scheduled date. Provide explicit actions to reopen or confirmed-delete the same canonical Task. Keep History informational; no productivity dashboard or metrics.

**Gate:** completion/reopen/delete flow remains one Task identity through History -> Day/Week.

### V1-17 — Build Settings and synchronization status

**Files:** `ui/src/settings.tsx`, `ui/src/app.tsx`.

Expose configured repository path, remote name/presence, service/sync health, theme and diagnostics/retry. Use `GET /api/v1/diagnostics` for sanitized operational evidence, `POST /api/v1/sync` for Sync now/retry, and `POST /api/v1/migrate` for the explicit repository migration flow. Use only the four canonical status concepts: local-only, pending/retrying, synchronized, sync issue. Never expose divergence/merge/conflict as Jig workflow.

Repository migration remains deliberate: the UI collects/explicitly confirms the destination path, invokes the one shell-owned migration operation, and reloads canonical Tasks/status only after success. Do not provide an editable path field that silently switches data roots.

**Gate:** screenshots and browser tests match `desktop-settings-sync.svg` and `sync-failure-states.svg` semantics.

### V1-18 — Integrate dnd-kit as the single movement owner

**Files:** `ui/src/week.tsx`, `ui/src/day.tsx`, `ui/src/task-row.tsx`.

Use one DragDropProvider, sortable Task IDs, per-date droppables including empty dates, and transient overlay/preview. Convert a valid drop to exactly `(task_id, destination_date, destination_index)` and send the canonical move command. Escape/cancel makes no command.

Dragging a carried-over Task into the selected Day is an explicit reschedule. Provide Move up, Move down and Move to date keyboard/non-drag alternatives that invoke the same canonical semantics. Respect reduced-motion preference: motion may be suppressed but drop position, focus, announcements and all movement semantics must remain available.

**Gate:** same-day, cross-day, empty-date, carry-over-to-selected-date, cancel, checkbox/menu/link non-interference, keyboard movement and reduced-motion behavior all pass Playwright.

### V1-19 — Implement reminders and honest persistence feedback

**Files:** `ui/src/reminder.tsx`, `ui/src/app.tsx`, relevant surfaces.

Check due reminders every 30 seconds while active and on focus/visibility. Persist the device-local suppression key `(task_id, scheduled_date, reminder_time)` so reloads do not repeat the same reminder. Record the app-session start and catch up only reminders that became due during that session. A date/time edit creates a new eligible key; completion makes the Task ineligible. Do not replay stale prior-session/past-date reminders or claim delivery while Jig is closed.

Local save failure is durable/actionable near the affected operation and never shown as Saved. Repository sync issue is separate and never blocks editing.

**Gate:** reminder, reload suppression, date/time edit re-eligibility, completion suppression, session-bounded catch-up, stale reminder and save/sync separation tests pass.

### V1-20 — Implement responsive composition

**Files:** `ui/src/styles.css`, Week/Day/editor shell composition.

Use the single 48rem / 768 CSS px application breakpoint. Below it, Week becomes the horizontal date strip + one Day attention list. Preserve selected Task/date and unsaved editor draft across reflow. Keep touch targets usable and preserve non-drag movement alternatives.

**Gate:** Playwright resizes through the breakpoint with an open editor and active selection without semantic state loss.

## 10. Wave E — installation and desktop lifecycle

### V1-21 — Implement installer and configuration

**Files:** `scripts/install.sh`, configuration handling in shell startup, `tests/install/**`.

Implement Technical solution §3.1 and §3.2 exactly: `--repo`, mutually exclusive `--repo-url` + `--checkout`, optional `--remote`, optional `--port`; validation of Linux/Git/writable paths; exact Bun/dependency build; `.jig/local` and isolated worktree/ref setup; `~/.config/jig/config.json`; existing snapshot hydration; idempotent rerun; safe failure. On first initialization create one UUID `dataset_id` and persist it in both local metadata and `format.json`; replicas adopt that identity rather than generating another. Add only the narrow local `.jig/` exclusion through repository-local Git exclude handling, including `.git`-as-file linked-worktree cases.

Never `git init` an arbitrary nonrepository path, overwrite an existing checkout, modify tracked `.gitignore`, use the public Jig source checkout as a data target, or destroy an existing DB without explicit recoverable handling.

**Gate:** disposable fixture tests cover existing repo, clone mode, public Jig source checkout refusal, invalid target, rerun, new dataset identity, existing compatible Jig data, remote existing compatible snapshot adoption, incompatible existing data/ref, linked-worktree Git-common-dir handling, and failure preserving preexisting user content.

### V1-22 — Implement launcher, systemd user service and diagnostics

**Files:** `scripts/jig`, installer-generated user-service unit, shell status hooks, `tests/install/**`.

`jig` opens the ready local UI or starts the service then opens it. Implement `jig status`, diagnostic/retry `jig sync`, `jig doctor`, and `jig configure --repo <path>` deliberate repository migration behavior required by the technical solution. The CLI and HTTP operational endpoints must call the same shell-owned status/diagnostic, sync-trigger and migration functions; do not implement parallel operational paths. Migration must briefly block writers, flush/export the latest local state, validate destination ownership/identity, rehydrate/copy safely, and atomically switch configuration only on success; failure leaves the original repository active. Enforce one active writable service per configured data root before SQLite is opened for mutation.

Implement uninstall through the existing launcher/installer lifecycle rather than another daemon/tool: stop/remove Jig service/application configuration and binaries while preserving the selected repository's `.jig/` planning data by default. Do not silently enable systemd linger or alter administrator policy.

Use `systemd --user` when available; otherwise provide the documented foreground fallback and truthfully mark background-service capability unavailable. These commands report operational facts; they do not become another domain API.

**Gate:** install -> stop/start -> `jig` -> browser readiness -> restart works with no terminal-resident process required in the normal supported environment; a second writer for the same data root is refused; repository migration succeeds atomically and rolls back on injected failure; uninstall removes runtime/service artifacts while preserving planning data.

## 11. Wave F — end-to-end certification

### V1-23 — Prove all functional requirements in the real browser/runtime

**Files:** `tests/browser/**`, repository fixtures under `tests/sync/**`.

Implement the complete browser matrix in UI solution §6, the browser interaction boundary in Technical solution §10.1, and the FR-01–22 traceability matrix in Technical solution §10. Use actual pinned Astryx and dnd-kit versions. Do not substitute unit tests for interactions that depend on focus, pointer/touch, drag geometry, responsive reflow or visual theme state.

Minimum integrated scenario:

1. fresh install against a dirty personal Git fixture;
2. launch Week and create title-only tasks across several dates/priorities;
3. manually reorder, change priority without reorder, and cross-date drag to exact positions;
4. leave an earlier task unfinished and verify carry-over on later Day views;
5. edit all optional fields and verify reference open/copy behavior;
6. trigger/dismiss reminder while open;
7. complete, inspect History, reopen, complete again and delete after confirmation;
8. verify local save while repository transport is unavailable and later synchronization recovery;
9. restart service/browser and verify exact canonical state;
10. verify Light, Dark and System representative surfaces;
11. verify narrow layout, long-list scrolling/sticky date reachability, reduced-motion behavior and keyboard/non-drag movement;
12. force a stale `expected_revision` and verify canonical refetch/no blind mutation retry;
13. verify safe HTTP(S) reference opening and copy-only behavior for non-HTTP locators.

**Gate:** every FR row has a passing automated or explicitly documented environment-bound acceptance case.

### V1-24 — Certify security, resource use and installer behavior

**Files:** acceptance scripts/tests; no new production architecture.

Prove loopback-only binding, same-origin/token mutation protection, path containment, safe Git argument invocation, single-writer enforcement, no arbitrary Task-reference execution, no credentials/secrets or personal Task titles/notes/references in ordinary logs, and no personal Task data in the public source checkout.

Measure Technical solution §7.6 exactly: ≤128 MiB RSS and ≤1.0% one-core CPU average over five idle minutes after warm-up; running-service launcher handoff ≤500 ms p95/20; stopped-service HTTP readiness ≤2 s p95/20 on the reference Linux host.

**Gate:** measurements and commands are recorded with host/runtime identity. Any exception requires design review; do not silently relax the thresholds.

### V1-25 — Create the v1 release-candidate evidence set

**Files:** `docs/README.md`, `README.md`, `docs/evidence/v1/README.md`, representative browser screenshot/evidence files under `docs/evidence/v1/`.

Update `docs/README.md` status from unimplemented only after V1-23/V1-24 pass. Archive representative browser screenshots for Week, Day carry-over, History, Settings, mobile-sized Day/editor, local-save failure, sync issue, Light and Dark. The running implementation becomes evidence for the existing design; do not rewrite the canonical product model to match accidental implementation differences.

Also verify:

- no temporary scaffolding, mock server, fixture data or test-only bypass is reachable in production;
- no unused dependency remains;
- no `TODO`/placeholder marks a required FR behavior;
- no second Task/command/persistence model was introduced;
- no Order private implementation was copied into Jig;
- no user-facing Git conflict/reconciliation workflow exists;
- installation/uninstall preserves user planning data by default;
- configuration migration cannot leave two active writers or switch to a partially initialized destination;
- crash recovery covers both import interruption and Git-commit-success/metadata-update-failure windows.

**Gate:** `bun run verify` plus installer/repository/resource certification are green and the documentation index accurately reflects implementation status.

## 12. Safe parallelism

Parallel work is allowed only after its authority boundary is stable:

- After V1-02, V1-03/V1-04 may proceed in parallel with V1-05 schema setup because all consume the same frozen Task contract.
- After V1-07, V1-12 UI foundation may proceed while V1-08–V1-11 repository work continues; UI uses the canonical HTTP contract and must not mock a different data model.
- After V1-13, Week/Day/History can be implemented by separate workers if they all reuse `task-row.tsx`, `ui/src/http.ts`, and the same canonical Task values.
- V1-18 drag integration is one ownership lane. Do not let Week and Day workers invent separate movement adapters.
- V1-21/V1-22 installer/service work may overlap late UI work after the local service and repository contracts are stable.

No two workers may independently define Task shape, command shape, repository status vocabulary, theme semantics, sync semantics or ordering rules.

## 13. Required implementation-team discipline

Before each task, read the cited canonical section and the Technical solution §2.1 source-map entry relevant to that task. Do not use an upstream implementation example as authority over Jig.

For every task:

1. implement the smallest complete change that satisfies the named contract;
2. add or update the lowest-level test that proves it;
3. run the affected test subset and typecheck;
4. do not weaken a test or requirement to accommodate an implementation shortcut;
5. do not add a new dependency or abstraction unless the existing design cannot implement the requirement and evidence is recorded;
6. keep Git/repository mechanics behind the adapter and presentation state out of the canonical Task;
7. remove superseded experimental code in the same change rather than leaving alternate paths.

## 14. Definition of MVP implementation complete

Jig v1 is complete only when all of the following are true:

- FR-01 through FR-22 are implemented and traced to passing evidence.
- Week, Day, History and Settings match the approved structural/semantic UI references.
- carry-over, deletion and System/Light/Dark behave exactly as specified.
- one-script install, `jig` launcher and Linux user service work on the reference environment.
- SQLite local persistence, deterministic Git records and repository synchronization work with unrelated repository content untouched.
- repository failure never invalidates a successful local save and no Git-reconciliation workflow leaks into Jig.
- all required browser interaction, persistence, sync, security and resource gates pass.
- the dependency set remains the exact minimal selected stack unless a separately reviewed compatibility correction was required.
- no implementation worker had to make a new product/architecture decision to complete the build.

At that point the code is a v1 MVP release candidate. Anything beyond these gates is post-v1 scope unless it fixes a defect against the frozen design.

## 15. Functional requirement-to-task coverage

This matrix is normative for plan completeness. V1-23 provides integrated evidence for every row; the listed tasks are the primary implementation owners.

| Requirement | Primary implementation tasks | Required implementation evidence |
|---|---|---|
| FR-01 quick create | V1-03, V1-13, V1-14 | title-only create on initiating date |
| FR-02 date navigation | V1-04, V1-12, V1-14, V1-15 | day/week/today navigation with no Task mutation |
| FR-03 within-day order | V1-03, V1-06, V1-18 | exact persisted reorder |
| FR-04 cross-day move | V1-03, V1-06, V1-18 | exact destination/date/index including empty date |
| FR-05 priority insertion | V1-03, V1-13, V1-14 | mixed-list insertion law |
| FR-06 preserve manual intent | V1-03, V1-13 | priority edit leaves position unchanged |
| FR-07 flexible modifications | V1-03, V1-13 | all optional fields/date editable without workflow gate |
| FR-08 complete/reopen | V1-03, V1-06, V1-15, V1-16 | same Task identity, completion time, reopen semantics |
| FR-09 carry-over | V1-04, V1-15, V1-18 | derived earlier unfinished presentation without date mutation |
| FR-10 reminders | V1-19 | in-app session-bounded reminder with durable local suppression |
| FR-11 external context | V1-13, V1-24 | safe HTTP(S) open / non-HTTP copy only |
| FR-12 honest outcomes | V1-07, V1-12, V1-19 | failed save/sync never shown as success |
| FR-13 responsive continuity | V1-20 | selected date/Task/draft survives reflow |
| FR-14 local retention | V1-05, V1-06, V1-10, V1-23 | restart and complete-snapshot rehydration |
| FR-15 installer | V1-21, V1-24 | one-script existing-repo/clone modes and safe failure |
| FR-16 repository-contained data | V1-09, V1-21, V1-22 | `.jig/local` + isolated `jig-data`; deliberate migration |
| FR-17 desktop availability | V1-22, V1-24 | launcher + user service + fallback |
| FR-18 automatic repository sync | V1-08, V1-09, V1-10, V1-11 | immediate local save plus background export/sync |
| FR-19 safe coexistence/sync honesty | V1-09, V1-11, V1-17 | unrelated repo state untouched; generic sync status only |
| FR-20 low-friction idle | V1-11, V1-22, V1-24 | bounded worker and measured resource/readiness limits |
| FR-21 delete | V1-03, V1-06, V1-08, V1-13, V1-16 | confirmation, row/file absence, position compaction, round trip |
| FR-22 appearance | V1-12, V1-17, V1-20, V1-23 | System/Light/Dark semantic parity |

## 16. Technical-design coverage audit

| Technical concern | Plan owner(s) | Coverage gate |
|---|---|---|
| exact dependency/source provenance | V1-01 | frozen install/build/typecheck |
| canonical Task + invariants | V1-02 | canonical validation tests |
| pure operations/derived views | V1-03,V1-04 | core test suite |
| SQLite schema/revision/transactions | V1-05,V1-06 | persistence + rollback/restart tests |
| loopback API/security token/revision + Settings operations | V1-07,V1-12,V1-17,V1-22 | HTTP, operational-action reuse + stale-revision browser tests |
| deterministic complete snapshot | V1-08 | byte-stable round trip |
| isolated repository branch/worktree | V1-09 | dirty-repo coexistence + ref ownership tests |
| snapshot admission/crash safety | V1-10,V1-11 | transactional adoption + crash recovery |
| bounded background sync/status | V1-11,V1-17 | fake-clock/transport/status tests |
| Astryx/theme/UI composition | V1-12–V1-17,V1-20 | structural/browser/theme evidence |
| one-owner drag and accessibility | V1-18,V1-20 | pointer/touch/keyboard/reduced-motion Playwright |
| browser reminders | V1-19 | timing/suppression/session tests |
| installer/config/dataset identity | V1-21 | disposable installation fixtures |
| launcher/service/single writer/migration/uninstall | V1-22 | lifecycle and failure-injection fixtures |
| security/trust boundaries | V1-07,V1-09,V1-13,V1-21,V1-22,V1-24 | explicit security certification |
| FR-01–22 integrated behavior | V1-23 | full acceptance matrix |
| resource limits | V1-24 | measured reference-host evidence |
| implementation/evidence closeout | V1-25 | verify + screenshots + documentation status |

Every normative implementation concern in the technical solution is owned by at least one task and ends in an executable or recorded gate. Deferred/non-goal capabilities remain intentionally unowned by implementation tasks.

## 17. Plan audit verdict

This v1.2 plan deliberately keeps **25 tasks across six waves**. The completeness audit did not require another subsystem or architectural layer; it required making previously implicit technical obligations explicit inside their existing owners. A task may be split into smaller commits for review, but splitting must not create a new semantic owner or alter the dependency order above.