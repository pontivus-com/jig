# Jig v1.1 — physical Android certification evidence

**Status:** J110-IMP-09 COMPLETE / DETAILED EXECUTION RECORD LOST / J110-IMP-15 NOT RUN — J110-IMP-09 physical Task movement was completed successfully, but its detailed execution record was not retained. Do not reconstruct unknown device, source/APK identity or per-check results from browser, emulator, hosted CI or generated-APK evidence. This document remains the active evidence record for the remaining J110-IMP-15 physical matrix.

**Executable source candidate:** `611c8ced6a854a80f24bf727c53d792f5c5d556c`  
**GitHub Actions APK artifact:** `14541004265`  
**Artifact file:** `app-debug.apk`  
**APK SHA-256:** `27449f443a5617bd1cd7bbfec2ac0971e4104d647ff77c6975df06139e15c52d`  
**Expected Android application ID:** `com.pontivus.jig`  
**Governed references:** `../../design/reference/jig-v1.1-application-ux-ui-governed-reference.html`, `../../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html`, `../../design/ui-solution.md`, `../../development/android-v1.1.md`.

Any later executable change invalidates this candidate identity and requires a newly certified source/APK lineage before this form is used.

## 1. Physical certification environment

Record the exact device and certification host for the remaining J110-IMP-15 testing. The historical J110-IMP-09 device/toolchain metadata was not retained and remains explicitly unknown.

| Fact | Recorded value |
|---|---|
| Certification date/time | |
| Tester | |
| Source SHA checked | |
| APK SHA-256 checked | |
| APK package name from `aapt dump badging` | |
| APK versionName | |
| APK versionCode | |
| Device manufacturer | |
| Device model | |
| Android version | |
| Android API level | |
| WebView/Chrome version | |
| adb serial | |
| Node version | |
| Bun version | |
| JDK version | |
| Android SDK root | |
| Platform / Build Tools | |

### Required preflight

Run:

```bash
ANDROID_SDK_ROOT="$HOME/Android/Sdk" \
  bash scripts/verify-android-device-prerequisites.sh \
  --apk /absolute/path/to/app-debug.apk
```

Paste or attach the complete output. The preflight must report exactly one authorized **physical** device, package `com.pontivus.jig`, the package-derived version identity and the APK SHA above.

**Preflight result:** NOT RUN / PASS / FAIL  
**Evidence location / attachment:**  

## 2. J110-IMP-09 — replacement Task-movement physical gate

The previous Pangea result is a recorded FAIL. The replacement dnd-kit dedicated-grip / explicit-insertion-slot implementation was subsequently exercised successfully on physical Android and J110-IMP-09 is complete. The detailed execution record was lost; the checklist below records the required gate shape but its individual historical results are not retained and must not be reconstructed.

### Repeated drag stability

The completed gate required at least **20 sequential grip drags** across realistic populated Planner dates. The individual execution evidence is not retained.

| Check | Result | Evidence / notes |
|---|---|---|
| 20 sequential grip drags completed | NOT RETAINED | |
| No stranded overlay / floating Task after any drag | NOT RETAINED | |
| Grip initiates directly; no long press required | NOT RETAINED | |
| Task-body vertical swipe scroll never starts drag | NOT RETAINED | |

### Placement matrix

| Placement | Result | Evidence / notes |
|---|---|---|
| Same date → first | NOT RETAINED | |
| Same date → middle | NOT RETAINED | |
| Same date → last | NOT RETAINED | |
| Cross date → first | NOT RETAINED | |
| Cross date → middle | NOT RETAINED | |
| Cross date → last | NOT RETAINED | |
| Move into empty date | NOT RETAINED | |
| Target every visible before/between/after insertion slot | NOT RETAINED | |
| Visible slot equals persisted date/index after reload | NOT RETAINED | |
| Long-list auto-scroll retains the intended target | NOT RETAINED | |

### Cancellation and control independence

| Check | Result | Evidence / notes |
|---|---|---|
| Outside drop restores cleanly | NOT RETAINED | |
| Pointer/system cancellation restores cleanly | NOT RETAINED | |
| Checkbox remains independent from drag | NOT RETAINED | |
| Overflow menu remains independent from drag | NOT RETAINED | |
| Reference action remains independent from drag | NOT RETAINED | |
| Task-card open/edit remains independent from drag | NOT RETAINED | |
| Drag remains correct after Planner scrolling | NOT RETAINED | |
| Drag remains correct after opening/closing Task BottomSheet | NOT RETAINED | |

**IMP-09 verdict:** **PASS — operator-confirmed physical completion; detailed execution record lost.**  
**Retained execution evidence:** none; do not reconstruct unknown device, APK/source lineage or per-check results.  

The original failure rule remains authoritative for regression handling: any new repeated missed drop, floating-card residue, unstable slot or scroll conflict observed during remaining physical work reopens SD-34/35 on `v1.1`.

## 3. J110-IMP-15 — physical mobile UX/runtime certification

J110-IMP-09 is already complete. Run the remaining J110-IMP-15 matrix on the governed current candidate lineage; do not rerun IMP-09 solely to reconstruct its lost detailed record.

### Configured shell and Planner

