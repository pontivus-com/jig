# Android v1.1 development and physical-device certification

**Status:** v1.1 implementation support document, amended after the 2026-11-19 physical UX failure and subsequent replacement Task-movement completion. The previous Pangea drag candidate failed; the replacement J110-IMP-09 physical Task-movement gate was later completed successfully, but its detailed execution record was not retained. This document now governs the remaining J110-IMP-15 physical mobile UX/runtime audit and preserves the historical IMP-09 checklist without reconstructing missing evidence.

**Authority:** [v1.1 technical solution](../architecture/v1.1-mobile-technical-solution.md), especially JIG-110-SD-08, SD-10, SD-24, SD-34 and SD-35; [v1.1 implementation plan](../implementation/v1.1-complete-implementation-plan.md), especially J110-IMP-08, J110-IMP-09 and J110-IMP-15.

## 1. Governed Android baseline

The repository must retain:

- application ID: `com.pontivus.jig`;
- Capacitor core/android/cli: `8.6.2`;
- `@capacitor/app@8.1.2`;
- `@capacitor/filesystem@8.1.5`;
- `@capacitor/local-notifications@8.3.1`;
- min SDK 24;
- compile SDK 36;
- target SDK 36;
- Node.js 22+ for Capacitor tooling;
- Android Studio 2025.2.1 or newer compatible tooling with SDK Platform 36;
- Android `versionName` derived from root `package.json.version`;
- Android `versionCode = major * 1_000_000 + minor * 1_000 + patch`;
- JDK 21 or newer for the pinned Gradle/Android plugin and Capacitor plugin
  toolchain; hosted certification uses JDK 21;
- Bun `1.4.4` for the frozen JavaScript/Capacitor build loop.

Do not add Google Services, Firebase, Play Services, proprietary analytics/crash SDKs, a second Android Task model or a second native release-version authority.

## 2. Record the local toolchain before physical certification

Capture the exact output of the commands below in the v1.1 evidence record for the device run:

```bash
node --version
bun --version
java -version
adb version
adb devices -l
cd android
./gradlew --version
cd ..
```

Also record:

- Android Studio version;
- installed Android SDK Platform / build-tools versions used by the build;
- physical device manufacturer/model;
- Android version and API level;
- WebView/Chrome version used by the Capacitor runtime.

The recorded environment must satisfy the governed baseline above. Do not infer a physical-device pass from emulator/browser results.

The repository-owned prerequisite check is:

```bash
ANDROID_SDK_ROOT="$HOME/Android/Sdk" bash scripts/verify-android-device-prerequisites.sh --apk android/app/build/outputs/apk/debug/app-debug.apk
```

It verifies the pinned source contract, Node/Bun/Java/Gradle versions, SDK
Platform 36 and Build Tools 36.0.0, one authorized **physical** adb device at
API 24 or newer, the stable package identity, the derived version metadata and
the exact APK SHA-256. It does not install or mutate the device. Android Studio
may be used for inspection, but this CLI check is the certification authority
for the repeatable prerequisite state.

For source/CI validation without a device:

```bash
bash scripts/verify-android-device-prerequisites.sh --source-only
```

## 3. Deterministic version and debug-APK build

From the repository root:

```bash
bun install --frozen-lockfile
bun run android:version:check
bun run android:build:debug
```

`android:version:check` must prove the native values derive from root `package.json.version`. During ordinary v1.1 implementation the package version intentionally remains the published release version; the later governed `release/v1.1.0` metadata PR is what changes it to `1.1.0`.

The debug APK is expected under the normal Gradle debug-output directory beneath `android/app/build/outputs/apk/debug/`. Do not treat a debug APK as a public distribution artifact.

## 4. Install, launch and inspect on a physical phone

With exactly one intended physical device selected through adb:

```bash
adb devices -l
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.pontivus.jig -c android.intent.category.LAUNCHER 1
adb logcat
```

Android Studio deployment may additionally be used during development, but `adb install -r` is the governed repeatable installation/update command for certification.

After a code change, repeat:

