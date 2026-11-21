#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 3 ]]; then
  printf 'usage: %s <extracted-jig-root> <scratch-root> <configured-port>\n' "$0" >&2
  exit 2
fi

JIG_ROOT="$(cd "$1" && pwd)"
SCRATCH_ROOT="$2"
CONFIGURED_PORT="$3"
FAKE_BIN="$SCRATCH_ROOT/bin"

rm -rf "$SCRATCH_ROOT"
mkdir -p "$FAKE_BIN"

cat > "$FAKE_BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod 0755 "$FAKE_BIN/systemctl"

configured_home="$SCRATCH_ROOT/configured-home"
configured_repo="$SCRATCH_ROOT/configured-repo"
mkdir -p "$configured_home" "$configured_repo"
git -C "$configured_repo" init -q
git -C "$configured_repo" config user.name "Jig Release"
git -C "$configured_repo" config user.email "release@example.invalid"

PATH="$FAKE_BIN:$PATH" HOME="$configured_home"   "$JIG_ROOT/scripts/install.sh"   --repo "$configured_repo" --port "$CONFIGURED_PORT"

PATH="$FAKE_BIN:$PATH" HOME="$configured_home"   "$configured_home/.local/bin/jig" status   | grep -Fq "repository: $configured_repo"

PATH="$FAKE_BIN:$PATH" HOME="$configured_home"   "$configured_home/.local/bin/jig" uninstall

[[ ! -e "$configured_home/.local/share/jig" ]]
[[ ! -e "$configured_home/.config/jig" ]]

bootstrap_home="$SCRATCH_ROOT/bootstrap-home"
mkdir -p "$bootstrap_home"

PATH="$FAKE_BIN:$PATH" HOME="$bootstrap_home"   "$JIG_ROOT/scripts/install.sh"

PATH="$FAKE_BIN:$PATH" HOME="$bootstrap_home"   "$bootstrap_home/.local/bin/jig" status   | grep -q '^setup: repository required$'

PATH="$FAKE_BIN:$PATH" HOME="$bootstrap_home"   "$bootstrap_home/.local/bin/jig" serve   >"$SCRATCH_ROOT/bootstrap.log" 2>&1 &
bootstrap_pid=$!

cleanup_service() {
  kill -TERM "$bootstrap_pid" >/dev/null 2>&1 || true
  wait "$bootstrap_pid" >/dev/null 2>&1 || true
}
trap cleanup_service EXIT INT TERM

ready=false
for _ in $(seq 1 80); do
  if HOME="$bootstrap_home"     "$bootstrap_home/.local/share/jig/runtime/bun" -e     "const r=await fetch('http://127.0.0.1:47831/api/v1/setup/status'); const j=await r.json(); if(!r.ok||j.mode!=='bootstrap') process.exit(1);"     >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.05
done

[[ "$ready" == "true" ]]

cleanup_service
trap - EXIT INT TERM

PATH="$FAKE_BIN:$PATH" HOME="$bootstrap_home"   "$bootstrap_home/.local/bin/jig" uninstall

[[ ! -e "$bootstrap_home/.local/share/jig" ]]
[[ ! -e "$bootstrap_home/.config/jig" ]]
