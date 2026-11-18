# Jig v1.1.0 implementation evidence

**Status:** non-device implementation/certification ledger in progress. This file does not constitute physical-device evidence and must not be used to close J110-IMP-09 or the physical-device portions of J110-IMP-15.

**Governing authority:** `docs/implementation/v1.1-complete-implementation-plan.md`.

## Non-device evidence ledger

The implementation branch is `v1.1`. Record exact immutable commit/run identifiers here only after the corresponding permanent hosted gate succeeds.

| Gate | Evidence state |
| --- | --- |
| Linux/browser permanent Verify | PENDING final candidate run |
| Android deterministic build certification | PENDING final candidate run |
| Android API-24 instrumentation | PENDING final candidate run |
| Android bundled SQLite transaction/restart proof | Implemented in API-24 instrumentation; hosted result pending |
| Android Git smart-HTTP / portable interoperability | Automated host/native transport coverage implemented; final emulator/candidate result pending |
| Android reminder scheduling/reconciliation | Unit/reconciliation coverage implemented; final emulator/candidate result pending |
| F-Droid candidate metadata lint | Permanent Android certification step implemented; hosted result pending |
| FLOSS/proprietary dependency gate | Permanent Android certification step implemented; hosted result pending |
| Linux x64 packaged configured/bootstrap smoke | Permanent Release certification implemented; release-commit execution pending |
| Linux arm64 packaged configured/bootstrap smoke | Permanent Release certification implemented; release-commit execution pending |
| Local `act` rehearsal | PENDING development-environment evidence |
| Live Linux/Desktop GitHub Device Flow/private-repo acquisition | PENDING external live verification |

## Physical-device evidence

**NOT RUN in this ledger.** J110-IMP-09 and the physical portions of J110-IMP-15 require a recorded physical Android device, exact candidate APK/source SHA, device/API/WebView versions and the complete governed interaction/synchronization/reminder matrix.

Do not replace those results with browser, emulator, hosted-CI or generated-APK evidence.
