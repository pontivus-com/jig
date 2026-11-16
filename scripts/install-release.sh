#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Jig release installer: %s\n' "$1" >&2
  exit 1
}

[[ "$(uname -s)" == "Linux" ]] || fail "Jig v1 release installation supports Linux only."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v tar >/dev/null 2>&1 || fail "tar is required."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required."

case "$(uname -m)" in
  x86_64|amd64)
    ASSET="jig-linux-x64.tar.gz"
    ;;
  aarch64|arm64)
    ASSET="jig-linux-arm64.tar.gz"
    ;;
  *)
    fail "Unsupported CPU architecture: $(uname -m)"
    ;;
esac

BASE_URL="${JIG_RELEASE_BASE_URL:-https://github.com/pontivus-com/jig/releases/latest/download}"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-release-install.XXXXXX")"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

curl --fail --silent --show-error --location --proto '=https' --tlsv1.2   "$BASE_URL/$ASSET" -o "$TMP_ROOT/$ASSET"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2   "$BASE_URL/SHA256SUMS" -o "$TMP_ROOT/SHA256SUMS"

EXPECTED_LINE="$(grep -E "^[0-9a-f]{64}  ${ASSET}$" "$TMP_ROOT/SHA256SUMS" || true)"
[[ -n "$EXPECTED_LINE" ]] || fail "Release checksum for $ASSET is missing."

(
  cd "$TMP_ROOT"
  printf '%s\n' "$EXPECTED_LINE" | sha256sum -c -
)

tar -xzf "$TMP_ROOT/$ASSET" -C "$TMP_ROOT"
[[ -x "$TMP_ROOT/jig/scripts/install.sh" ]] || fail "Release bundle is missing the canonical installer."

"$TMP_ROOT/jig/scripts/install.sh" "$@"
