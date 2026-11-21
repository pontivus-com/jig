#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ONLY=false
APK_PATH=""

usage() {
  cat >&2 <<'EOF'
Usage: scripts/verify-android-device-prerequisites.sh [--source-only] [--apk PATH]

--source-only  Verify the repository-owned Android toolchain contract without
               requiring an installed SDK or connected device.
--apk PATH     Also verify package/version identity and print the APK SHA-256.

Without --source-only, exactly one authorized physical Android device must be
connected through the SDK selected by ANDROID_SDK_ROOT or ANDROID_HOME.
EOF
}

fail() {
  printf 'ANDROID_DEVICE_PREFLIGHT=FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf 'ANDROID_DEVICE_PREFLIGHT=PASS: %s\n' "$*"
}

while (($# > 0)); do
  case "$1" in
    --source-only)
      SOURCE_ONLY=true
      shift
      ;;
    --apk)
      (($# >= 2)) || { usage; exit 2; }
      APK_PATH="$2"
      shift 2
      ;;
    --help|-h)
      usage >&1
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

PACKAGE_JSON="$ROOT/package.json"
ANDROID_DIR="$ROOT/android"
VARIABLES_GRADLE="$ANDROID_DIR/variables.gradle"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
WRAPPER_PROPERTIES="$ANDROID_DIR/gradle/wrapper/gradle-wrapper.properties"

[[ -f "$PACKAGE_JSON" ]] || fail "package.json is missing"
[[ -d "$ANDROID_DIR" ]] || fail "android/ is missing"
command -v node >/dev/null 2>&1 || fail "Node.js is required"

node - "$PACKAGE_JSON" <<'NODE'
const fs = require("node:fs");
const packagePath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const expected = {
  "@capacitor/core": "8.6.2",
  "@capacitor/android": "8.6.2",
  "@capacitor/cli": "8.6.2",
  "@capacitor/app": "8.1.2",
  "@capacitor/filesystem": "8.1.5",
  "@capacitor/local-notifications": "8.3.1",
  "buffer": "6.0.3",
};
for (const [name, version] of Object.entries(expected)) {
  const actual = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (actual !== version) {
    throw new Error(`${name} must be pinned to ${version}; found ${actual ?? "missing"}`);
  }
}
if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw new Error("package.json.version must be numeric SemVer");
}
NODE
pass "Capacitor dependency pins and package version"

grep -Fq "minSdkVersion = 24" "$VARIABLES_GRADLE" || fail "minSdkVersion is not 24"
grep -Fq "compileSdkVersion = 36" "$VARIABLES_GRADLE" || fail "compileSdkVersion is not 36"
grep -Fq "targetSdkVersion = 36" "$VARIABLES_GRADLE" || fail "targetSdkVersion is not 36"
grep -Fq 'applicationId "com.pontivus.jig"' "$APP_GRADLE" || fail "Android application ID is not com.pontivus.jig"
grep -Fq 'versionCode jigVersionCode' "$APP_GRADLE" || fail "Android versionCode is not package-derived"
grep -Fq 'versionName jigVersionName' "$APP_GRADLE" || fail "Android versionName is not package-derived"
grep -Fq 'jigVersionParts[0] * 1_000_000' "$APP_GRADLE" || fail "Android versionCode formula is not governed"
grep -Fq "classpath 'com.android.tools.build:gradle:8.13.0'" "$ANDROID_DIR/build.gradle" || fail "Android Gradle Plugin pin is not 8.13.0"
grep -Fq 'distributionUrl=https' "$WRAPPER_PROPERTIES" || fail "Gradle wrapper URL is missing"
grep -Fq 'gradle-8.14.3-all.zip' "$WRAPPER_PROPERTIES" || fail "Gradle wrapper pin is not 8.14.3"
pass "Android SDK, package identity, AGP and Gradle source contract"

if [[ "$SOURCE_ONLY" == true ]]; then
  pass "source-only mode; host and physical-device checks skipped"
  exit 0
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
((node_major >= 22)) || fail "Node.js 22+ is required; found $(node --version)"
pass "Node.js $(node --version)"

command -v bun >/dev/null 2>&1 || fail "Bun 1.4.4 is required for the governed build loop"
[[ "$(bun --version)" == "1.4.4" ]] || fail "Bun 1.4.4 is required; found $(bun --version)"
pass "Bun $(bun --version)"

