# Android v1.1 development and physical-device certification

**Status:** v1.1 implementation support document. This document defines the repeatable local Android development loop and the evidence that must exist before the physical-device gates J110-IMP-08 and J110-IMP-09 can close. It does not itself constitute physical-device evidence.

**Authority:** [v1.1 technical solution](../architecture/v1.1-mobile-technical-solution.md), especially JIG-110-SD-08, SD-10, SD-24, SD-34 and SD-35; [v1.1 implementation plan](../implementation/v1.1-complete-implementation-plan.md), especially J110-IMP-08 and J110-IMP-09.

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
- Android `versionCode = major * 1_000_000 + minor * 1_000 + patch`.

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

Do not claim J110-IMP-08 closed until a real physical phone has launched the current Planner/History/Settings React application from that APK.

## 5. J110-IMP-09 physical drag/drop gate

Using the production Pangea implementation and dedicated visible Task grip, verify all of the following on the physical phone:

1. the grip reliably starts drag and the dragged Task remains visibly identifiable;
2. swiping the Task body scrolls rather than initiating drag;
3. same-date first/middle/last placement;
4. cross-date first/middle/last placement;
5. movement into an empty date;
6. the insertion indicator follows the intended destination;
7. inter-card whitespace retains a stable destination/indicator;
8. release persists exactly the last visible destination index;
9. cancellation/outside drop makes no canonical mutation;
10. long-Planner auto-scroll remains usable;
11. checkbox, menu, reference and card-open interactions remain independent from drag.

Record device, APK identity/hash, exact source commit, each result and any relevant logs/screenshots in the v1.1 evidence directory.

If touch initiation or destination updates are materially unreliable, stop. Do not layer another drag framework or a custom sensor stack on top of Pangea. Return to SD-34/SD-35 design review as required by the implementation plan.

## 6. Gate outcome

Only explicit physical-device evidence can close the gate:

- **PASS:** J110-IMP-08 physical APK loop works and every J110-IMP-09 interaction above passes on the recorded phone.
- **FAIL:** record the concrete device/WebView behavior and return to design review before later gated Android work.
- **NOT RUN:** browser/emulator/build evidence may remain useful, but neither physical gate is closed.

J110-IMP-10/11/12/13 and final v1.1 certification must not use this document as a substitute for the required physical result.
