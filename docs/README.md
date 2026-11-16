# Jig documentation

**Status:** Proposed product, functional, technical and UI solution design baseline (2026-11-16). Runtime, installer, service and browser implementation remain unbuilt and unverified.

Jig is a small, local-first, just-in-time daily planner. It schedules attention rather than duplicating the underlying project work. All planning data must live under the Jig directory of the user-selected personal Git repository, with a lightweight local desktop service and automatic Git sync.

## Canonical reading order

1. [Product definition](product/product-definition.md) — intent, product boundary and MVP outcomes.
2. [Planning and UX functional requirements](requirements/planning-workbench.md) — observable JIG-FR-01–22 behaviour, including carry-over, confirmed deletion, System/Light/Dark appearance, onboarding/installation, repository ownership, the `jig` command, background availability and automatic synchronization.
3. [Technical solution](architecture/technical-solution.md) — selected dependencies and exact application architecture, installer/user service, canonical Task, SQLite in the selected repository, isolated Jig Git branch/worktree, background sync, failure/recovery and verification.
4. [UI solution and versioned reference mockups](design/ui-solution.md) — screen hierarchy, desktop/mobile responsive composition, Astryx/dnd-kit ownership, design corrections and browser acceptance.

Functional requirements define *what* users can observe. Technical solution owns *how* data and runtime behave. UI solution owns *how* users see and manipulate those functions. No part of the design inherits Order's workflow/lifecycle domain, creates DTO hierarchies, or introduces duplicate task authority.

## Screen references

The seven versioned SVGs under `design/reference/` define the current structural UI baseline: Week, Day, History, Settings/Sync, mobile Day, mobile editor, and save/sync failure states. They are rendered in light mode to communicate structure, density, hierarchy and representative visual character; mandatory System/Light/Dark behavior is governed by the UI and technical designs rather than duplicate dark-mode mockups. Original raster source filenames and hashes for the four earlier Day-labelled source designs remain documented in [UI solution §1](design/ui-solution.md).

## Verification and implementation boundary

The design is sufficiently specified to derive an implementation plan, but it is **not certified**. The implementation must prove:

- One-script, non-root Linux installation into a user-selected existing Git repository and a functioning `jig` launcher/user service.
- SQLite database and versioned Task records contained in the selected personal repo, never the public Jig source repo.
- No automatic changes to unrelated documents, branches or staging in the selected repository.
- Immediate local SQLite saves plus automatic background export/commit/fetch/push/retry, including when the browser is closed.
- Explicit local-only, pending, synchronized and blocked status; no silent data loss or divergent-history overwrite.
- All 22 functional requirements, pinned Astryx/dnd-kit cross-date gestures, responsive UI behavior, Light/Dark theme parity and measured lightweight idle operation.

Independent phone installation and safe simultaneous offline merge remain deferred. Do not claim they work solely because the mobile layout and data format are designed.
