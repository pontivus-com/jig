#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-installer-smoke.XXXXXX")"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

declare -a TEST_PORTS=()
allocate_test_port() {
  local variable_name="$1"
  local candidate=""
  local used=""
  while true; do
    candidate="$(
      bun -e '
        const server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch() {
            return new Response("ok");
          },
        });
        process.stdout.write(String(server.port));
        server.stop(true);
      '
    )"
    [[ "$candidate" =~ ^[0-9]+$ ]] || continue
    used="false"
    for existing in "${TEST_PORTS[@]}"; do
      if [[ "$existing" == "$candidate" ]]; then
        used="true"
        break
      fi
    done
    if [[ "$used" == "false" ]]; then
      TEST_PORTS+=("$candidate")
      printf -v "$variable_name" '%s' "$candidate"
      return
    fi
  done
}

allocate_test_port DATA_PORT
allocate_test_port CLONE_PORT
allocate_test_port NONEMPTY_PORT
allocate_test_port OFFLINE_PORT
allocate_test_port LEGACY_PORT
allocate_test_port MALFORMED_PORT

TEST_HOME="$TMP_ROOT/home"
DATA_REPO="$TMP_ROOT/data"
FAKE_BIN="$TMP_ROOT/bin"
mkdir -p "$TEST_HOME" "$DATA_REPO" "$FAKE_BIN"

cat > "$FAKE_BIN/systemctl" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod 0755 "$FAKE_BIN/systemctl"
export PATH="$FAKE_BIN:$PATH"
export HOME="$TEST_HOME"

git -C "$DATA_REPO" init >/dev/null
git -C "$DATA_REPO" config user.name "Jig Installer Test"
git -C "$DATA_REPO" config user.email "jig-installer@local.invalid"
printf 'preserve me\n' > "$DATA_REPO/user.txt"
git -C "$DATA_REPO" add user.txt
git -C "$DATA_REPO" commit -m "User data" >/dev/null
printf 'staged user change\n' > "$DATA_REPO/user.txt"
git -C "$DATA_REPO" add user.txt
printf 'working user change\n' > "$DATA_REPO/user.txt"
printf 'untracked user file\n' > "$DATA_REPO/untracked.txt"
BEFORE_USER_STATUS="$(git -C "$DATA_REPO" status --porcelain=v1)"
git -C "$DATA_REPO" config commit.gpgSign true
git -C "$DATA_REPO" config gpg.format ssh
git -C "$DATA_REPO" config user.signingkey missing-jig-installer-key

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$DATA_REPO" --port "$DATA_PORT" >/dev/null

[[ -x "$HOME/.local/bin/jig" ]]
[[ -x "$HOME/.local/share/jig/runtime/bun" ]]
[[ -f "$HOME/.config/jig/config.json" ]]
[[ -f "$DATA_REPO/.jig/local/jig.sqlite" ]]
[[ "$(cat "$DATA_REPO/user.txt")" == "working user change" ]]
[[ "$(cat "$DATA_REPO/untracked.txt")" == "untracked user file" ]]
[[ "$(git -C "$DATA_REPO" status --porcelain=v1)" == "$BEFORE_USER_STATUS" ]]
[[ "$(git -C "$DATA_REPO" config --get commit.gpgSign)" == "true" ]]
[[ "$(git -C "$DATA_REPO" config --get gpg.format)" == "ssh" ]]
[[ "$(git -C "$DATA_REPO" config --get user.signingkey)" == "missing-jig-installer-key" ]]

"$HOME/.local/bin/jig" status | grep -q '^repository: '
"$HOME/.local/bin/jig" doctor | grep -q '^service_healthy: false$'