| Check | Result | Evidence / notes |
|---|---|---|
| Application row is legible and stable | NOT RUN | |
| Planner temporal row: Previous / week / Next / Today is legible and reachable | NOT RUN | |
| Persistent Planner / History / Settings bottom navigation is reachable and non-overlapping | NOT RUN | |
| Bottom navigation clears gesture/system safe area | NOT RUN | |
| Planner FAB is the single highest-prominence creation action | NOT RUN | |
| FAB does not obscure Tasks, date Add or navigation | NOT RUN | |
| Healthy sync remains visually subordinate | NOT RUN | |
| Warning/error sync state is understandable and actionable | NOT RUN | |
| Empty-week and populated-week density are physically scannable | NOT RUN | |
| Date Add controls are reachable without frequent mis-taps | NOT RUN | |
| Task title/meta/action hierarchy is legible | NOT RUN | |

### Onboarding

| State | Result | Evidence / notes |
|---|---|---|
| Welcome / value proposition | NOT RUN | |
| GitHub authorization / code handoff | NOT RUN | |
| Repository access / repository selection | NOT RUN | |
| Finishing | NOT RUN | |
| Attention / recovery | NOT RUN | |
| First transition into Planner | NOT RUN | |

Confirm that the presentation remains value-first and that provider/Git mechanics do not replace the product-level action hierarchy.

### Task workspace / complete form

| Check | Result | Evidence / notes |
|---|---|---|
| BottomSheet owns focus; shell/navigation does not compete visually | NOT RUN | |
| Off / non-recurring form | NOT RUN | |
| Weekly progressive disclosure | NOT RUN | |
| Monthly progressive disclosure | NOT RUN | |
| Stop repeating consequence before Save | NOT RUN | |
| Field order remains Title → Date → Repeat → Reminder → Priority → Context → Reference → Notes | NOT RUN | |
| Task / Schedule / Details / Notes grouping is legible | NOT RUN | |
| All fields remain reachable by normal scrolling | NOT RUN | |
| IME open on Title remains usable | NOT RUN | |
| IME open on Context remains usable | NOT RUN | |
| IME open on Reference remains usable | NOT RUN | |
| IME open on Notes remains usable | NOT RUN | |
| Save / Cancel remain reachable and never cover required content | NOT RUN | |
| One Save persists the complete Task/Repeat change | NOT RUN | |

### History and Settings

| Check | Result | Evidence / notes |
|---|---|---|
| History chronological hierarchy scans naturally | NOT RUN | |
| History Task actions are reachable and unambiguous | NOT RUN | |
| Settings Data & sync reads in user language | NOT RUN | |
| Saved-on-device safety is clear | NOT RUN | |
| Synchronization state/action is clear | NOT RUN | |
| Appearance controls are usable | NOT RUN | |
| Notifications controls are usable | NOT RUN | |
| Diagnostics remains subordinate/collapsed by default | NOT RUN | |
| Raw repository/Git/service facts do not compete with primary Settings content | NOT RUN | |

### Native/runtime behavior

| Check | Result | Evidence / notes |
|---|---|---|
| Cold launch reaches expected configured/onboarding state | NOT RUN | |
| Background → foreground lifecycle preserves/rechecks state correctly | NOT RUN | |
| Process restart preserves canonical Task state | NOT RUN | |
| Notification permission flow works | NOT RUN | |
| Reminder delivery is observed on device | NOT RUN | |
| Exact/inexact alarm behavior matches device/API policy | NOT RUN | |
| GitHub Device Flow completes on physical Android | NOT RUN | |
| Authorized private repository acquisition succeeds | NOT RUN | |
| Managed reconnect succeeds when required | NOT RUN | |
| Local-only operation remains usable during remote outage | NOT RUN | |
| Desktop/Linux → Android remote advance is adopted correctly | NOT RUN | |
| Android → Desktop/Linux remote advance is adopted correctly | NOT RUN | |
| Same-repository continuity survives restart/relaunch | NOT RUN | |

### Physical screenshots / recordings

Record paths, attachment IDs or URLs for at least:

- configured Planner populated and empty;
- sync attention;
- onboarding welcome + authorization + selection + attention;
- Task form Off + Weekly + Monthly + Stop repeating;
- History;
- Settings default + Diagnostics;
- no new IMP-09 recording is required solely to reconstruct the lost historical record; if a movement regression is observed during IMP-15, capture that new evidence and reopen SD-34/35.

**Evidence locations:**  

**IMP-15 verdict:** NOT RUN / PASS / FAIL  
**Blocking defect / issue reference if FAIL:**  

## 4. External acceptance still separate from this device record

Issue #31 live Linux/Desktop GitHub Device Flow + private-repository acceptance remains an external gate. Do not mark it PASS from Android Device Flow, browser fixtures or this physical-device record.

**Issue #31 result:** NOT RUN / PASS / FAIL  
**Evidence / issue comment:**  

## 5. Certification disposition

| Gate | Result |
|---|---|
| J110-IMP-09 physical Task movement | **PASS — completed; detailed execution record lost** |
| J110-IMP-15 physical UX/runtime matrix | NOT RUN |
| Issue #31 live Linux/Desktop GitHub acceptance | NOT RUN |

**Release-candidate promotion authorized:** NO

Promotion from `v1.1` to `master` remains prohibited until all required gates pass on the governed candidate lineage.