```bash
bun run android:build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

J110-IMP-08 closes on the governed deterministic Android shell/debug-APK build and its non-device verification. A real physical-phone launch of the candidate APK is deferred to J110-IMP-15 and must not be used as an IMP-08 prerequisite.

## 5. J110-IMP-09 replacement Task-movement physical gate — COMPLETE

J110-IMP-09 was completed successfully on physical Android, but the detailed device/check/screenshot record was not retained. `../evidence/v1.1.0/physical-android-certification.md` now records that correction explicitly and remains the canonical evidence record for the still-open IMP-15 matrix. Do not reconstruct unknown IMP-09 facts.

The previous Pangea implementation is a recorded **FAIL**. The replacement dnd-kit implementation subsequently passed the physical Task-movement gate and must not be rerun solely to reconstruct the lost detailed record.

The current retained post-UX source/APK lineage is source `611c8ced6a854a80f24bf727c53d792f5c5d556c` and GitHub Actions APK artifact `14541004265`; the downloaded artifact contains `app-debug.apk` with SHA-256 `27449f443a5617bd1cd7bbfec2ac0971e4104d647ff77c6975df06139e15c52d`. These are the governed inputs for the remaining IMP-15 work. The lost IMP-09 record does not support reconstructing an exact historical source/APK claim.

The repository package authority expects application ID `com.pontivus.jig`; the governed preflight must prove package/version badging with Build Tools 36.0.0 `aapt` for the remaining IMP-15 certification host.

1. record source SHA, APK SHA-256, device model, Android version and WebView/Chrome version;
2. run at least 20 sequential grip drags with no stranded overlay/floating card;
3. confirm the >=48×48 grip initiates directly without long press;
4. confirm Task-body swipe scroll never initiates drag;
5. same-date first/middle/last;
6. cross-date first/middle/last;
7. empty date;
8. target every explicit inter-card insertion slot;
9. verify visible slot == persisted date/index;
10. cancel/outside drop and pointer/system cancellation restore exactly;
11. verify long-list auto-scroll while maintaining target;
12. verify checkbox/menu/reference/card-open independence;
13. repeat after scrolling and after opening/closing the BottomSheet.

The checklist above is retained as the historical IMP-09 gate definition. Its detailed execution results were not retained. If new physical evidence during IMP-15 shows a repeated missed drop, floating-card residue, unstable slot or scroll conflict, reopen SD-34/35 from that new evidence. Do not add Pangea, another drag library or a platform-only sensor stack.

### Broader mobile UX observations for J110-IMP-15

Use both `../design/reference/jig-v1.1-application-ux-ui-governed-reference.html` and `../design/reference/jig-v1.1-mobile-ux-ui-governed-reference.html` as the binding Android/narrow presentation targets. The app-wide reference owns the configured shell/navigation/Planner/History/Settings hierarchy; the mobile reference owns onboarding and the complete Task BottomSheet/Repeat composition. On the same candidate, physically inspect:

- onboarding welcome, GitHub authorization, repository-selection, finishing/attention and first-empty-Planner states preserve the governed hierarchy and remain usable at device width;
- the configured application row, Planner temporal row and persistent Planner/History/Settings bottom navigation remain legible, reachable and non-overlapping with system/safe-area insets;
- the Planner-only FAB is the single highest-prominence creation action and does not obscure Tasks, date Add controls or bottom navigation;
- healthy synchronization remains visually subordinate while warning/error attention is understandable and actionable;
- Previous/Next/Today/date Add/Task/BottomSheet/Repeat/Settings controls preserve their >=48px interaction targets without becoming equally prominent filled controls;
- the **complete** Task BottomSheet remains one scrollable form ordered Title → Date → Repeat → Reminder → Priority → Context → Reference → Notes;
- Weekly and Monthly progressive disclosure does not hide or make Reminder/Priority/Context/Reference/Notes unreachable;
- weekday controls are physically usable, wrap without overlap and preserve the >=48px target contract;
- the fixed/sticky Task action area never obscures required controls, validation or Notes;
- opening the software keyboard/IME while editing Title, Context, Reference or Notes still permits normal scrolling and access to Save/Cancel;
- Stop repeating shows its governed consequence before Save and remains a one-Save flow;
- Settings Data & sync / Appearance / Notifications / Diagnostics hierarchy and scanability;
- safe-area/sticky behavior and normal vertical scrolling.

Browser geometry is necessary but does not replace this physical usability evidence. Screenshots/notes for the governed onboarding and complete-form states are part of the J110-IMP-15 evidence packet.

### Gate outcome

- **PASS / COMPLETE:** J110-IMP-09 physical Task movement was completed successfully.
- **Evidence retention:** the detailed execution record was lost; device identity, exact source/APK lineage and individual checklist results remain unknown and must not be reconstructed.
- **Regression rule:** new physical movement failures observed during IMP-15 reopen SD-34/35.


## 6. Remaining physical certification outcome

J110-IMP-09 is closed. Release-candidate closure now depends on explicit physical-device evidence for J110-IMP-15 plus the separate live Linux/Desktop acceptance gate.

- **PASS:** the J110-IMP-15 physical-device certification records the governed current candidate launch/runtime, onboarding, reminder, lifecycle, Git/reconnect and interoperability evidence.
- **FAIL:** record the concrete device/WebView behavior and return only the affected governing design/task contract for correction.
- **NOT RUN:** browser/emulator/build evidence may remain useful, but the physical-device portions of J110-IMP-15 remain open.

J110-IMP-10/11/12/13 and final v1.1 certification must not use this document as a substitute for the required remaining physical result.