# Reinstallation is idempotent and must preserve the same dataset and local state.
printf 'preserve local state\n' > "$DATA_REPO/.jig/local/reinstall-sentinel"
CONFIG_BEFORE_REINSTALL="$(cat "$HOME/.config/jig/config.json")"
FIRST_DATASET="$("$HOME/.local/share/jig/runtime/bun" -e   "const c=JSON.parse(await Bun.file('$HOME/.config/jig/config.json').text()); const db=new (await import('bun:sqlite')).Database(c.repository_path+'/.jig/local/jig.sqlite'); console.log(db.query('select dataset_id from app_metadata where singleton=1').get().dataset_id); db.close();")"
bash "$SOURCE_ROOT/scripts/install.sh" --repo "$DATA_REPO" --port "$DATA_PORT" >/dev/null
SECOND_DATASET="$("$HOME/.local/share/jig/runtime/bun" -e   "const c=JSON.parse(await Bun.file('$HOME/.config/jig/config.json').text()); const db=new (await import('bun:sqlite')).Database(c.repository_path+'/.jig/local/jig.sqlite'); console.log(db.query('select dataset_id from app_metadata where singleton=1').get().dataset_id); db.close();")"
[[ "$FIRST_DATASET" == "$SECOND_DATASET" ]]
[[ "$(cat "$DATA_REPO/.jig/local/reinstall-sentinel")" == "preserve local state" ]]
[[ "$(cat "$HOME/.config/jig/config.json")" == "$CONFIG_BEFORE_REINSTALL" ]]

# A configured but unavailable remote must not prevent local installation.
OFFLINE_REPO="$TMP_ROOT/offline"
mkdir -p "$OFFLINE_REPO"
git -C "$OFFLINE_REPO" init >/dev/null
git -C "$OFFLINE_REPO" config user.name "Jig Installer Test"
git -C "$OFFLINE_REPO" config user.email "jig-installer@local.invalid"
printf 'offline\n' > "$OFFLINE_REPO/offline.txt"
git -C "$OFFLINE_REPO" add offline.txt
git -C "$OFFLINE_REPO" commit -m "Offline baseline" >/dev/null
git -C "$OFFLINE_REPO" remote add origin "$TMP_ROOT/does-not-exist.git"

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$OFFLINE_REPO" --port "$OFFLINE_PORT" >/dev/null
[[ -f "$OFFLINE_REPO/.jig/local/jig.sqlite" ]]
[[ "$(cat "$OFFLINE_REPO/offline.txt")" == "offline" ]]

# Recover the exact v1.0.0 empty-bootstrap residue and remain rerunnable.
LEGACY_REPO="$TMP_ROOT/legacy"
mkdir -p "$LEGACY_REPO"
git -C "$LEGACY_REPO" init >/dev/null
git -C "$LEGACY_REPO" config user.name "Jig Installer Test"
git -C "$LEGACY_REPO" config user.email "jig-installer@local.invalid"
printf 'legacy\n' > "$LEGACY_REPO/legacy.txt"
git -C "$LEGACY_REPO" add legacy.txt
git -C "$LEGACY_REPO" commit -m "Legacy baseline" >/dev/null
EMPTY_TREE="$(git -C "$LEGACY_REPO" mktree </dev/null)"
LEGACY_HEAD="$(
  GIT_AUTHOR_NAME=Jig \
  GIT_AUTHOR_EMAIL=jig@local.invalid \
  GIT_COMMITTER_NAME=Jig \
  GIT_COMMITTER_EMAIL=jig@local.invalid \
  git -C "$LEGACY_REPO" commit-tree "$EMPTY_TREE" -m "Initialize Jig data"
)"
git -C "$LEGACY_REPO" update-ref refs/heads/jig-data "$LEGACY_HEAD"

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$LEGACY_REPO" --port "$LEGACY_PORT" >/dev/null
bash "$SOURCE_ROOT/scripts/install.sh" --repo "$LEGACY_REPO" --port "$LEGACY_PORT" >/dev/null
[[ -f "$LEGACY_REPO/.jig/local/jig.sqlite" ]]
[[ "$(cat "$LEGACY_REPO/legacy.txt")" == "legacy" ]]

