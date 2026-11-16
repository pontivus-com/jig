#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-resource-cert.XXXXXX")"
PORT="${JIG_CERT_PORT:-47941}"
WARMUP_SECONDS="${JIG_CERT_WARMUP_SECONDS:-60}"
IDLE_SECONDS="${JIG_CERT_IDLE_SECONDS:-300}"
SAMPLE_SECONDS=1
RSS_LIMIT_KIB=$((128 * 1024))
CPU_LIMIT_PERCENT="1.0"
LAUNCH_LIMIT_MS="500"

service_pid=""

cleanup() {
  if [[ -n "$service_pid" ]]; then
    kill "$service_pid" 2>/dev/null || true
    wait "$service_pid" 2>/dev/null || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'resource certification requires %s\n' "$1" >&2
    exit 1
  }
}

require bun
require git
require curl
require awk
require getconf
require date

HOME_DIR="$TMP_ROOT/home"
DATA_REPO="$TMP_ROOT/data"
APP_DIR="$TMP_ROOT/app"
FAKE_BIN="$TMP_ROOT/bin"
mkdir -p "$HOME_DIR" "$DATA_REPO" "$APP_DIR/runtime" "$FAKE_BIN"

git -C "$DATA_REPO" init -q
git -C "$DATA_REPO" config user.name "Jig Resource Certification"
git -C "$DATA_REPO" config user.email "jig-resource@local.invalid"
printf 'reference-host fixture\n' > "$DATA_REPO/user.txt"
git -C "$DATA_REPO" add user.txt
git -C "$DATA_REPO" commit -qm "fixture baseline"

HOME="$HOME_DIR" bun "$SOURCE_ROOT/src/shell/setup.ts"   --repo "$DATA_REPO"   --port "$PORT" >/dev/null

HOME="$HOME_DIR" bun "$SOURCE_ROOT/src/shell/main.ts" >"$TMP_ROOT/service.stdout" 2>"$TMP_ROOT/service.stderr" &
service_pid=$!

wait_ready() {
  local deadline=$(( $(date +%s%3N) + 2000 ))
  while (( $(date +%s%3N) < deadline )); do
    if curl -fsS "http://127.0.0.1:$PORT/api/v1/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.02
  done
  return 1
}

wait_ready || {
  cat "$TMP_ROOT/service.stderr" >&2
  printf 'service failed to become ready within 2 seconds\n' >&2
  exit 1
}

# Warm the HTTP and static application paths, then honor the canonical
# 60-second service warm-up before the five-minute idle measurement.
curl -fsS "http://127.0.0.1:$PORT/api/v1/status" >/dev/null
curl -fsS "http://127.0.0.1:$PORT/" >/dev/null
sleep "$WARMUP_SECONDS"

clk_tck="$(getconf CLK_TCK)"
read -r _ _ _ _ _ _ _ _ _ _ _ _ _ cpu_start_utime cpu_start_stime _ < "/proc/$service_pid/stat"
cpu_start=$((cpu_start_utime + cpu_start_stime))
max_rss_kib=0
samples=0
started_epoch="$(date +%s)"

while (( $(date +%s) - started_epoch < IDLE_SECONDS )); do
  rss_kib="$(awk '/^VmRSS:/ {print $2}' "/proc/$service_pid/status")"
  [[ "$rss_kib" =~ ^[0-9]+$ ]] || {
    printf 'unable to read service RSS\n' >&2
    exit 1
  }
  (( rss_kib > max_rss_kib )) && max_rss_kib="$rss_kib"
  samples=$((samples + 1))
  sleep "$SAMPLE_SECONDS"
done

read -r _ _ _ _ _ _ _ _ _ _ _ _ _ cpu_end_utime cpu_end_stime _ < "/proc/$service_pid/stat"
cpu_end=$((cpu_end_utime + cpu_end_stime))
cpu_ticks=$((cpu_end - cpu_start))
cpu_percent="$(awk -v ticks="$cpu_ticks" -v hz="$clk_tck" -v seconds="$IDLE_SECONDS" 'BEGIN { printf "%.4f", (ticks / hz / seconds) * 100 }')"

if (( max_rss_kib > RSS_LIMIT_KIB )); then
  printf 'RSS gate failed: %s KiB > %s KiB\n' "$max_rss_kib" "$RSS_LIMIT_KIB" >&2
  exit 1
fi
if ! awk -v actual="$cpu_percent" -v limit="$CPU_LIMIT_PERCENT" 'BEGIN { exit !(actual <= limit) }'; then
  printf 'CPU gate failed: %s%% > %s%% of one core\n' "$cpu_percent" "$CPU_LIMIT_PERCENT" >&2
  exit 1
fi

# Measure the real launcher handoff while the service is already ready. A fake
# desktop opener isolates the launcher handoff from desktop application startup.
ln -s "$(command -v bun)" "$APP_DIR/runtime/bun"
ln -s "$SOURCE_ROOT/src" "$APP_DIR/src"
cat > "$FAKE_BIN/xdg-open" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod 0755 "$FAKE_BIN/xdg-open"

launch_samples="$TMP_ROOT/launcher-ms.txt"
: > "$launch_samples"
for _ in $(seq 1 20); do
  start_ns="$(date +%s%N)"
  HOME="$HOME_DIR" JIG_APP_DIR="$APP_DIR" PATH="$FAKE_BIN:$PATH"     bash "$SOURCE_ROOT/scripts/jig" >/dev/null
  end_ns="$(date +%s%N)"
  echo $(( (end_ns - start_ns) / 1000000 )) >> "$launch_samples"
done
launcher_p95_ms="$(sort -n "$launch_samples" | sed -n '19p')"
if (( launcher_p95_ms > LAUNCH_LIMIT_MS )); then
  printf 'launcher p95 gate failed: %s ms > %s ms\n' "$launcher_p95_ms" "$LAUNCH_LIMIT_MS" >&2
  exit 1
fi

host="$(uname -srvmo)"
bun_version="$(bun --version)"
git_version="$(git --version)"

printf 'host: %s\n' "$host"
printf 'bun: %s\n' "$bun_version"
printf 'git: %s\n' "$git_version"
printf 'warmup_seconds: %s\n' "$WARMUP_SECONDS"
printf 'idle_window_seconds: %s\n' "$IDLE_SECONDS"
printf 'idle_samples: %s\n' "$samples"
printf 'max_rss_kib: %s\n' "$max_rss_kib"
printf 'one_core_cpu_average_percent: %s\n' "$cpu_percent"
printf 'running_launcher_p95_ms_20: %s\n' "$launcher_p95_ms"

# Stopped-service readiness is intentionally not emulated. It must be measured
# with the installed systemd --user unit on the reference Linux host.
if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  printf 'stopped_service_readiness: requires installed-service certification command\n'
else
  printf 'stopped_service_readiness: unavailable (systemd --user not present on this host)\n'
fi
