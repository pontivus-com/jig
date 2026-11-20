# Jig v1.1 — physical Android certification evidence

**Status:** J110-IMP-09 COMPLETE / DETAILED EXECUTION RECORD LOST / J110-IMP-18..20 COMPLETE / J110-IMP-21 PHYSICAL CONFIRMATION ATTEMPTED AND BLOCKED / J110-IMP-23 REOPENED FOR FR-33/SD-43 CROSS-PLATFORM WEEKPAGER / J110-IMP-24 OPEN — SHARED OPERATIONAL ATTENTION BANNER ALIGNMENT / J110-IMP-15 PARTIAL — the bounded remediation remains hosted-certified on exact source `3b60ad938f2173521c4eb2aa8b59603a15d930b1` / Verify #1598 for its tested scope only. That APK predates and cannot certify the rewritten WeekPager contract. The corrected APK was physically launched and the compact-shell/past-date checks passed, but physical Task creation failed with `Illegal invocation`; IMP-21 and IMP-15 remain open. Do not reconstruct unknown IMP-09 evidence.

**Partial-session executable source:** `222f2fe0e672b122424042b3fa39747efb991610`  
**GitHub Actions APK artifact:** not retained in the session record  
**Artifact file:** `app-debug.apk`  
**Physical APK SHA-256:** `b3d134786827dea601f4f3cbd89ad4269578393151efd5dab056812a682c8d4b`  
**Expected Android application ID:** `com.pontivus.jig`  
**Governed references:** `../../design/reference/jig-v1.1-application-ux-ui-governed-reference.html`, `../../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html`, `../../design/ui-solution.md`, `../../development/android-v1.1.md`.

**IMP-24 physical boundary:** the Android application renders the same shared operational-attention component as desktop. A fresh candidate must physically confirm multi-line error/warning icon centering and optional recovery/navigation action alignment/wrapping in the WebView. No native Android notification/banner implementation is authorized; prior APKs do not close this geometry defect.

### Current post-remediation physical candidate — physical confirmation attempted

- Source/head: `3b60ad938f2173521c4eb2aa8b59603a15d930b1`.
- Permanent Verify: `44652277552` / #1598 — **PASS** across Linux/browser, Android build certification and API-24 runtime.
- Android artifact: `14591926175`, `jig-android-debug-184c8c824b32ff53c53136eaf1c1e4ab78fe480a`.
- Artifact digest: `sha256:dbb4f96a39af353adfee7360d2b0ebe36ae954d119407273a486fd66e6b610b9`.
- APK: `app-debug.apk`, 9,780,552 bytes.
- APK SHA-256: `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0`.
- Hosted API-24 proof: 5/5 instrumentation tests, `BUILD SUCCESSFUL`.
- This identity is the required input for the focused J110-IMP-21 physical confirmation. Do not copy the earlier Samsung-session PASS values onto this candidate; record new physical observations explicitly.

### 2026-11-20 focused J110-IMP-21 physical execution

This is a new acceptance run against the exact post-remediation APK, not a reconstruction of the lost IMP-09 record.

| Fact | Observed value |
|---|---|
| Certification date/time | 2026-11-20, approximately 08:36–08:43 Asia/Bangkok |
| Source SHA checked | `3b60ad938f2173521c4eb2aa8b59603a15d930b1` |
| Verify | `44652277552` / #1598 — PASS |
| APK artifact | `14591926175` |
| APK SHA-256 checked | `501efb58cbf3e0e9bef9163f501426b9ef8a14e095f3584ef234db690ad686a0` |
| APK identity | `com.pontivus.jig`, versionName `1.0.6`, versionCode `1000006` |
| Device | Samsung SM-S901E |
| Android | 16 / API 36 |
| adb serial | `R5CT62VA0MX` |
| WebView / Chrome | Android System WebView 157.0.8103.50 / Chrome 150.0.7871.186 |
| Node / Bun | Node `v26.13.1` / Bun `1.4.4` |
| JDK / SDK | JDK `27.0.1.1` / `/home/rpstreef/Android/Sdk` |
| Platform / Build Tools | API 36 / Build Tools 36.0.0 |

The governed device preflight passed with exactly one authorized physical device and the exact APK hash above. The hosted artifact ZIP digest also matched the retained artifact digest `sha256:dbb4f96a39af353adfee7360d2b0ebe36ae954d119407273a486fd66e6b610b9`.

Focused observations:

