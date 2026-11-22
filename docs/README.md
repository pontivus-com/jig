# Jig documentation

**Status:** Jig v1.1.1 is published and immutable. v1.1.2 corrective work is active under issue #66 and `CHANGELOG.md` `[Unreleased]`; package metadata remains at 1.1.1 until the governed `release/v1.1.2` transition. The v1.1.2 amendment supersedes affected prior drag, synchronization diagnostics/recovery, per-theme surface, configured-height, motion and responsive-presentation clauses. Adjacent-week Carousel/swipe remains deferred.

Jig is a small, local-first, just-in-time daily planner. It schedules attention rather than duplicating the underlying project work. All planning data must live under the Jig directory of the user-selected personal Git repository, with a lightweight local desktop service and automatic Git sync.

## Canonical reading order

1. [Product definition](product/product-definition.md) — intent, product boundary and MVP outcomes.
2. [Product identity](product/product-identity.md) — public naming and message hierarchy.
3. [Brand and theme system](design/brand-and-theme.md) — Option A mark, default Jig palette, the governed 13-theme application catalogue, independent Light/Dark/System semantics, theme-aware in-application wordmark paint, asset geometry and application integration.
4. [Planning and UX functional requirements](requirements/planning-workbench.md) — cross-release requirements index and traceability. The [v1.1.2 corrective functional design](requirements/v1.1.2-corrective-functional-design.md) is binding for JIG-112-FR-01..12 and supersedes the affected drag/sync/theme/layout/motion/responsive-presentation clauses; unaffected v1.1 requirements remain governed by the [v1.1 functional design](requirements/v1.1-mobile-functional-design.md).
5. [Technical solution](architecture/technical-solution.md) — cross-release architecture index and stable boundaries. The [v1.1.2 corrective technical design](architecture/v1.1.2-corrective-technical-design.md) is binding for JIG-112-SD-01..13; unaffected v1.1 mechanics remain governed by the [v1.1 technical solution](architecture/v1.1-mobile-technical-solution.md).
6. [UI solution and governed versioned references](design/ui-solution.md) — canonical screen hierarchy, responsive composition and visual interaction presentation. The [v1.1.2 responsive interaction matrix](design/v1.1.2-responsive-interaction-matrix.md) explicitly classifies desktop-specific, narrow/mobile-specific and shared-adaptive UI ownership; the [responsive presentation architecture](architecture/v1.1.2-responsive-presentation-architecture.md) defines the implementation separation pattern. Both are v1.1.2 authority. v1.1 uses explicit Previous/Next/Today week controls; direct horizontal paging is future work.
7. [v1.1 complete implementation plan](implementation/v1.1-complete-implementation-plan.md) — binding execution authority only. The deferred Carousel work is not a v1.1 implementation or closure gate. Superseded implementation designs are not fallback tasks. Earlier release plans are historical provenance only.
8. [Installation](install.md) — supported existing-repository installation, upgrade, Git-native continuity and uninstall.
9. [Releases](releases/README.md) — **canonical release authority**: mandatory `release/vX.Y.Z` metadata transition, explicit `package.json.version = X.Y.Z`, immutable tag/publication validity criteria, binary asset contract and publication channel.
10. [v1.1.0 implementation evidence](evidence/v1.1.0/README.md) — current implementation/release-candidate evidence ledger. Carousel/swipe paging is deferred beyond v1.1; evidence for that future feature is historical only. Issue #31 live Linux acceptance is closed; remaining IMP-15 physical/native rows are optional QA, not release gates.
11. [v1.0.6 implementation evidence](evidence/v1.0.6/README.md) — current released implementation certification: exact product/test candidate, permanent Verify result, 13-theme semantic matrix, combined-state, Notification, geometry and architecture gates. The [v1.0.5 evidence](evidence/v1.0.5/README.md), [v1.0.4 evidence](evidence/v1.0.4/README.md) and [v1 release-candidate evidence](evidence/v1/README.md) remain historical.

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

Current v1.1 governed references:

- [Configured application UX/UI — desktop + mobile](design/reference/jig-v1.1-application-ux-ui-governed-reference.html) — binding app-wide authority for compact bottom navigation, Planner FAB, top/temporal hierarchy, Planner density, History and Settings, plus the reviewed desktop shell composition.
- [Mobile UX/UI — onboarding + complete Task form](design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html) — binding Android/narrow authority for onboarding hierarchy/states, complete Task BottomSheet composition, >=48px interaction geometry, mobile form density, progressive Repeat disclosure and action placement.
- [Desktop onboarding + complete Task form](design/reference/jig-v1.1-desktop-onboarding-task-form-governed-reference.html) — binding desktop authority for onboarding composition and complete Drawer Task-form/Repeat interaction.

