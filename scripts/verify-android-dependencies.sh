#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-android-deps.XXXXXX")"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

cd "$ROOT/android"

for configuration in debugRuntimeClasspath releaseRuntimeClasspath; do
  output="$TMP_ROOT/$configuration.txt"
  ./gradlew :app:dependencies --configuration "$configuration" >"$output"

  if grep -Eiq     'com\.google\.android\.gms|com\.google\.firebase|crashlytics|appcenter|facebook-android-sdk|segment-android|amplitude-android'     "$output"; then
    printf 'Banned proprietary Android runtime dependency found in %s\n' "$configuration" >&2
    grep -Ei       'com\.google\.android\.gms|com\.google\.firebase|crashlytics|appcenter|facebook-android-sdk|segment-android|amplitude-android'       "$output" >&2 || true
    exit 1
  fi
done

if grep -REiq   'com\.google\.gms\.google-services|com\.google\.firebase|crashlytics|com\.google\.android\.gms'   --include='*.gradle' --include='*.gradle.kts' .; then
  printf 'Banned proprietary Android Gradle integration found\n' >&2
  exit 1
fi
