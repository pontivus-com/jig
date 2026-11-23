#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.pontivus.jig"

command -v adb >/dev/null 2>&1 || {
  echo "adb is required for Android reinstall preservation verification" >&2
  exit 1
}

(
  cd "$ANDROID_DIR"
  ./gradlew :app:assembleDebug
)

adb install -r "$APK"
adb shell run-as "$PACKAGE" mkdir -p files/repository/.jig/local
adb shell run-as "$PACKAGE" mkdir -p files/repository/.jig/git
adb shell run-as "$PACKAGE" sh -c   'printf sqlite-state > files/repository/.jig/local/reinstall-sentinel'
adb shell run-as "$PACKAGE" sh -c   'printf git-state > files/repository/.jig/git/reinstall-sentinel'

# The second installation is deliberately an update install. Never uninstall or
# clear package data to make a certification artifact fit.
adb install -r "$APK"

SQLITE_SENTINEL="$(
  adb shell run-as "$PACKAGE"     cat files/repository/.jig/local/reinstall-sentinel |
    tr -d '\r'
)"
GIT_SENTINEL="$(
  adb shell run-as "$PACKAGE"     cat files/repository/.jig/git/reinstall-sentinel |
    tr -d '\r'
)"
[[ "$SQLITE_SENTINEL" == "sqlite-state" ]] || {
  echo "App-private SQLite/local state did not survive in-place reinstall" >&2
  exit 1
}
[[ "$GIT_SENTINEL" == "git-state" ]] || {
  echo "App-private Git repository state did not survive in-place reinstall" >&2
  exit 1
}

(
  cd "$ANDROID_DIR"
  ./gradlew :app:connectedDebugAndroidTest
)

printf 'Android in-place reinstall preserved Jig app-private repository/local state.\n'