command -v java >/dev/null 2>&1 || fail "JDK is required"
java_major="$(java -version 2>&1 | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p' | head -n 1)"
[[ "$java_major" =~ ^[0-9]+$ ]] || fail "Could not determine Java major version"
((java_major >= 21)) || fail "JDK 21+ is required; found Java $java_major"
pass "Java major version $java_major"

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$ANDROID_SDK_ROOT" ]] || fail "Set ANDROID_SDK_ROOT or ANDROID_HOME to the governed Android SDK"
ANDROID_SDK_ROOT="$(cd "$ANDROID_SDK_ROOT" 2>/dev/null && pwd)" || fail "Android SDK root is not accessible"

ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
SDKMANAGER="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
AAPT="$ANDROID_SDK_ROOT/build-tools/36.0.0/aapt"
[[ -x "$ADB" ]] || fail "SDK platform-tools/adb is missing under $ANDROID_SDK_ROOT"
[[ -x "$EMULATOR" ]] || fail "SDK emulator is missing under $ANDROID_SDK_ROOT"
[[ -x "$SDKMANAGER" ]] || fail "SDK command-line tools/sdkmanager is missing under $ANDROID_SDK_ROOT"
[[ -x "$AAPT" ]] || fail "SDK Build Tools 36.0.0/aapt is missing under $ANDROID_SDK_ROOT"
[[ -d "$ANDROID_SDK_ROOT/platforms/android-36" ]] || fail "SDK Platform 36 is missing"
pass "Android SDK root $ANDROID_SDK_ROOT"
pass "adb $($ADB version | sed -n '2p' | sed 's/^ *//')"
pass "emulator $($EMULATOR -version 2>&1 | sed -n '1p')"
pass "SDK Platform 36 and Build Tools 36.0.0"

wrapper_output="$($ANDROID_DIR/gradlew --version 2>&1)" || fail "Gradle wrapper could not start"
grep -Fq 'Gradle 8.14.3' <<<"$wrapper_output" || fail "Gradle wrapper did not resolve Gradle 8.14.3"
pass "Gradle wrapper 8.14.3"

mapfile -t devices < <("$ADB" devices | awk '$2 == "device" { print $1 }')
(( ${#devices[@]} == 1 )) || fail "Exactly one authorized adb device is required; found ${#devices[@]}"
DEVICE_SERIAL="${devices[0]}"
DEVICE_QEMU="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')"
[[ "$DEVICE_QEMU" != "1" ]] || fail "${DEVICE_SERIAL} is an emulator; a physical device is required"
DEVICE_MANUFACTURER="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.product.manufacturer | tr -d '\r')"
DEVICE_MODEL="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.product.model | tr -d '\r')"
DEVICE_ANDROID="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.build.version.release | tr -d '\r')"
DEVICE_API="$("$ADB" -s "$DEVICE_SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
[[ "$DEVICE_API" =~ ^[0-9]+$ ]] || fail "Could not determine Android API level for ${DEVICE_SERIAL}"
((DEVICE_API >= 24)) || fail "Physical device API ${DEVICE_API} is below the supported minimum API 24"
printf 'JIG_DEVICE_SERIAL=%s\n' "$DEVICE_SERIAL"
printf 'JIG_DEVICE_MANUFACTURER=%s\n' "$DEVICE_MANUFACTURER"
printf 'JIG_DEVICE_MODEL=%s\n' "$DEVICE_MODEL"
printf 'JIG_DEVICE_ANDROID_VERSION=%s\n' "$DEVICE_ANDROID"
printf 'JIG_DEVICE_API=%s\n' "$DEVICE_API"
pass "one authorized physical device ${DEVICE_MANUFACTURER} ${DEVICE_MODEL} (API ${DEVICE_API})"

if [[ -n "$APK_PATH" ]]; then
  [[ -f "$APK_PATH" ]] || fail "APK does not exist: $APK_PATH"
  package_version="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).version' "$PACKAGE_JSON")"
  IFS=. read -r major minor patch <<<"$package_version"
  expected_code=$((major * 1000000 + minor * 1000 + patch))
  badging="$($AAPT dump badging "$APK_PATH")" || fail "aapt could not inspect $APK_PATH"
  grep -Fq "package: name='com.pontivus.jig'" <<<"$badging" || fail "APK package is not com.pontivus.jig"
  grep -Fq "versionCode='$expected_code'" <<<"$badging" || fail "APK versionCode is not $expected_code"
  grep -Fq "versionName='$package_version'" <<<"$badging" || fail "APK versionName is not $package_version"
  printf 'JIG_APK_PATH=%s\n' "$(cd "$(dirname "$APK_PATH")" && pwd)/$(basename "$APK_PATH")"
  printf 'JIG_APK_SHA256=%s\n' "$(sha256sum "$APK_PATH" | awk '{print $1}')"
  pass "APK identity com.pontivus.jig ${package_version} (${expected_code})"
fi

pass "physical-device prerequisites are satisfied"
