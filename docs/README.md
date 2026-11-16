# Jig documentation

**Status:** v1 MVP release candidate (2026-11-16). The product, functional, technical and UI design baseline is implemented and the V1-01–V1-25 certification evidence is complete.

Jig is a small, local-first, just-in-time daily planner. It schedules attention rather than duplicating the underlying project work. All planning data must live under the Jig directory of the user-selected personal Git repository, with a lightweight local desktop service and automatic Git sync.

## Canonical reading order

1. [Product definition](product/product-definition.md) — intent, product boundary and MVP outcomes.
2. [Planning and UX functional requirements](requirements/planning-workbench.md) — observable JIG-FR-01–22 behaviour, including carry-over, confirmed deletion, System/Light/Dark appearance, onboarding/installation, repository ownership, the `jig` command, background availability and automatic synchronization.
3. [Technical solution](architecture/technical-solution.md) — selected dependencies and exact application architecture, installer/user service, canonical Task, SQLite in the selected repository, isolated repository integration boundary, background sync, canonical snapshot admission and verification.
4. [UI solution and versioned reference mockups](design/ui-solution.md) — screen hierarchy, desktop/mobile responsive composition, Astryx/dnd-kit ownership, design corrections and browser acceptance.
5. [v1 MVP implementation plan](implementation/v1-mvp-implementation-plan.md) — dependency-ordered execution tasks, exact implementation surfaces, safe parallelism, verification gates and the definition of implementation complete.
6. [v1 release-candidate evidence](evidence/v1/README.md) — permanent verification, security/installer/resource certification and representative runtime screenshots.

Functional requirements define *what* users can observe. Technical solution owns *how* data and runtime behave. UI solution owns *how* users see and manipulate those functions. No part of the design inherits Order's workflow/lifecycle domain, creates DTO hierarchies, or introduces duplicate task authority.

## Screen references

The seven versioned SVGs under `design/reference/` define the current structural UI baseline: Week, Day, History, Settings/Sync, mobile Day, mobile editor, and save/sync failure states. They are rendered in light mode to communicate structure, density, hierarchy and representative visual character; mandatory System/Light/Dark behavior is governed by the UI and technical designs rather than duplicate dark-mode mockups. Original raster source filenames and hashes for the four earlier Day-labelled source designs remain documented in [UI solution §1](design/ui-solution.md).

## Verification and implementation boundary

The design is closed and the [v1 MVP implementation plan](implementation/v1-mvp-implementation-plan.md) has been executed through V1-25. The [v1 release-candidate evidence set](evidence/v1/README.md) records the passing runtime, browser, persistence, repository, installer, security and resource/readiness gates.

Certified behavior includes:

- One-script, non-root Linux installation into a user-selected existing Git repository and a functioning `jig` launcher/user service.
- SQLite database and versioned Task records contained in the selected personal repo, never the public Jig source repo.
- No automatic changes to unrelated documents, branches or staging in the selected repository.
- Immediate local SQLite saves plus automatic background export/commit/fetch/push/retry, including recovery from repository transport failure.
- Explicit local-only, pending, synchronized and generic sync-issue status; repository failures never invalidate a successful local Task save and Jig does not model Git divergence or reconciliation.
- All 22 functional requirements, pinned Astryx/dnd-kit interaction behavior, responsive UI behavior, System/Light/Dark semantic parity and measured lightweight idle operation.

Independent phone installation remains deferred. Git history, branch, merge and conflict reconciliation are outside Jig's product/domain scope and remain owned by the user's Git tooling; do not turn them into Jig workflow or UI state.