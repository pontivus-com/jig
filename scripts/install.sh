#!/usr/bin/env bash
set -euo pipefail

BUN_VERSION="1.4.4"
DEFAULT_PORT="47831"

fail() {
  printf 'Jig installer: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  scripts/install.sh
  scripts/install.sh --repo /absolute/existing/repo [--port PORT]
  scripts/install.sh --repo-url URL --checkout /absolute/new/path [--port PORT]

With no repository arguments, Jig installs/updates the application and starts
the in-application setup flow. Existing configured installations keep their
current repository configuration. --repo and --repo-url/--checkout remain
noninteractive automation modes. --port is valid only with an immediate
repository mode.
EOF
}

[[ "$(uname -s)" == "Linux" ]] || fail "Jig v1 installer supports Linux only."
command -v git >/dev/null 2>&1 || fail "Git is required."

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$SOURCE_ROOT/package.json" ]] || fail "Run the installer from the Jig source distribution."
[[ -f "$SOURCE_ROOT/bun.lock" ]] || fail "The pinned bun.lock is missing; refusing a non-reproducible install."

REPO_PATH=""
REPO_URL=""
CHECKOUT_PATH=""
PORT="$DEFAULT_PORT"
PORT_SPECIFIED="false"

while (($# > 0)); do
  case "$1" in
    --repo)
      (($# >= 2)) || fail "--repo requires a value."
      REPO_PATH="$2"
      shift 2
      ;;
    --repo-url)
      (($# >= 2)) || fail "--repo-url requires a value."
      REPO_URL="$2"
      shift 2
      ;;
    --checkout)
      (($# >= 2)) || fail "--checkout requires a value."
      CHECKOUT_PATH="$2"
      shift 2
      ;;
    --port)
      (($# >= 2)) || fail "--port requires a value."
      PORT="$2"
      PORT_SPECIFIED="true"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

if [[ -n "$REPO_PATH" && ( -n "$REPO_URL" || -n "$CHECKOUT_PATH" ) ]]; then
  fail "--repo cannot be combined with --repo-url or --checkout."
fi
if [[ -n "$REPO_URL" && -z "$CHECKOUT_PATH" ]]; then
  fail "--repo-url requires --checkout."
fi
if [[ -n "$CHECKOUT_PATH" && -z "$REPO_URL" ]]; then
  fail "--checkout requires --repo-url."
fi

INSTALL_MODE="bootstrap"
if [[ -n "$REPO_PATH" || -n "$REPO_URL" ]]; then
  INSTALL_MODE="immediate"
fi
if [[ "$INSTALL_MODE" == "bootstrap" && "$PORT_SPECIFIED" == "true" ]]; then
  fail "--port requires --repo or --repo-url/--checkout; bootstrap mode uses port ${DEFAULT_PORT}."
fi

if [[ "$INSTALL_MODE" == "immediate" ]]; then
  [[ "$PORT" =~ ^[0-9]+$ ]] || fail "--port must be an integer."
  ((PORT >= 1024 && PORT <= 65535)) || fail "--port must be between 1024 and 65535."
fi

TARGET_REPO=""
if [[ -n "$REPO_PATH" ]]; then
  [[ "$REPO_PATH" = /* ]] || fail "--repo must be an absolute path."
  TARGET_REPO="$REPO_PATH"
elif [[ -n "$REPO_URL" ]]; then
  [[ "$CHECKOUT_PATH" = /* ]] || fail "--checkout must be an absolute path."
  TARGET_REPO="$CHECKOUT_PATH"

  if [[ -e "$CHECKOUT_PATH" ]]; then
    [[ -d "$CHECKOUT_PATH" ]] || fail "--checkout exists and is not a directory."
    if find "$CHECKOUT_PATH" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
      fail "--checkout must be new or empty; existing content will not be overwritten."
    fi
  else
    PARENT="$(dirname "$CHECKOUT_PATH")"
    [[ -d "$PARENT" && -w "$PARENT" ]] || fail "Checkout parent must exist and be writable."
  fi

  printf 'Cloning planning-data repository into %s\n' "$CHECKOUT_PATH"
  git clone -- "$REPO_URL" "$CHECKOUT_PATH"
fi

APP_DIR="$HOME/.local/share/jig"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/jig"
CONFIG_PATH="$CONFIG_DIR/config.json"
SYSTEMD_DIR="$HOME/.config/systemd/user"
UNIT_PATH="$SYSTEMD_DIR/jig.service"

BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-install.XXXXXX")"
cleanup() {
  rm -rf "$BUILD_ROOT"
}
trap cleanup EXIT INT TERM

BUN_BIN="$BUILD_ROOT/runtime/bun"
mkdir -p "$(dirname "$BUN_BIN")"

PACKAGED_RUNTIME="$SOURCE_ROOT/runtime/bun"
if [[ -x "$PACKAGED_RUNTIME" ]]; then
  cp "$PACKAGED_RUNTIME" "$BUN_BIN"
elif command -v bun >/dev/null 2>&1 && [[ "$(bun --version 2>/dev/null || true)" == "$BUN_VERSION" ]]; then
  cp "$(command -v bun)" "$BUN_BIN"
else
  command -v curl >/dev/null 2>&1 || fail "curl is required to install the pinned Bun runtime."
  command -v unzip >/dev/null 2>&1 || fail "unzip is required to install the pinned Bun runtime."

  case "$(uname -m)" in
    x86_64|amd64)
      BUN_ARCHIVE="bun-linux-x64.zip"
      BUN_DIRECTORY="bun-linux-x64"
      ;;
    aarch64|arm64)
      BUN_ARCHIVE="bun-linux-aarch64.zip"
      BUN_DIRECTORY="bun-linux-aarch64"
      ;;
    *)
      fail "Unsupported CPU architecture for the pinned Bun runtime: $(uname -m)"
      ;;
  esac

  BUN_URL="https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ARCHIVE}"
  curl --fail --location --proto '=https' --tlsv1.2 "$BUN_URL" -o "$BUILD_ROOT/bun.zip"
  unzip -q "$BUILD_ROOT/bun.zip" -d "$BUILD_ROOT/bun-unpacked"
  cp "$BUILD_ROOT/bun-unpacked/$BUN_DIRECTORY/bun" "$BUN_BIN"
fi
chmod 0755 "$BUN_BIN"
[[ "$("$BUN_BIN" --version)" == "$BUN_VERSION" ]] || fail "Pinned Bun runtime verification failed."

if [[ -f "$SOURCE_ROOT/RELEASE.json" && -f "$SOURCE_ROOT/dist/index.html" ]]; then
  BUILD_APP="$SOURCE_ROOT"
  printf 'Using certified prebuilt Jig release payload\n'
else
  BUILD_APP="$BUILD_ROOT/app"
  mkdir -p "$BUILD_APP"
  cp "$SOURCE_ROOT/package.json" "$BUILD_APP/"
  cp "$SOURCE_ROOT/bun.lock" "$BUILD_APP/"
  cp "$SOURCE_ROOT/.bun-version" "$BUILD_APP/"
  cp "$SOURCE_ROOT/tsconfig.json" "$BUILD_APP/"
  cp "$SOURCE_ROOT/vite.config.ts" "$BUILD_APP/"
  cp "$SOURCE_ROOT/index.html" "$BUILD_APP/"
  cp -R "$SOURCE_ROOT/src" "$BUILD_APP/"
  cp -R "$SOURCE_ROOT/ui" "$BUILD_APP/"
  cp -R "$SOURCE_ROOT/assets" "$BUILD_APP/"
  if [[ -d "$SOURCE_ROOT/public" ]]; then
    cp -R "$SOURCE_ROOT/public" "$BUILD_APP/"
  fi

  printf 'Installing frozen dependencies and building Jig assets\n'
  (
    cd "$BUILD_APP"
    "$BUN_BIN" install --frozen-lockfile
    "$BUN_BIN" run typecheck
    "$BUN_BIN" run build
  )
fi

if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  systemctl --user stop jig.service >/dev/null 2>&1 || true
fi

STAGED_CONFIG="$BUILD_ROOT/config.json"
RUNTIME_PORT="$DEFAULT_PORT"

if [[ "$INSTALL_MODE" == "immediate" ]]; then
  SETUP_ARGS=(--repo "$TARGET_REPO" --port "$PORT" --config "$STAGED_CONFIG")
  printf 'Preparing Jig planning data in %s\n' "$TARGET_REPO"
  (
    cd "$BUILD_APP"
    "$BUN_BIN" src/shell/setup.ts "${SETUP_ARGS[@]}"
  )
  RUNTIME_PORT="$PORT"
elif [[ -f "$CONFIG_PATH" ]]; then
  EXISTING_PORT="$(
    cd "$BUILD_APP"
    JIG_CONFIG_PATH="$CONFIG_PATH" "$BUN_BIN" -e '
      const { loadConfig } = await import("./src/shell/config.ts");
      const config = await loadConfig(process.env.JIG_CONFIG_PATH);
      process.stdout.write(String(config.http_port));
    '
  )"
  [[ "$EXISTING_PORT" =~ ^[0-9]+$ ]] || fail "Existing Jig configuration has an invalid HTTP port."
  RUNTIME_PORT="$EXISTING_PORT"
  INSTALL_MODE="preserve"
else
  printf 'Installing Jig in first-run bootstrap mode on port %s\n' "$DEFAULT_PORT"
fi

STAGED_APP="${APP_DIR}.next.$$"
BACKUP_APP="${APP_DIR}.previous.$$"
rm -rf "$STAGED_APP" "$BACKUP_APP"
mkdir -p "$STAGED_APP/runtime"
cp "$BUN_BIN" "$STAGED_APP/runtime/bun"
chmod 0755 "$STAGED_APP/runtime/bun"
cp -R "$BUILD_APP/src" "$STAGED_APP/"
cp -R "$BUILD_APP/dist" "$STAGED_APP/"
cp "$BUILD_APP/package.json" "$STAGED_APP/"
cp "$BUILD_APP/bun.lock" "$STAGED_APP/"
cp "$BUILD_APP/.bun-version" "$STAGED_APP/"
if [[ -f "$BUILD_APP/RELEASE.json" ]]; then
  cp "$BUILD_APP/RELEASE.json" "$STAGED_APP/"
fi

mkdir -p "$(dirname "$APP_DIR")"
if [[ -e "$APP_DIR" ]]; then
  mv "$APP_DIR" "$BACKUP_APP"
fi
if ! mv "$STAGED_APP" "$APP_DIR"; then
  if [[ -e "$BACKUP_APP" ]]; then
    mv "$BACKUP_APP" "$APP_DIR"
  fi
  fail "Unable to atomically install Jig application files."
fi
rm -rf "$BACKUP_APP"

mkdir -p "$BIN_DIR"
LAUNCHER_TMP="$BIN_DIR/.jig.tmp.$$"
cp "$SOURCE_ROOT/scripts/jig" "$LAUNCHER_TMP"
chmod 0755 "$LAUNCHER_TMP"
mv "$LAUNCHER_TMP" "$BIN_DIR/jig"

if [[ "$INSTALL_MODE" == "immediate" ]]; then
  mkdir -p "$CONFIG_DIR"
  CONFIG_TMP="$CONFIG_PATH.tmp.$"
  cp "$STAGED_CONFIG" "$CONFIG_TMP"
  chmod 0600 "$CONFIG_TMP"
  mv "$CONFIG_TMP" "$CONFIG_PATH"
fi

SERVICE_AVAILABLE="false"
if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  mkdir -p "$SYSTEMD_DIR"
  cat > "$UNIT_PATH" <<EOF
[Unit]
Description=Jig local planner
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/runtime/bun $APP_DIR/src/shell/main.ts
Restart=on-failure
RestartSec=1

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now jig.service
  SERVICE_AVAILABLE="true"
fi

READY="false"
if [[ "$SERVICE_AVAILABLE" == "true" ]]; then
  for _ in $(seq 1 40); do
    if "$APP_DIR/runtime/bun" -e       "try { const r = await fetch('http://127.0.0.1:${RUNTIME_PORT}/api/v1/setup/status'); if (!r.ok) process.exit(1); } catch { process.exit(1); }"       >/dev/null 2>&1; then
      READY="true"
      break
    fi
    sleep 0.05
  done
  [[ "$READY" == "true" ]] || fail "Jig user service did not become HTTP-ready within 2 seconds."
else
  printf 'systemd --user is unavailable; verifying the foreground fallback.\n'
  "$APP_DIR/runtime/bun" "$APP_DIR/src/shell/main.ts" >"$BUILD_ROOT/foreground.log" 2>&1 &
  FALLBACK_PID=$!
  for _ in $(seq 1 40); do
    if "$APP_DIR/runtime/bun" -e       "try { const r = await fetch('http://127.0.0.1:${RUNTIME_PORT}/api/v1/setup/status'); if (!r.ok) process.exit(1); } catch { process.exit(1); }"       >/dev/null 2>&1; then
      READY="true"
      break
    fi
    sleep 0.05
  done
  kill -TERM "$FALLBACK_PID" >/dev/null 2>&1 || true
  wait "$FALLBACK_PID" >/dev/null 2>&1 || true
  [[ "$READY" == "true" ]] || {
    cat "$BUILD_ROOT/foreground.log" >&2 || true
    fail "Jig foreground service did not become HTTP-ready within 2 seconds."
  }
fi

if [[ "$INSTALL_MODE" == "immediate" ]]; then
  [[ -f "$TARGET_REPO/.jig/local/jig.sqlite" ]] || fail "SQLite initialization verification failed."
fi

printf '\nJig installed successfully.\n'
printf 'Application: %s\n' "$APP_DIR"
printf 'Launcher: %s\n' "$BIN_DIR/jig"
if [[ "$INSTALL_MODE" == "immediate" ]]; then
  printf 'Configuration: %s\n' "$CONFIG_PATH"
  printf 'SQLite: %s/.jig/local/jig.sqlite\n' "$TARGET_REPO"
  printf 'Planning repository: %s\n' "$TARGET_REPO"
  printf 'Repository synchronization: managed automatically from the selected repository Git configuration\n'
elif [[ "$INSTALL_MODE" == "preserve" ]]; then
  printf 'Configuration: %s (preserved)\n' "$CONFIG_PATH"
  printf 'Repository setup: existing configuration preserved\n'
else
  printf 'Repository setup: open http://127.0.0.1:%s/ or run "jig"\n' "$RUNTIME_PORT"
fi
if [[ "$SERVICE_AVAILABLE" == "true" ]]; then
  printf 'Service: %s (systemd --user, enabled and started)\n' "$UNIT_PATH"
else
  printf 'Service: background user service unavailable; run "jig serve" as the foreground fallback.\n'
fi
printf 'No systemd linger policy was changed.\n'
