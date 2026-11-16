# Jig — technical direction and Order UX reuse

**Status:** Candidate technical constraints and decision agenda, v0.1 (2026-11-16). **Not** an approved technical design or implementation plan.  
**Dependency:** [Product definition](../product/product-definition.md) and [planning functional design](../requirements/planning-workbench.md).  
**Scope:** Independent application, reuse of UI foundations, local data portability, and future Git synchronization.

## 1. Verified Order baseline — reference, not inherited authority

The connected `pontivus-com/order` default branch was examined during this drafting session. The following are observable in repository documentation/code:

- [`package.json`](https://github.com/pontivus-com/order/blob/master/package.json): React, TypeScript, Vite, Bun, `@astryxdesign/core`, `@astryxdesign/theme-neutral`, and StyleX appear in Order's tool/dependency set. Exact version pins belong to Order and are not automatically Jig's pins.
- [`ui/src/styles.css`](https://github.com/pontivus-com/order/blob/master/ui/src/styles.css): imports the public Astryx reset, core styles, built Neutral theme and Order's local theme stylesheet.
- [`ui/src/theme.css`](https://github.com/pontivus-com/order/blob/master/ui/src/theme.css): uses public Astryx semantic tokens and Order-specific presentation rules. Current reviewed version uses neutral surfaces with navy/blue accent roles, not the green palette of the original working-name mockups.
- [`ui/src/primitives/WorkbenchLayout.tsx`](https://github.com/pontivus-com/order/blob/master/ui/src/primitives/WorkbenchLayout.tsx): illustrates an Astryx `AppShell`/`Layout`/`Drawer` composition with responsive changes.
- [Order Workbench functional design](https://github.com/pontivus-com/order/blob/master/docs/requirements/workbench.md) and [component architecture](https://github.com/pontivus-com/order/blob/master/docs/architecture/workbench.md): prescribe consistent visual semantics, form actions, focus, responsive continuity and semantic status rendering.
- [Order theme architecture](https://github.com/pontivus-com/order/blob/master/docs/architecture/workbench-theme.md): describes foundation-first styling, semantic tokens, restrained chrome and global light/dark/system theme.

These observations do **not** establish that the entire Order UI is exportable as a reusable library. Many `Workbench*` components embody Order-specific lifecycle, context and information architecture. Their repository-local source should not be copied or made an implicit runtime dependency of Jig without a concrete reuse decision.

## 2. Recommended reuse boundary

**Reuse directly where licensed, technically compatible and publicly supported:** Astryx field/button/selection/dialog/notification components, semantic theme/tokens, compact typography/spacing, accessible focus and input patterns, and the general React/Bun/Vite/TypeScript development experience.

**Adapt the established patterns without coupling the products:** toolbar, navigation, optional task detail inspector, forms, status/notice treatment and responsive composition. Reuse common foundation behavior, not Order WorkItem lifecycle ownership or its canonical workflow rail.

**Build specifically for Jig:** weekly date columns, ordered planned-task list, draggable task affordances, cross-date drop positions, day strip, overdue work presentation and date-scoped completed area. These have their own pure planning semantics and do not warrant a new generic component framework.

**Visual design check before implementation:** the original working-name concept imagery is an interaction/layout exploration, not a token contract. First prototype against the real Astryx/Order visual baseline (including dark mode as an inherited foundation capability where practical). Only authorize a Jig-specific brand treatment after comparison. Do not introduce a second broad CSS/component system to copy a screenshot.

**Independence:** Jig must remain a standalone repository/application; its normal operation must not import Order project modules, run Order services, or depend on SPAN availability. A future explicit deep link or create-Order-WorkItem action is integration, not a reason to embed those product semantics.

## 3. Data portability and Git constraints

All authoritative user data for one installation must be recoverable from a known, selectable application data location. The storage method is **not decided** solely by the choice to use Git. The operational design must support local date queries, ordered updates, completion/history, and reliable saves while offline.

Two candidate shapes require evaluation:

1. **Text records in Git + optional derived SQLite index:** Git-held canonical records make per-task history and synchronization natural. The index is rebuildable and has no independent authority.
2. **SQLite operational authority + canonical Git transfer representation:** SQLite handles local transactions/queries; a carefully defined export/import/sync protocol transfers logical state through mergeable text records. Specify exactly which representation is authoritative at each commit/sync boundary; do not create two independently editable truths.

Do not rely on ordinary Git merge of a live `.sqlite` binary. Git is a version/transfer mechanism, not a conflict-free distributed database. The design must specify stable task identities, deterministic ordering, atomic local mutation, device conflict and deletion handling, and recovery from partially failed syncs before claiming independent multi-device sync works.

Desktop MVP targets usable local data plus a Git-compatible backup/sync path. The public Jig application-source repository must remain separate from repositories containing private personal planning records; publishing personal task data to the source repository is not part of the product. Fully independent phone installation, on-device Git transport and robust offline concurrent editing are **future delivery capabilities**, but must be considered when choosing the canonical transfer representation. No Jig-hosted cloud account or remote sync service is assumed. A user-controlled Git remote or direct peer transfer can satisfy future transfers; a running reachable transport is still required when devices exchange changes.

## 4. Runtime and notifications

A desktop-first local web application is the initial deployment direction: browser interface plus minimal local service/runtime if necessary for local storage and Git operations. Ordinary planning works offline. Do not introduce a provider, queue, hosted push sender or scheduled server jobs to deliver reminders.

While the app is open, compare due reminders with the current date/time and show a dismissible in-app toast. Optional browser OS notifications require runtime support and explicit permission. Closed-browser, sleeping-device and background phone delivery are not v1 guarantees.

The final platform decision must distinguish (a) desktop localhost access, (b) future genuinely independent mobile installation and (c) future Git file/process capabilities on that mobile platform. A responsive PWA by itself does not prove that native filesystem/Git operations are available.

## 5. Architectural guardrails

- One canonical domain owner for each planning fact; avoid alternate task representations between week, day, history and synchronization.
- Functional core for date/priority/order/completion rules; effects isolated to persistence, Git, clock and browser notifications.
- Strict typed domain boundaries, explicit state transitions and no unnecessary DTO/mapper or object/service hierarchy.
- Persist the operator's chosen task order explicitly; never derive it from priority, reminder time or creation order after manual changes.
- Mutations are atomic from the user's perspective; a failed persistence/sync operation is not displayed as a saved/committed success.
- No Order workflow governance, AI orchestration, agent execution or general project dependency engine inside Jig.

## 6. Technical decisions to close before implementation planning

| Decision | Evidence/validation required |
|---|---|
| Data authority and query path | Compare operational query/reorder transaction complexity of canonical text vs SQLite with text sync projection. Select one authority model. |
| Git synchronization and conflict resolution | Reproduce edits/reorder/reschedule on two replicas, pull/merge and recover without lost/duplicated tasks or unstable order. Distinguish desktop MVP from independent mobile acceptance. |
| UI component reuse | Prototype week/day/editor with installed Astryx primitives; identify any missing Kanban-specific mechanics instead of assuming Order components are exportable. |
| Desktop runtime/package | Prove startup, local filesystem access, offline persistence, Git command integration and recovery/backup against the target host. |
| Mobile future path | Establish feasible local storage and Git transport on target platforms before claiming installed phone sync. No requirement to ship mobile runtime in desktop v1. |
| Visual/UX validation | Compare responsive layout, keyboard/touch actions, compact scanning, minimal task inputs, semantic status, dark mode and distraction level against approved screenshots/prototypes. |

This is a bounded decision agenda, not permission to add unrelated features. The next implementation plan must use outcomes of these decisions and the functional acceptance scenarios, rather than resolve architecture on the fly.