# Clone mode adopts existing Jig data and refuses to overwrite a non-empty target.
REMOTE="$TMP_ROOT/remote.git"
CLONE="$TMP_ROOT/cloned-data"
git init --bare "$REMOTE" >/dev/null
git -C "$DATA_REPO" remote add installer-smoke "$REMOTE"
git -C "$DATA_REPO" push installer-smoke HEAD:master >/dev/null
git -C "$DATA_REPO" push installer-smoke refs/heads/jig-data:refs/heads/jig-data >/dev/null
git --git-dir="$REMOTE" symbolic-ref HEAD refs/heads/master

bash "$SOURCE_ROOT/scripts/install.sh" \
  --repo-url "$REMOTE" \
  --checkout "$CLONE" \
  --port "$CLONE_PORT" \
  >/dev/null

[[ -f "$CLONE/user.txt" ]]
[[ -f "$CLONE/.jig/local/jig.sqlite" ]]
CLONE_DATASET="$("$HOME/.local/share/jig/runtime/bun" -e "const db=new (await import('bun:sqlite')).Database('$CLONE/.jig/local/jig.sqlite'); console.log(db.query('select dataset_id from app_metadata where singleton=1').get().dataset_id); db.close();")"
[[ "$CLONE_DATASET" == "$FIRST_DATASET" ]]

printf 'do not overwrite\n' > "$TMP_ROOT/nonempty"
if bash "$SOURCE_ROOT/scripts/install.sh"   --repo-url "$REMOTE"   --checkout "$TMP_ROOT"   --port "$NONEMPTY_PORT"   >/dev/null 2>&1; then
  printf 'installer unexpectedly accepted a non-empty checkout destination\n' >&2
  exit 1
fi

# Unknown malformed Jig data must fail without rewriting the repository state.
MALFORMED_REPO="$TMP_ROOT/malformed"
mkdir -p "$MALFORMED_REPO"
git -C "$MALFORMED_REPO" init >/dev/null
git -C "$MALFORMED_REPO" config user.name "Jig Installer Test"
git -C "$MALFORMED_REPO" config user.email "jig-installer@local.invalid"
printf 'malformed baseline\n' > "$MALFORMED_REPO/user.txt"
git -C "$MALFORMED_REPO" add user.txt
git -C "$MALFORMED_REPO" commit -m "Malformed baseline" >/dev/null
BAD_TREE="$(git -C "$MALFORMED_REPO" mktree </dev/null)"
BAD_HEAD="$(
  GIT_AUTHOR_NAME=Someone \
  GIT_AUTHOR_EMAIL=someone@example.invalid \
  GIT_COMMITTER_NAME=Someone \
  GIT_COMMITTER_EMAIL=someone@example.invalid \
  git -C "$MALFORMED_REPO" commit-tree "$BAD_TREE" -m "Not Jig data"
)"
git -C "$MALFORMED_REPO" update-ref refs/heads/jig-data "$BAD_HEAD"

if bash "$SOURCE_ROOT/scripts/install.sh" --repo "$MALFORMED_REPO" --port "$MALFORMED_PORT" >/dev/null 2>&1; then
  printf 'installer unexpectedly accepted malformed Jig portable data\n' >&2
  exit 1
fi
[[ "$(git -C "$MALFORMED_REPO" rev-parse refs/heads/jig-data)" == "$BAD_HEAD" ]]
[[ "$(cat "$MALFORMED_REPO/user.txt")" == "malformed baseline" ]]

# Fresh no-repository installation enters setup mode and can transition
# through the canonical local-repository setup API.
BOOTSTRAP_HOME="$TMP_ROOT/bootstrap-home"
BOOTSTRAP_REPO="$TMP_ROOT/bootstrap-repo"
mkdir -p "$BOOTSTRAP_HOME" "$BOOTSTRAP_REPO"
git -C "$BOOTSTRAP_REPO" init >/dev/null
git -C "$BOOTSTRAP_REPO" config user.name "Jig Bootstrap Test"
git -C "$BOOTSTRAP_REPO" config user.email "jig-bootstrap@local.invalid"
printf 'bootstrap\n' > "$BOOTSTRAP_REPO/user.txt"
git -C "$BOOTSTRAP_REPO" add user.txt
git -C "$BOOTSTRAP_REPO" commit -m "Bootstrap baseline" >/dev/null

