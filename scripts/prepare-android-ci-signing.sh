#!/usr/bin/env bash
set -euo pipefail

OUTPUT="${1:-}"
if [[ -z "$OUTPUT" ]]; then
  printf 'usage: %s /absolute/output/jig-ci-debug.p12\n' "$0" >&2
  exit 2
fi
[[ "$OUTPUT" = /* ]] || {
  printf 'Jig Android CI signing output must be absolute\n' >&2
  exit 2
}

AOSP_BUILD_COMMIT="045a3d6a3e359633a14853a5a5e1e4f2a11cbdae"
AOSP_PK8_BLOB="586c1bd5cf96f9358f36b37ea98fef93f4d0a8e3"
AOSP_CERT_BLOB="e242d83e2bf72169ab0abd5280d4d455caef71eb"
BASE="https://raw.githubusercontent.com/aosp-mirror/platform_build/${AOSP_BUILD_COMMIT}/target/product/security"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/jig-android-signing.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT INT TERM

curl --fail --location --proto '=https' --tlsv1.2   "$BASE/testkey.pk8" -o "$WORK/testkey.pk8"
curl --fail --location --proto '=https' --tlsv1.2   "$BASE/testkey.x509.pem" -o "$WORK/testkey.x509.pem"

[[ "$(git hash-object "$WORK/testkey.pk8")" == "$AOSP_PK8_BLOB" ]] || {
  echo "Pinned AOSP test private-key blob does not match" >&2
  exit 1
}
[[ "$(git hash-object "$WORK/testkey.x509.pem")" == "$AOSP_CERT_BLOB" ]] || {
  echo "Pinned AOSP test certificate blob does not match" >&2
  exit 1
}

openssl pkcs8 -inform DER -nocrypt   -in "$WORK/testkey.pk8"   -out "$WORK/testkey.pem"
mkdir -p "$(dirname "$OUTPUT")"
openssl pkcs12 -export   -in "$WORK/testkey.x509.pem"   -inkey "$WORK/testkey.pem"   -name jig-ci-debug   -out "$OUTPUT"   -passout pass:jig-ci-debug
chmod 0600 "$OUTPUT"

CERT_SHA256="$(
  openssl x509 -in "$WORK/testkey.x509.pem" -outform DER |
    sha256sum | awk '{print $1}'
)"
printf 'JIG_ANDROID_CI_CERT_SHA256=%s\n' "$CERT_SHA256"
printf 'JIG_ANDROID_CI_KEYSTORE=%s\n' "$OUTPUT"