The versioned SVGs under `design/reference/` retain structural provenance. The v1.0.3 Planner SVGs are historical baselines; v1.0.4 supersedes their selected-day, navigation and heavier-chrome details through the binding functional design, UI solution and brand/theme contract. `mobile-editor.svg` is historical for v1.1 Task-form presentation and must not override the governed mobile reference. Earlier Day/Week/sidebar SVGs are historical inputs only. Mandatory System/Light/Dark behavior is governed by the UI/theme and technical designs rather than duplicate dark-mode mockups.

## Android development

- [Android v1.1 development and physical-device certification](development/android-v1.1.md) — repeatable Android build/device loop, retained qualified physical evidence, and the remaining exact-candidate certification matrix. Adjacent-week swipe acceptance is deferred beyond v1.1.

## Verification and implementation boundary

The v1.0.0–v1.0.5 implementation plans/evidence are historical for their published releases. v1.0.6 is governed by the [complete v1.0.6 implementation plan](implementation/v1.0.6-complete-presentation-plan.md), and its implemented candidate is certified by [v1.0.6 evidence](evidence/v1.0.6/README.md). The v1.0.5 functional/technical/UI/theme contract remains certified by the [v1.0.5 evidence](evidence/v1.0.5/README.md). The [v1.0.4 evidence](evidence/v1.0.4/README.md) is explicitly qualified by its post-release correction notice. External-system ownership remains governed by the existing product/technical boundaries and the historical v1.0.1 correction.

Certified behavior includes:

- One-script, non-root Linux installation into a user-selected existing Git repository and a functioning `jig` launcher/user service.
- SQLite database and versioned Task records contained in the selected personal repo, never the public Jig source repo.
- No automatic changes to unrelated documents, branches or staging in the selected repository.
- Immediate local SQLite saves plus automatic background export/commit/fetch/push/retry, including recovery from repository transport failure.
- Explicit local-only, pending, synchronized and sync-attention status; repository failures never invalidate a successful local Task save. v1.1.2 adds bounded automatic recovery for provably related Jig-owned `jig-data` divergence plus sanitized diagnostic evidence, while unrelated repository history and force-push remain outside Jig ownership.
- Core Task/persistence/repository/installer/runtime behavior covered by the historical verification suites. v1.0.4 UI/drag/responsive certification is qualified by the post-release defect notice and must not be cited as proof of v1.0.5 conformance.

v1.1 delivers independent Android installation/synchronization while preserving canonical planning data. v1.1.2 narrows one prior boundary: Jig may automatically reconcile only its isolated `jig-data` portable history when common ancestry and a fully valid result are provable. General repository branch/history reconciliation remains outside Jig's product/domain scope. iOS remains outside v1.1; F-Droid publication remains deferred.
## UX/UI remediation

- [v1.0.6 complete presentation implementation plan](implementation/v1.0.6-complete-presentation-plan.md) — implemented/certified; all JIG-106 functional requirements, technical solutions and J106-IMP-01…08 tasks. The older width-only plan is superseded.
- [v1.0.6 implementation evidence](evidence/v1.0.6/README.md) — PASS; exact product/test candidate `2f3de2f6ad43d2f2b84a9bb41db08d71f0e34cd9`, permanent Verify run `44210396948`, 107 core/integration tests and 53 real-browser tests.
- [v1.0.5 release-blocker correction implementation plan](implementation/v1.0.5-release-blocker-correction-plan.md) — implemented; exact FR/SD/IMP traceability for the corrective patch.
- [v1.0.5 implementation evidence](evidence/v1.0.5/README.md) — PASS; exact product candidate, permanent Verify and reviewed visual evidence.
- [v1.0.4 interaction correction implementation plan](implementation/v1.0.4-ui-interaction-corrections.md) — historical published-release implementation authority; superseded for the affected interaction/presentation behavior by the v1.0.5 corrective design.
- [v1.0.4 implementation evidence](evidence/v1.0.4/README.md) — historical green-run evidence with a post-release defect qualification.
- [v1.0.3 single Planner implementation plan](implementation/v1.0.3-single-planner-implementation-plan.md) — historical.
- [v1.0.3 master-detail workspace correction](implementation/v1.0.3-master-detail-workspace.md) — superseded/historical.
- [UX/UI conformance audit v1.0](design/ui-ux-conformance-audit-v1.0.md) — historical v1.0.2 baseline.
- [UX/UI conformance remediation plan v1.0](implementation/ui-ux-conformance-remediation-v1.0.md) — historical v1.0.2 implementation authority.