(
  export HOME="$BOOTSTRAP_HOME"
  export PATH="$FAKE_BIN:$PATH"

  bash "$SOURCE_ROOT/scripts/install.sh" >/dev/null

  [[ -x "$HOME/.local/bin/jig" ]]
  [[ ! -e "$HOME/.config/jig/config.json" ]]

  "$HOME/.local/bin/jig" status | grep -q '^setup: repository required$'

  "$HOME/.local/bin/jig" serve >"$TMP_ROOT/bootstrap-service.log" 2>&1 &
  BOOTSTRAP_PID=$!
  cleanup_bootstrap_service() {
    kill -TERM "$BOOTSTRAP_PID" >/dev/null 2>&1 || true
    wait "$BOOTSTRAP_PID" >/dev/null 2>&1 || true
  }
  trap cleanup_bootstrap_service EXIT INT TERM

  for _ in $(seq 1 40); do
    if "$HOME/.local/share/jig/runtime/bun" -e       "const r=await fetch('http://127.0.0.1:47831/api/v1/setup/status'); const j=await r.json(); if(!r.ok||j.mode!=='bootstrap') process.exit(1);"       >/dev/null 2>&1; then
      break
    fi
    sleep 0.05
  done

  TOKEN="$(
    "$HOME/.local/share/jig/runtime/bun" -e       "const h=await (await fetch('http://127.0.0.1:47831/')).text(); const m=/window\\.__JIG_WRITE_TOKEN__=(\"[0-9a-f]{64}\");/.exec(h); if(!m) process.exit(1); process.stdout.write(JSON.parse(m[1]));"
  )"

  JIG_TOKEN="$TOKEN" JIG_REPO="$BOOTSTRAP_REPO"     "$HOME/.local/share/jig/runtime/bun" -e '
      const response = await fetch(
        "http://127.0.0.1:47831/api/v1/setup/local-repository",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jig-write-token": process.env.JIG_TOKEN,
          },
          body: JSON.stringify({
            repository_path: process.env.JIG_REPO,
          }),
        },
      );
      if (!response.ok) {
        console.error(await response.text());
        process.exit(1);
      }
    '

  CONFIGURED="false"
  for _ in $(seq 1 80); do
    if "$HOME/.local/share/jig/runtime/bun" -e       "const r=await fetch('http://127.0.0.1:47831/api/v1/setup/status'); const j=await r.json(); if(!r.ok||j.mode!=='configured') process.exit(1);"       >/dev/null 2>&1; then
      CONFIGURED="true"
      break
    fi
    sleep 0.05
  done
  [[ "$CONFIGURED" == "true" ]]

  [[ -f "$HOME/.config/jig/config.json" ]]
  [[ -f "$BOOTSTRAP_REPO/.jig/local/jig.sqlite" ]]
  "$HOME/.local/bin/jig" status | grep -q "^repository: $BOOTSTRAP_REPO$"

  cleanup_bootstrap_service
  trap - EXIT INT TERM
  "$HOME/.local/bin/jig" uninstall >/dev/null
  [[ ! -e "$HOME/.local/share/jig" ]]
  [[ ! -e "$HOME/.config/jig" ]]
)

# Existing configured installation remains idempotent and preserves config
# when the installer is rerun without repository arguments.
CONFIG_BEFORE="$(cat "$HOME/.config/jig/config.json")"
bash "$SOURCE_ROOT/scripts/install.sh" >/dev/null
[[ "$(cat "$HOME/.config/jig/config.json")" == "$CONFIG_BEFORE" ]]

"$HOME/.local/bin/jig" uninstall >/dev/null
[[ ! -e "$HOME/.local/share/jig" ]]
[[ ! -e "$HOME/.config/jig" ]]
[[ -d "$CLONE/.jig" ]]


