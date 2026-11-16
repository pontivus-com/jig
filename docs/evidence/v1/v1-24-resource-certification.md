# V1-24 resource certification evidence

**Status:** PASS for the resource and running-launcher thresholds in Technical solution §7.6.  
**Measured revision:** `68ceeb45677bbbebc35600e6fe2416dfda010254`  
**GitHub Actions run:** `43849439936`  
**Job:** `133237881766`  
**Measured:** 2026-11-16

This evidence records the exact V1-24 resource gate executed on a GitHub-hosted Ubuntu 26.04 runner. The temporary workflow used only the existing repository certification harness and was removed after the result was captured; it is not part of Jig's permanent CI or runtime architecture.

## Environment

- GitHub runner OS: Ubuntu 26.04.1
- Runner image: `ubuntu-26.04`
- Runner image version: `20261111.196.1`
- Kernel: `Linux 7.0.0-1019-azure #20-Ubuntu SMP PREEMPT Mon Oct 19 22:41:16 UTC 2026 x86_64`
- Bun: `1.4.4`
- Git: `2.56.1`
- Dependency installation: frozen `bun.lock`
- Production UI: built before measurement

## Canonical measurement

The repository's `tests/certification/resource-gate.sh` was run with its canonical defaults:

- warm-up: 60 seconds
- idle measurement window: 300 seconds
- idle samples collected: 297
- launcher samples: 20

| Gate | Required | Measured | Verdict |
|---|---:|---:|---|
| Maximum service RSS | ≤ 128 MiB / 131,072 KiB | 35,876 KiB | PASS |
| One-core CPU average over five idle minutes | ≤ 1.0% | 0.0167% | PASS |
| Running-service launcher handoff p95 / 20 | ≤ 500 ms | 30 ms | PASS |

The resource harness exited successfully, so all three thresholds above were enforced by the executable gate rather than assessed manually after the run.

## Remaining environment-bound V1-24 gate

The same run reported:

`stopped_service_readiness: requires installed-service certification command`

GitHub-hosted Actions does not provide the installed desktop/user-session environment required by `tests/certification/installed-readiness-gate.sh`. Therefore this evidence does **not** claim the stopped-service `systemd --user` HTTP-readiness threshold (≤ 2 seconds p95 / 20) has been certified.

That gate remains open and must be run in a supported installed Linux user-service environment. It must not be replaced by foreground-process timing or silently waived.

## Reproduction

Resource and running-launcher certification:

```bash
bun install --frozen-lockfile
bun run build
bash tests/certification/resource-gate.sh
```

Installed stopped-service readiness, on a host with Jig installed and an active `systemd --user` manager:

```bash
bash tests/certification/installed-readiness-gate.sh
```
