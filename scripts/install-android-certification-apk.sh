#!/usr/bin/env bash
set -euo pipefail

APK="${1:-}"
if [[ -z "$APK" || ! -f "$APK" ]]; then
  printf 'usage: %s /path/to/app-debug.apk\n' "$0" >&2
  exit 2
fi

ADB="${ADB:-}"
if [[ -z "$ADB" ]]; then
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -x "${ANDROID_SDK_ROOT}/platform-tools/adb" ]]; then
    ADB="${ANDROID_SDK_ROOT}/platform-tools/adb"
  elif [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/platform-tools/adb" ]]; then
    ADB="${ANDROID_HOME}/platform-tools/adb"
  else
    ADB="$(command -v adb || true)"
  fi
fi
[[ -n "$ADB" && -x "$ADB" ]] || {
  echo "adb is required" >&2
  exit 1
}

mapfile -t DEVICES < <("$ADB" devices | awk '$2 == "device" { print $1 }')
(( ${#DEVICES[@]} == 1 )) || {
  printf 'Exactly one authorized adb device is required; found %s\n' "${#DEVICES[@]}" >&2
  exit 1
}
SERIAL="${DEVICES[0]}"

if ! "$ADB" -s "$SERIAL" install -r "$APK"; then
  cat >&2 <<'EOF'
Jig certification update was rejected.
The existing application and all app-private data were left intact.
Do NOT uninstall or clear com.pontivus.jig to make this APK fit.
Use an APK from the governed stable certification-signing lineage instead.
EOF
  exit 1
fi

"$ADB" -s "$SERIAL" shell pm path com.pontivus.jig >/dev/null
printf 'Jig updated in place on %s; app-private data was not cleared.\n' "$SERIAL"
