# V1-24 resource and readiness certification evidence

**Status:** PASS for all Technical solution §7.6 resource/readiness thresholds.  
**Resource revision:** `68ceeb45677bbbebc35600e6fe2416dfda010254`  
**Installed-readiness revision:** `8b464218b6252ecb4f8b4c195c80203334b52953`  
**Measured:** 2026-11-16

The resource and installed-service measurements were executed on GitHub-hosted Ubuntu 26.04 runners using temporary commit-scoped workflows. Both temporary workflows were removed after evidence capture and are not part of Jig's permanent CI or runtime architecture.

A repository comparison between the two measured revisions contains no production-code change: only temporary workflow/evidence files and the installed-readiness certification harness changed. The resource measurements therefore apply to the same production implementation exercised by the installed-service readiness measurement.

## Environment

Both passing runs used:

- GitHub runner OS: Ubuntu 26.04.1
- Runner image: `ubuntu-26.04`
- Runner image version: `20261111.196.1`
- Kernel: `Linux 7.0.0-1019-azure #20-Ubuntu SMP PREEMPT Mon Oct 19 22:41:16 UTC 2026 x86_64`
- Bun: `1.4.4`

Additional installed-service environment:

- systemd: `systemd 259 (259.9-0ubuntu0.1)`

## Resource and running-launcher gate

**GitHub Actions run:** `43849439936`  
**Job:** `133237881766`

The repository's `tests/certification/resource-gate.sh` ran with the canonical Technical solution §7.6 defaults:

- warm-up: 60 seconds
- idle measurement window: 300 seconds
- idle samples collected: 297
- launcher samples: 20
- dependency installation: frozen `bun.lock`
- production UI: built before measurement

| Gate | Required | Measured | Verdict |
|---|---:|---:|---|
| Maximum service RSS | ≤ 128 MiB / 131,072 KiB | 35,876 KiB | PASS |
| One-core CPU average over five idle minutes | ≤ 1.0% | 0.0167% | PASS |
| Running-service launcher handoff p95 / 20 | ≤ 500 ms | 30 ms | PASS |

The executable resource gate exited successfully; these thresholds were enforced by the harness rather than assessed manually after the run.

## Installed stopped-service readiness gate

**GitHub Actions run:** `43850673120`  
**Job:** `133242060122`

The temporary certification lane:

1. created an ephemeral personal Git repository fixture;
2. invoked the real `scripts/install.sh` installer;
3. installed the pinned Bun runtime and production Jig application;
4. created, enabled and started the real `systemd --user` `jig.service`;
5. executed `tests/certification/installed-readiness-gate.sh` for 20 stopped-service starts;
6. uninstalled Jig after the evidence was captured while preserving the fixture's planning data.

| Gate | Required | Measured | Verdict |
|---|---:|---:|---|
| Stopped-service loopback HTTP readiness p95 / 20 | ≤ 2,000 ms | 53 ms | PASS |

The first attempt at this certification exposed a harness artifact: 20 rapid consecutive starts reached systemd's normal start-rate limiter. The certification harness now calls `systemctl --user reset-failed jig.service` before each measured start so each sample measures one stopped-service startup. The production unit's rate-limiting behavior was not disabled or weakened.

The corrected executable gate exited successfully.

## V1-24 §7.6 verdict

All four Technical solution §7.6 thresholds are certified on the recorded Ubuntu 26.04 runner environment:

- RSS: PASS
- idle CPU: PASS
- running-service launcher handoff: PASS
- stopped-service HTTP readiness: PASS

No threshold was relaxed and no foreground-process substitute was used for the installed-service measurement.

## Reproduction

Resource and running-launcher certification:

```bash
bun install --frozen-lockfile
bun run build
bash tests/certification/resource-gate.sh
```

Installed stopped-service readiness, after installing Jig on a host with an active `systemd --user` manager:

```bash
bash tests/certification/installed-readiness-gate.sh
```
