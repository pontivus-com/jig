# Jig v1.1 — physical Android certification evidence

**Status:** J110-IMP-09 COMPLETE / DETAILED EXECUTION RECORD LOST / J110-IMP-15 PARTIAL — REMEDIATION BLOCKED — the 2026-11-20 physical session captured real Android synchronization/restart/UI evidence on source `222f2fe…` but also exposed defects governed by J110-IMP-18..21. J110-IMP-15 is not PASS and final certification must use the post-remediation executable candidate. Do not reconstruct unknown IMP-09 evidence.

**Partial-session executable source:** `222f2fe0e672b122424042b3fa39747efb991610`  
**GitHub Actions APK artifact:** not retained in the session record  
**Artifact file:** `app-debug.apk`  
**Physical APK SHA-256:** `b3d134786827dea601f4f3cbd89ad4269578393151efd5dab056812a682c8d4b`  
**Expected Android application ID:** `com.pontivus.jig`  
**Governed references:** `../../design/reference/jig-v1.1-application-ux-ui-governed-reference.html`, `../../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html`, `../../design/ui-solution.md`, `../../development/android-v1.1.md`.

IMP-18..20 necessarily establish a later executable candidate. The source/APK above is retained as partial physical evidence only and must not be reused as final certification lineage after those corrections.

## 1. Physical certification environment

Record the exact device and certification host for the remaining J110-IMP-15 testing. The historical J110-IMP-09 device/toolchain metadata was not retained and remains explicitly unknown.

| Fact | Recorded value |
|---|---|
| Certification date/time | |
| Tester | |
| Source SHA checked | `222f2fe0e672b122424042b3fa39747efb991610` |
| APK SHA-256 checked | `b3d134786827dea601f4f3cbd89ad4269578393151efd5dab056812a682c8d4b` |
| APK package name from `aapt dump badging` | `com.pontivus.jig` |
| APK versionName | |
| APK versionCode | |
| Device manufacturer | Samsung |
| Device model | SM-S901E |
| Android version | 16 |
| Android API level | 36 |
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

**Preflight result:** **PASS for the 2026-11-20 partial session**  
**Evidence location / attachment:** session output was observed; formal attachment/path still needs to be recorded during IMP-21 final evidence closure.  

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

## 2.1 2026-11-20 partial IMP-15 session evidence

This session is retained as real-device evidence but **does not close IMP-15**.

- Desktop Secret Service correction was deployed through the normal installer; existing repository/configuration was preserved; `jig.service` remained active on port 47831 and setup status reported configured.
- Android source `222f2fe…` built/installed on Samsung SM-S901E, Android 16/API 36; device preflight passed for `com.pontivus.jig`; APK SHA-256 is recorded above.
- Android Git path: local changes committed, remote push completed, Settings showed **Up to date**, restart/relaunch preserved Planner data and synchronization state.
- UI evidence was captured for Planner, Task form/IME, Repeat states, History, Settings and healthy synchronization.
- Physical review found blockers: compact Planner has no centered title; History/Settings replace Jig identity; header chrome is taller than needed; interactive button/navigation text is too small in places; grip/checkbox are vertically top-biased; past-date drag rejection has no clear feedback; recurring rollover can accumulate stale outstanding occurrences.
- These findings are now governed by J110-IMP-18..20 and must be re-tested under J110-IMP-21 on the later corrected APK.

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

**IMP-15 verdict:** **IN PROGRESS / BLOCKED pending J110-IMP-18..21**  
**Blocking findings:** compact header/title/chrome + interactive-label legibility; Task grip/checkbox vertical alignment; past-date scheduling feedback; recurrence rollover non-accumulation.  

## 4. External acceptance still separate from this device record

Issue #31 live Linux/Desktop GitHub Device Flow + private-repository acceptance remains an external gate. Do not mark it PASS from Android Device Flow, browser fixtures or this physical-device record.

**Issue #31 result:** NOT RUN / PASS / FAIL  
**Evidence / issue comment:**  

## 5. Certification disposition

| Gate | Result |
|---|---|
| J110-IMP-09 physical Task movement | **PASS — completed; detailed execution record lost** |
| J110-IMP-15 physical UX/runtime matrix | **IN PROGRESS / BLOCKED — partial 2026-11-20 evidence retained; IMP-18..21 open** |
| Issue #31 live Linux/Desktop GitHub acceptance | NOT RUN |

**Release-candidate promotion authorized:** NO

Promotion from `v1.1` to `master` remains prohibited until all required gates pass on the governed candidate lineage.
