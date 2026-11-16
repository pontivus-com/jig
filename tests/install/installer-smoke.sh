#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/jig-installer-smoke.XXXXXX")"
cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

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
git -C "$DATA_REPO" config commit.gpgSign true
git -C "$DATA_REPO" config gpg.format ssh
git -C "$DATA_REPO" config user.signingkey missing-jig-installer-key

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$DATA_REPO" --port 47931 >/dev/null

[[ -x "$HOME/.local/bin/jig" ]]
[[ -x "$HOME/.local/share/jig/runtime/bun" ]]
[[ -f "$HOME/.config/jig/config.json" ]]
[[ -f "$DATA_REPO/.jig/local/jig.sqlite" ]]
[[ "$(cat "$DATA_REPO/user.txt")" == "preserve me" ]]
[[ -z "$(git -C "$DATA_REPO" status --porcelain=v1)" ]]
[[ "$(git -C "$DATA_REPO" config --get commit.gpgSign)" == "true" ]]
[[ "$(git -C "$DATA_REPO" config --get gpg.format)" == "ssh" ]]
[[ "$(git -C "$DATA_REPO" config --get user.signingkey)" == "missing-jig-installer-key" ]]

"$HOME/.local/bin/jig" status | grep -q '^repository: '
"$HOME/.local/bin/jig" doctor | grep -q '^service_healthy: false$'

# Reinstallation is idempotent and must preserve the same dataset.
FIRST_DATASET="$("$HOME/.local/share/jig/runtime/bun" -e   "const c=JSON.parse(await Bun.file('$HOME/.config/jig/config.json').text()); const db=new (await import('bun:sqlite')).Database(c.repository_path+'/.jig/local/jig.sqlite'); console.log(db.query('select dataset_id from app_metadata where singleton=1').get().dataset_id); db.close();")"
bash "$SOURCE_ROOT/scripts/install.sh" --repo "$DATA_REPO" --port 47931 >/dev/null
SECOND_DATASET="$("$HOME/.local/share/jig/runtime/bun" -e   "const c=JSON.parse(await Bun.file('$HOME/.config/jig/config.json').text()); const db=new (await import('bun:sqlite')).Database(c.repository_path+'/.jig/local/jig.sqlite'); console.log(db.query('select dataset_id from app_metadata where singleton=1').get().dataset_id); db.close();")"
[[ "$FIRST_DATASET" == "$SECOND_DATASET" ]]

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

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$OFFLINE_REPO" --port 47934 >/dev/null
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

bash "$SOURCE_ROOT/scripts/install.sh" --repo "$LEGACY_REPO" --port 47935 >/dev/null
bash "$SOURCE_ROOT/scripts/install.sh" --repo "$LEGACY_REPO" --port 47935 >/dev/null
[[ -f "$LEGACY_REPO/.jig/local/jig.sqlite" ]]
[[ "$(cat "$LEGACY_REPO/legacy.txt")" == "legacy" ]]

# Clone mode refuses to overwrite and successfully configures a new checkout.
SEED="$TMP_ROOT/seed"
REMOTE="$TMP_ROOT/remote.git"
CLONE="$TMP_ROOT/cloned-data"
mkdir -p "$SEED"
git -C "$SEED" init >/dev/null
git -C "$SEED" config user.name "Jig Installer Test"
git -C "$SEED" config user.email "jig-installer@local.invalid"
printf 'remote seed\n' > "$SEED/seed.txt"
git -C "$SEED" add seed.txt
git -C "$SEED" commit -m "Seed" >/dev/null
git init --bare "$REMOTE" >/dev/null
git -C "$SEED" remote add origin "$REMOTE"
git -C "$SEED" push origin HEAD:master >/dev/null
git --git-dir="$REMOTE" symbolic-ref HEAD refs/heads/master

bash "$SOURCE_ROOT/scripts/install.sh"   --repo-url "$REMOTE"   --checkout "$CLONE"   --port 47932   >/dev/null

[[ -f "$CLONE/seed.txt" ]]
[[ -f "$CLONE/.jig/local/jig.sqlite" ]]

printf 'do not overwrite\n' > "$TMP_ROOT/nonempty"
if bash "$SOURCE_ROOT/scripts/install.sh"   --repo-url "$REMOTE"   --checkout "$TMP_ROOT"   --port 47933   >/dev/null 2>&1; then
  printf 'installer unexpectedly accepted a non-empty checkout destination\n' >&2
  exit 1
fi

"$HOME/.local/bin/jig" uninstall >/dev/null
[[ ! -e "$HOME/.local/share/jig" ]]
[[ ! -e "$HOME/.config/jig" ]]
[[ -d "$CLONE/.jig" ]]
