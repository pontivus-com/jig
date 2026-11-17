# Jig documentation

**Status:** Jig v1.0.5 is published and immutable. v1.0.6 is a presentation-only correction in progress (2026-11-18) to constrain desktop History and Settings content width while preserving the full-width Planner and full-bleed application frame.

Jig is a small, local-first, just-in-time daily planner. It schedules attention rather than duplicating the underlying project work. All planning data must live under the Jig directory of the user-selected personal Git repository, with a lightweight local desktop service and automatic Git sync.

## Canonical reading order

1. [Product definition](product/product-definition.md) — intent, product boundary and MVP outcomes.
2. [Product identity](product/product-identity.md) — public naming and message hierarchy.
3. [Brand and theme system](design/brand-and-theme.md) — Option A mark, palette, Light/Dark semantic mapping, asset geometry and application integration.
4. [Planning and UX functional requirements](requirements/planning-workbench.md) — observable Jig behaviour, including the v1.0.5 JIG-105 corrective requirements for crash-free desktop/mobile drag, compact header geometry, semantic icon/menu normalization, Task-card legibility and responsive parity.
5. [Technical solution](architecture/technical-solution.md) — selected dependencies and exact application architecture, including v1.0.5 React-owned dnd-kit behavior, touch drag, compact header budgets, shared responsive visual ownership and strengthened verification gates.
6. [UI solution and versioned reference mockups](design/ui-solution.md) — screen hierarchy and responsive composition, now including v1.0.5 narrow/mobile parity, compact header, Task-surface contrast and icon normalization.
7. [v1.0.6 secondary-screen width implementation plan](implementation/v1.0.6-secondary-screen-width-plan.md) — current one-to-one execution authority mapping JIG-106-FR-01 → JIG-106-SD-01 → J106-IMP-01. The [v1.0.5 release-blocker correction implementation plan](implementation/v1.0.5-release-blocker-correction-plan.md) is implemented and historical. The [v1.0.4 interaction correction implementation plan](implementation/v1.0.4-ui-interaction-corrections.md) is historical for the published v1.0.4 candidate. The [v1.0.3 single Planner plan](implementation/v1.0.3-single-planner-implementation-plan.md), earlier [v1.0.3 master-detail workspace correction](implementation/v1.0.3-master-detail-workspace.md), [v1.0.2 UX/UI remediation plan](implementation/ui-ux-conformance-remediation-v1.0.md), [v1.0.1 ownership-boundary correction](implementation/v1.0.1-ownership-boundary-correction-plan.md), and [v1 MVP plan](implementation/v1-mvp-implementation-plan.md) are historical.
8. [Installation](install.md) — supported existing-repository installation, upgrade, Git-native continuity and uninstall.
9. [Releases](releases/README.md) — **canonical release authority**: mandatory `release/vX.Y.Z` metadata transition, explicit `package.json.version = X.Y.Z`, immutable tag/publication validity criteria, binary asset contract and publication channel.
10. [v1.0.5 implementation evidence](evidence/v1.0.5/README.md) — current corrective implementation certification: exact product candidate, permanent Verify result, architecture/browser gates and reviewed desktop/narrow Light/Dark visual evidence. The [v1.0.4 evidence](evidence/v1.0.4/README.md) remains the qualified historical record; the [v1 release-candidate evidence](evidence/v1/README.md) remains the historical v1 baseline.

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

The v1.0.0–v1.0.5 implementation plans/evidence are historical for their published releases. v1.0.6 has one current presentation-only correction governed by the [v1.0.6 implementation plan](implementation/v1.0.6-secondary-screen-width-plan.md). The v1.0.5 functional/technical/UI/theme contract remains certified by the [v1.0.5 evidence](evidence/v1.0.5/README.md). The [v1.0.4 evidence](evidence/v1.0.4/README.md) is explicitly qualified by its post-release correction notice. External-system ownership remains governed by the existing product/technical boundaries and the historical v1.0.1 correction.

Certified behavior includes:

- One-script, non-root Linux installation into a user-selected existing Git repository and a functioning `jig` launcher/user service.
- SQLite database and versioned Task records contained in the selected personal repo, never the public Jig source repo.
- No automatic changes to unrelated documents, branches or staging in the selected repository.
- Immediate local SQLite saves plus automatic background export/commit/fetch/push/retry, including recovery from repository transport failure.
- Explicit local-only, pending, synchronized and generic sync-issue status; repository failures never invalidate a successful local Task save and Jig does not model Git divergence or reconciliation.
- Core Task/persistence/repository/installer/runtime behavior covered by the historical verification suites. v1.0.4 UI/drag/responsive certification is qualified by the post-release defect notice and must not be cited as proof of v1.0.5 conformance.

Independent phone installation remains deferred. Git history, branch, merge and conflict reconciliation are outside Jig's product/domain scope and remain owned by the user's Git tooling; do not turn them into Jig workflow or UI state.
## UX/UI remediation

- [v1.0.6 secondary-screen width implementation plan](implementation/v1.0.6-secondary-screen-width-plan.md) — current; one presentation-only FR/SD/IMP correction for desktop History/Settings width.
- [v1.0.5 release-blocker correction implementation plan](implementation/v1.0.5-release-blocker-correction-plan.md) — implemented; exact FR/SD/IMP traceability for the corrective patch.
- [v1.0.5 implementation evidence](evidence/v1.0.5/README.md) — PASS; exact product candidate, permanent Verify and reviewed visual evidence.
- [v1.0.4 interaction correction implementation plan](implementation/v1.0.4-ui-interaction-corrections.md) — historical published-release implementation authority; superseded for the affected interaction/presentation behavior by the v1.0.5 corrective design.
- [v1.0.4 implementation evidence](evidence/v1.0.4/README.md) — historical green-run evidence with a post-release defect qualification.
- [v1.0.3 single Planner implementation plan](implementation/v1.0.3-single-planner-implementation-plan.md) — historical.
- [v1.0.3 master-detail workspace correction](implementation/v1.0.3-master-detail-workspace.md) — superseded/historical.
- [UX/UI conformance audit v1.0](design/ui-ux-conformance-audit-v1.0.md) — historical v1.0.2 baseline.
- [UX/UI conformance remediation plan v1.0](implementation/ui-ux-conformance-remediation-v1.0.md) — historical v1.0.2 implementation authority.
