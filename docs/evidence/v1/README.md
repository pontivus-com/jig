# Jig v1 MVP release-candidate evidence

**Status:** V1-01 through V1-25 implementation and certification evidence complete on `implementation/v1-mvp` (2026-11-16).

This directory is the release-candidate evidence set required by the v1 MVP implementation plan. The canonical product, functional, technical and UI documents remain the design authority; these artifacts prove the implementation against those contracts rather than redefining them.

## Permanent verification

Clean release-candidate verification:

- Revision: `033bcce2374f759078711788c8616b0f7dc1e218`
- GitHub Actions run: `43851963236`
- Frozen dependency installation: PASS
- TypeScript strict typecheck: PASS
- Core/integration test files: 14 / 14 PASS
- Core/integration tests: 70 / 70 PASS
- Production Vite build: PASS
- Real Chromium browser acceptance: 17 / 17 PASS
- Shell syntax certification: PASS
- Installer/lifecycle smoke: PASS

The browser suite uses the real Bun loopback service, real SQLite authority and real Git fixtures; interaction-sensitive behavior is not replaced by a mock API.

## V1-24 security, installer and resource certification

See:

- [V1-24 certification summary](v1-24-certification-summary.md)
- [V1-24 resource and installed-readiness measurements](v1-24-resource-certification.md)

Recorded reference-host results:

| Gate | Required | Measured | Verdict |
|---|---:|---:|---|
| Maximum service RSS | ≤ 128 MiB | 35,876 KiB | PASS |
| One-core CPU average over five idle minutes | ≤ 1.0% | 0.0167% | PASS |
| Running-service launcher handoff p95 / 20 | ≤ 500 ms | 30 ms | PASS |
| Stopped-service HTTP readiness p95 / 20 | ≤ 2,000 ms | 53 ms | PASS |

The stopped-service measurement used the real installer and real `systemd --user` service on the recorded Ubuntu 26.04 reference environment.

## Representative browser evidence

See [V1-25 browser evidence](v1-25-browser-evidence.md).

Archived surfaces under [`browser/`](browser/) include:

- Week — Light
- Week — Dark
- Day with derived carry-over
- History
- Settings
- mobile-sized Day
- mobile-sized editor
- local-save failure
- repository synchronization issue

The local-save-failure image is controlled presentation evidence for the failure surface. Behavioral persistence, HTTP admission and rollback guarantees are independently covered by the permanent persistence/HTTP/browser suites. The synchronization-issue evidence uses a real unavailable Git remote fixture.

## Functional and technical coverage

The normative FR-01 through FR-22 mapping remains the matrix in [the implementation plan](../../implementation/v1-mvp-implementation-plan.md). V1-23 supplies integrated browser/runtime evidence while lower-level core, SQLite, repository and lifecycle suites prove their respective ownership boundaries.

The final architecture audit confirms:

- one canonical `Task` and `TaskCommand` authority in the functional core;
- functional-core / imperative-shell separation is preserved;
- no DTO layer, mapper hierarchy, service/repository class architecture or duplicate persistence/transport Task model;
- no Order `WorkItem` or private `Workbench*` implementation copied into Jig;
- no React Query, Redux, Zustand, ORM, Git library or second drag owner;
- `@dnd-kit/react` remains the single Task movement owner;
- no user-facing Git conflict/reconciliation workflow;
- no production TODO/FIXME/test-only bypass or mock server;
- pinned `@stylexjs/stylex` is retained because it is a required peer of pinned Astryx core, not an unused dependency;
- installation/uninstall preserves repository planning data by default;
- migration preserves the original active configuration on failure and single-writer enforcement prevents parallel writable authorities;
- crash recovery covers interrupted import and Git-commit-success / metadata-update-failure windows.

## Release-candidate verdict

The v1 implementation satisfies the implementation plan's completion gates and is a **v1 MVP release candidate**. Post-v1 features remain out of scope unless required to fix a defect against the frozen design.