- **PASS — launch and compact shell:** the exact APK launched on the physical phone. The mobile application row rendered Jig identity at left, the centered Planner title, and restrained synchronization status at right; the application row measured 52 CSS px and the visible interactive controls exposed 48 px hit rectangles.
- **PASS — readability and leading-control alignment:** body-scale action/navigation labels were legible. Task grip and checkbox hit areas were vertically centered within the Task cards; the observed grip and checkbox rectangles were independent.
- **PASS — past-date rejection:** a real grip gesture aimed at the unavailable Thursday 19 insertion slot produced `Jig could not complete the operation` / `Outstanding Tasks can only be scheduled for today or a future date`. The Friday Task remained unchanged, the drag overlay count returned to zero, and no stranded card remained.
- **PASS — restart persistence:** the pre-existing Planner Tasks remained after force-stop and relaunch of the exact APK.
- **FAIL — physical Task creation on hosted artifact `14591926175`:** a one-off Add task and a Weekly recurring Add task both left the editor open with `Illegal invocation`; neither new Task was persisted. The Weekly form itself rendered the complete progressive-disclosure fields and the native end-date picker, but its one-Save path did not complete.
- **NOT CLOSED — synchronization continuity:** this device was launched with the retained provider-neutral local repository in `Sync needs attention`; this run did not establish a new healthy same-repository Git continuity result for the exact candidate.

The physical create failure blocks IMP-21 closure and prevents the remaining IMP-15 matrix from being marked complete. It is acceptance evidence for the executable candidate, not authorization to add an Android-only workaround. The failure is consistent with the Android native command path passing `crypto.randomUUID` as an unbound callback at `ui/src/runtime-native.ts:110`, but the implementation cause remains for the implementation owner to confirm.

### Local follow-up correction — mobile header safe-area inset

The physical review also identified a redundant Android top safe-area inset above the mobile Jig logo. The follow-up source correction removes that duplicate inset from the narrow application and onboarding headers while retaining the governed 52px application row.

- Local rebuilt APK SHA-256: `128bc37c2c2a10024d2b665b92a5ad74336086479f154a5d845de1d8fb733571`.
- On the connected Samsung SM-S901E, the mobile application row measured **52px**, the narrow header computed top padding was **0px**, and the captured screen showed no empty band above the Jig logo.
- This local APK is not the hosted-certified artifact `14591926175`; the executable change requires a fresh hosted Verify and exact artifact before certification can be amended.

### Local follow-up correction — Android Task creation callback

The hosted-candidate failure was traced to the Android runtime passing the unbound `crypto.randomUUID` method into the shared persistence command. The adapter now passes `() => crypto.randomUUID()` so WebView invokes it with the correct receiver.

- Local rebuilt APK SHA-256: `2755064c364fb1e54b958d6a32848510037cd651323e826fbd36a928606bf338`.
- On Samsung SM-S901E, physical one-off Task creation passed and the resulting Task survived force-stop/relaunch.
- Physical Weekly creation also passed through the complete progressive-disclosure form, including an end date of `2026-11-27`; the resulting Task showed `Weekly · Fri · until 2026-11-27` and survived force-stop/relaunch.
- No `Illegal invocation` appeared on either flow. Hosted re-certification of this executable correction remains required before IMP-21/IMP-15 closure.

### Local follow-up correction — mobile History and Settings insets

The mobile History and Settings reading surfaces were also found to touch the viewport edges. The narrow layout now applies the same `--spacing-1` horizontal inset used by Planner tracks without changing the governed full-bleed application frame or the continuous 50rem desktop measure.

- Final local rebuilt APK SHA-256: `e5ea7fb1b229adfcdbc39f44e6285af858fcbc00a799aeafcb103240e489181c`.
- On Samsung SM-S901E, History and Settings each measured `padding-inline-start: 4px` and `padding-inline-end: 4px`, matching the narrow Planner inset; screenshots show the content no longer hugging the viewport edges.
- The focused browser measure test and the physical Android check both passed. Hosted re-certification remains required for the combined executable changes.

### Local follow-up correction — narrow Planner current-day anchoring

Narrow Planner now anchors the current day to the content viewport top when Planner is loaded, reloaded or returns to a week containing today. It does not continuously fight user scrolling; earlier days remain available when the user deliberately scrolls upward.

- Final local rebuilt APK SHA-256: `b7d86d3355ed5d41bf8b2cd77364c2f6182fa38584fba73f795deb5de02e12db`.
- On Samsung SM-S901E, launch/relaunch measured the current-day section at the content viewport top (`delta: 0`, `scrollTop: 293.33px`). A physical downward swipe exposed the prior Monday–Thursday sections.
- The focused browser scroll test and physical Android check passed. Hosted re-certification remains required for this executable change.

### Local follow-up correction — reminder lifecycle and active-app notification

