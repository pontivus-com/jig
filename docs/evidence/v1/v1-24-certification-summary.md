# V1-24 security, resource and installer certification summary

**Status:** PASS  
**Certification head:** `4823617a1da685d83ba953c3ba76784f5e95edd7`  
**Permanent verification run:** `43850845393`  
**Permanent verification job:** `133242656089`  
**Certified:** 2026-11-16

V1-24 requires security, resource use and installer/lifecycle certification without introducing new production architecture. This summary records the executable evidence used to close that gate.

## Permanent verification result

The repository's permanent `Verify v1 implementation` workflow passed on the certification head.

| Verification surface | Result |
|---|---|
| Frozen dependency installation | PASS |
| TypeScript strict typecheck | PASS |
| Core/integration test files | 14 / 14 PASS |
| Core/integration tests | 70 / 70 PASS |
| Production Vite build | PASS |
| Real Chromium browser acceptance | 17 / 17 PASS |
| Shell syntax certification | PASS |
| Installer/lifecycle smoke | PASS |

The passing core/integration set includes:

- `tests/certification/security.test.ts`: 7 / 7 PASS
- `tests/install/lifecycle.test.ts`: 4 / 4 PASS
- `tests/install/setup.test.ts`: 3 / 3 PASS
- `tests/install/repository-boundary.test.ts`: 4 / 4 PASS

These gates cover loopback-only serving, absence of permissive CORS, process-local write-token ownership, Git argument-array invocation, portable-path containment, non-execution of Task references, ordinary-log privacy, single-writer enforcement, repository migration rollback, installation identity/coexistence, linked-worktree handling, source-checkout refusal, idempotent installation, clone mode and uninstall preservation behavior.

## Resource and readiness certification

The exact Technical solution §7.6 measurements are recorded in [v1-24-resource-certification.md](v1-24-resource-certification.md).

All four thresholds passed:

| Gate | Required | Measured | Verdict |
|---|---:|---:|---|
| Maximum service RSS | ≤ 128 MiB | 35,876 KiB | PASS |
| One-core CPU average over five idle minutes | ≤ 1.0% | 0.0167% | PASS |
| Running-service launcher handoff p95 / 20 | ≤ 500 ms | 30 ms | PASS |
| Stopped-service HTTP readiness p95 / 20 | ≤ 2,000 ms | 53 ms | PASS |

The resource measurement used a 60-second warm-up followed by the complete 300-second idle window. The stopped-service measurement used the real installer and real `systemd --user` service path.

## Certification verdict

V1-24 is closed on the recorded implementation revision and evidence set:

- security/trust-boundary gates: PASS;
- installer and lifecycle gates: PASS;
- resource thresholds: PASS;
- running launcher threshold: PASS;
- installed stopped-service readiness threshold: PASS.

No threshold was relaxed, no production rate limiting was disabled for certification, and the temporary GitHub Actions measurement workflows were removed after evidence capture.
