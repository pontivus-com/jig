#!/usr/bin/env bash
set -euo pipefail

readonly SAMPLES=20
readonly READY_LIMIT_MS=2000

command -v systemctl >/dev/null 2>&1 || {
  printf 'installed readiness certification requires systemctl\n' >&2
  exit 1
}
systemctl --user show-environment >/dev/null 2>&1 || {
  printf 'installed readiness certification requires an active systemd --user manager\n' >&2
  exit 1
}
command -v jig >/dev/null 2>&1 || {
  printf 'installed readiness certification requires the installed jig launcher on PATH\n' >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  printf 'installed readiness certification requires curl\n' >&2
  exit 1
}

config_path="$HOME/.config/jig/config.json"
[[ -f "$config_path" ]] || {
  printf 'Jig configuration is not installed at %s\n' "$config_path" >&2
  exit 1
}

port="$(bun -e 'const c=JSON.parse(await Bun.file(process.argv[1]).text()); console.log(c.http_port)' "$config_path")"
[[ "$port" =~ ^[0-9]+$ ]] || {
  printf 'invalid configured Jig HTTP port\n' >&2
  exit 1
}

samples="$(mktemp "${TMPDIR:-/tmp}/jig-readiness.XXXXXX")"
cleanup() {
  rm -f "$samples"
}
trap cleanup EXIT INT TERM
: > "$samples"

for _ in $(seq 1 "$SAMPLES"); do
  systemctl --user stop jig.service
  while curl -fsS "http://127.0.0.1:$port/api/v1/status" >/dev/null 2>&1; do
    sleep 0.02
  done

  start_ns="$(date +%s%N)"
  systemctl --user start jig.service

  ready=0
  deadline_ms=$(( $(date +%s%3N) + READY_LIMIT_MS ))
  while (( $(date +%s%3N) <= deadline_ms )); do
    if curl -fsS "http://127.0.0.1:$port/api/v1/status" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.02
  done
  end_ns="$(date +%s%N)"

  (( ready == 1 )) || {
    printf 'service failed to become HTTP-ready within %s ms\n' "$READY_LIMIT_MS" >&2
    exit 1
  }

  echo $(( (end_ns - start_ns) / 1000000 )) >> "$samples"
done

p95_ms="$(sort -n "$samples" | sed -n '19p')"
if (( p95_ms > READY_LIMIT_MS )); then
  printf 'stopped-service readiness p95 failed: %s ms > %s ms\n' "$p95_ms" "$READY_LIMIT_MS" >&2
  exit 1
fi

printf 'host: %s\n' "$(uname -srvmo)"
printf 'bun: %s\n' "$(bun --version)"
printf 'systemd: %s\n' "$(systemctl --version | head -n1)"
printf 'stopped_service_http_readiness_p95_ms_20: %s\n' "$p95_ms"