The reminder presentation now exposes one honest, non-canonical lifecycle projection: `Reminder scheduled` before the reminder time, `Reminder due · time passed` after the time elapses, and `Reminder notified` only after the browser service-worker or Android local-notification adapter reports that the notification was displayed. The durable due attention remains independent of notification delivery, and no `notified_at` or delivery state was added to canonical Task data.

- Final local rebuilt APK SHA-256: `f3ddc820d7519a7aff32841e3dda1e886eaba2f4db1e1041c5dc20d79d02387f`.
- On Samsung SM-S901E / Android 16, Android notification permission was enabled from Settings. An already-due `Audit Workflow` reminder produced a real `Jig reminder` system notification while Jig remained active; the notification showed the Task title and the card changed to `Reminder notified` after returning to the app.
- The immediate Android request explicitly uses `isExactNotification: false`; exact-alarm settings remain relevant only to future scheduled reminders.
- Evidence screenshots: `/tmp/jig-reminder-after-rebuild.png` (system notification) and `/tmp/jig-reminder-notified-card.png` (in-app projection).
- Browser lifecycle coverage passed: scheduled, elapsed/due, notified, denied/unsupported and retryable delivery states; native adapter/unit and architecture checks passed. Hosted re-certification remains required before this local executable correction can close IMP-21/IMP-15.

### Local follow-up correction — Android Back navigation

Configured Android navigation now owns a small prior-destination history. Back closes an open Task workspace before returning through prior Planner/History/Settings destinations; at the root, Jig falls through to the platform/browser back behavior rather than inventing another destination.

- Local debug APK installed successfully on Samsung SM-S901E, adb serial `R5CT62VA0MX`.
- Local debug APK SHA-256: `e28953853c242fd68ab41e533ff40567cddf57b7f4d8d5eccf52c37fe538141f`.
- Source unit/type/architecture acceptance passed: 42 test files / 264 tests and strict TypeScript typecheck.
- Physical confirmation on the unlocked device passed: Settings → History → Back returned to Settings, Back returned to Planner, and Back with an open Task workspace first dismissed the focused Android keyboard and then closed the workspace, returning to Planner. A final Back at the Planner root exited Jig to the launcher.
- Hosted re-certification remains required before this local executable correction can close IMP-21/IMP-15.

### Local follow-up correction — Android system-bar appearance

The Android shell now projects Astryx's resolved Light/Dark/System appearance to the native status and navigation-bar indicator contrast. A forced Jig Light selection therefore uses dark native indicators even when the device remains in Dark mode; Jig Dark and System resolve back to light indicators on the dark device.

- Local debug APK SHA-256: `54bf1cefae429196e7622bfdc6cf33e544b0853ecd927760fb443db0d8cc6237`.
- On Samsung SM-S901E / Android 16, forced Light produced Android window `vsysui=2010` (light status/navigation indicators), forced Dark produced `vsysui=1612`, and System on the dark device also produced `vsysui=1612`.
- TypeScript, Android Java compilation, architecture tests and the physical mode-switch check passed. Hosted re-certification remains required before this local executable correction can amend the certified candidate.

### Local follow-up correction — notified reminder card highlight

The Task card now treats the warning highlight as unresolved due attention only. Once the notification adapter confirms delivery and the card displays `Reminder notified`, the due highlight is removed while the lifecycle label remains visible.

- Local debug APK SHA-256: `e656f2751c243f245c54b307285b4975b5b4aacf3ad283c318383369f7f79440`.
- Browser reminder coverage passed 12/12 tests. On Samsung SM-S901E / Android 16, both physically visible `Reminder notified` cards had no `jig-task-card-reminder-due` class.
- Hosted re-certification remains required before this local executable correction can amend the certified candidate.

### Local follow-up — motion audit correction and physical WebView acceptance

The final local debug APK used for this focused motion check contains the History animated-layout owner, desktop Today transition, theme/status-surface transition contract, reduced-motion suppression and the mobile week swipe as it existed before J110-IMP-23 (the rejected raw pointer adapter). This APK predates the Astryx `usePanGesture` replacement, so it is not evidence for the IMP-23 swipe.

| Fact | Observed value |
|---|---|
| Device | Samsung SM-S901E / Android 16 / API 36 |
| adb serial | `R5CT62VA0MX` |
| APK SHA-256 | `d2cfe5fcde3629310cbec5dafcd2b7d5e9a199b7bd4cefaba083c707dd99cde` |
| Package/activity | `com.pontivus.jig/.MainActivity` — launched and resumed |
| Browser acceptance | 82/82 Playwright tests passed; reduced-motion browser contract passed |
| Architecture/type acceptance | 44/44 targeted tests passed; strict TypeScript and production build passed |

