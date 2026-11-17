# Jig documentation

**Status:** v1.0.4 implementation candidate (2026-11-17). The binding Planner interaction-correction functional, technical, UI/theme and architecture contract is implemented and certified on the implementation branch; release publication remains a separate governed transition.

Jig is a small, local-first, just-in-time daily planner. It schedules attention rather than duplicating the underlying project work. All planning data must live under the Jig directory of the user-selected personal Git repository, with a lightweight local desktop service and automatic Git sync.

## Canonical reading order

1. [Product definition](product/product-definition.md) — intent, product boundary and MVP outcomes.
2. [Product identity](product/product-identity.md) — public naming and message hierarchy.
3. [Brand and theme system](design/brand-and-theme.md) — Option A mark, palette, Light/Dark semantic mapping, asset geometry and application integration.
4. [Planning and UX functional requirements](requirements/planning-workbench.md) — observable JIG-FR-01–22 behaviour, including carry-over, confirmed deletion, System/Light/Dark appearance, onboarding/installation, repository ownership, the `jig` command, background availability and automatic synchronization.
5. [Technical solution](architecture/technical-solution.md) — selected dependencies and exact application architecture, installer/user service, canonical Task, SQLite in the selected repository, isolated repository integration boundary, background sync, canonical snapshot admission and verification.
6. [UI solution and versioned reference mockups](design/ui-solution.md) — screen hierarchy, desktop/mobile responsive composition, Astryx/dnd-kit ownership, design corrections and browser acceptance.
7. [v1.0.4 interaction correction implementation plan](implementation/v1.0.4-ui-interaction-corrections.md) — current execution authority for displayed-week-only Planner state, card-body drag, unified editable workspace, full weekday/date-header Add, complete state-color semantics, reduced chrome and architecture-compliance remediation. The [v1.0.3 single Planner plan](implementation/v1.0.3-single-planner-implementation-plan.md), earlier [v1.0.3 master-detail workspace correction](implementation/v1.0.3-master-detail-workspace.md), [v1.0.2 UX/UI remediation plan](implementation/ui-ux-conformance-remediation-v1.0.md), [v1.0.1 ownership-boundary correction](implementation/v1.0.1-ownership-boundary-correction-plan.md), and [v1 MVP plan](implementation/v1-mvp-implementation-plan.md) are historical.
8. [Installation](install.md) — supported existing-repository installation, upgrade, Git-native continuity and uninstall.
9. [Releases](releases/README.md) — **canonical release authority**: mandatory `release/vX.Y.Z` metadata transition, explicit `package.json.version = X.Y.Z`, immutable tag/publication validity criteria, binary asset contract and publication channel.
10. [v1.0.4 implementation evidence](evidence/v1.0.4/README.md) — permanent Verify result, architecture/browser certification and reviewed Light/Dark desktop/narrow visual evidence. The [v1 release-candidate evidence](evidence/v1/README.md) remains the historical v1 baseline.

Functional requirements define *what* users can observe. Technical solution owns *how* data and runtime behave. UI solution owns *how* users see and manipulate those functions. No part of the design inherits Order's workflow/lifecycle domain, creates DTO hierarchies, or introduces duplicate task authority.

## Public release surface

- [Install Jig](install.md)
- [Release process, validity contract and asset matrix](releases/README.md) — canonical authority; an implementation merge is not a release, and every release requires an explicit package-version transition on `release/vX.Y.Z`.
- [v1.0.0 release notes draft](releases/v1.0.0.md)
- [v1.0.0 release-preparation task set](releases/v1.0.0-preparation.md)
- [Changelog](../CHANGELOG.md)
- [Support](../SUPPORT.md)
- [Security](../SECURITY.md)

## Screen references

The versioned SVGs under `design/reference/` retain structural provenance. The v1.0.3 Planner SVGs are historical baselines; v1.0.4 supersedes their selected-day, navigation and heavier-chrome details through the binding functional design, UI solution and brand/theme contract. Earlier Day/Week/sidebar SVGs are historical inputs only. Mandatory System/Light/Dark behavior is governed by the UI/theme and technical designs rather than duplicate dark-mode mockups.

## Verification and implementation boundary

The v1.0.0–v1.0.3 implementation plans/evidence remain historical for their published releases. The current UI implementation authority is the [v1.0.4 interaction correction plan](implementation/v1.0.4-ui-interaction-corrections.md), with certification recorded in [v1.0.4 implementation evidence](evidence/v1.0.4/README.md). External-system ownership remains governed by the existing product/technical boundaries and the historical v1.0.1 correction.

Certified behavior includes:

- One-script, non-root Linux installation into a user-selected existing Git repository and a functioning `jig` launcher/user service.
- SQLite database and versioned Task records contained in the selected personal repo, never the public Jig source repo.
- No automatic changes to unrelated documents, branches or staging in the selected repository.
- Immediate local SQLite saves plus automatic background export/commit/fetch/push/retry, including recovery from repository transport failure.
- Explicit local-only, pending, synchronized and generic sync-issue status; repository failures never invalidate a successful local Task save and Jig does not model Git divergence or reconciliation.
- All 22 functional requirements, pinned Astryx/dnd-kit interaction behavior, responsive UI behavior, System/Light/Dark semantic parity and measured lightweight idle operation.

Independent phone installation remains deferred. Git history, branch, merge and conflict reconciliation are outside Jig's product/domain scope and remain owned by the user's Git tooling; do not turn them into Jig workflow or UI state.
## UX/UI remediation

- [v1.0.4 interaction correction implementation plan](implementation/v1.0.4-ui-interaction-corrections.md) — current.
- [v1.0.4 implementation evidence](evidence/v1.0.4/README.md) — certified candidate evidence.
- [v1.0.3 single Planner implementation plan](implementation/v1.0.3-single-planner-implementation-plan.md) — historical.
- [v1.0.3 master-detail workspace correction](implementation/v1.0.3-master-detail-workspace.md) — superseded/historical.
- [UX/UI conformance audit v1.0](design/ui-ux-conformance-audit-v1.0.md) — historical v1.0.2 baseline.
- [UX/UI conformance remediation plan v1.0](implementation/ui-ux-conformance-remediation-v1.0.md) — historical v1.0.2 implementation authority.