Focused physical observations:

- **PASS — interruption:** opening the `Audit Workflow` Task workspace and issuing Android Back during the BottomSheet entry returned to the Planner with no stranded workspace, overlay or altered Task state. The resumed activity remained `com.pontivus.jig/.MainActivity`.
- **PASS — reduced-motion WebView contract on the physical device:** Chrome DevTools Protocol emulation of `prefers-reduced-motion: reduce` in the installed Android WebView reported `matchMedia(...).matches === true`, `scroll-behavior: auto` and no Planner board animation. This exercised the same built WebView CSS used by the APK, not a second native motion implementation.
- **Boundary recorded:** Android's `secure/remove_animations=1` setting did not cause the WebView media query to become true on this Samsung build. Jig therefore does not claim that the OS setting itself is a WebView CSS preference bridge; the browser/WebView media-query contract remains the authoritative reduced-motion boundary, and native system animation settings remain OS-owned.

**Historical J110-IMP-23 swipe replacement — SUPERSEDED / NOT RETAINED in this APK.** The Astryx `usePanGesture` adapter landed after this APK was built and was later superseded by FR-33/SD-43. Its former local typecheck/architecture/browser checks are historical implementation evidence only. This APK still contains the rejected raw adapter and must not be cited as WeekPager acceptance. Rewritten IMP-23 requires a new exact-head APK exercising the shared desktop+narrow WeekPager, physical horizontal paging, vertical scroll arbitration and active-week drag isolation.

This resolves the motion audit's implementation, ownership, interruption and physical-WebView reduced-motion findings. Hosted re-certification of the combined executable changes and the broader J110-IMP-15 matrix remain required before release promotion.


The earlier `222f2fe…` source/APK is retained as partial historical physical evidence only. J110-IMP-18..20 are now complete; the corrected physical candidate identity and this run's observations are recorded above for IMP-21 and the remaining IMP-15 work.

## 1. Physical certification environment

The table below preserves the recorded 2026-11-20 partial Samsung session. For the next physical run, record the exact device/host against the **current post-remediation candidate** below. The historical J110-IMP-09 device/toolchain metadata was not retained and remains explicitly unknown.

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
- These findings are now implemented and non-device certified under J110-IMP-18..20. They must be physically confirmed under J110-IMP-21 on the corrected APK recorded below.

## 3. J110-IMP-15 — physical mobile UX/runtime certification

J110-IMP-09 is already complete. First run the focused J110-IMP-21 physical confirmation on the governed post-remediation candidate, then continue the remaining J110-IMP-15 matrix on that lineage. Do not rerun IMP-09 solely to reconstruct its lost detailed record.

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

**IMP-15 verdict:** **IN PROGRESS — the older hosted artifact failed Task creation; the local follow-up APK passes creation and restart persistence, but exact hosted re-certification is pending.**
**Remaining confirmation:** certify the follow-up executable, then complete the remaining J110-IMP-15 matrix including recurrence non-accumulation and synchronization continuity.

## 4. External acceptance still separate from this device record

Issue #31 live Linux/Desktop GitHub Device Flow + private-repository acceptance remains an external gate. Do not mark it PASS from Android Device Flow, browser fixtures or this physical-device record.

**Issue #31 result:** **OPEN — live Linux/Desktop acceptance not closed**. A live issue read on 2026-11-20 confirms the issue remains open and still requires interactive Desktop/Linux Device Flow, selected private-repository acquisition/synchronization through Secret Service, and device-local refresh/reconnect evidence.
**Evidence / issue:** [pontivus-com/jig#31](https://github.com/pontivus-com/jig/issues/31)

## 5. Certification disposition

| Gate | Result |
|---|---|
| J110-IMP-09 physical Task movement | **PASS — completed; detailed execution record lost** |
| J110-IMP-23 FR-33/SD-43 cross-platform WeekPager | **REOPENED — no retained APK or physical evidence yet certifies the rewritten contract; prior raw/usePanGesture results are superseded history** |
| J110-IMP-24 shared operational-attention Banner geometry | **OPEN — prior APKs/screenshots do not certify vertically centered multi-line icon/action geometry; requires exact-candidate WebView confirmation** |
| J110-IMP-15 physical UX/runtime matrix | **IN PROGRESS — local follow-up passes Task creation; exact hosted re-certification and remaining matrix are pending** |
| Issue #31 live Linux/Desktop GitHub acceptance | NOT RUN |

**Release-candidate promotion authorized:** NO

Promotion from `v1.1` to `master` remains prohibited until all required gates pass on the governed candidate lineage.
