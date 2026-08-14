#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="${LMS_PM2_APP_NAME:-lms}"
APP_ROOT="${LMS_DEPLOY_ROOT:-/root/lms}"
BARE_REPO="${LMS_DEPLOY_REPO:-$APP_ROOT/deploy-repo.git}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
DEPLOY_LOG_DIR="$APP_ROOT/deploy-logs"
LOCK_FILE="/var/lock/lms-production-deploy.lock"
APP_PORT="${LMS_APP_PORT:-3005}"
SMOKE_PORT="${LMS_SMOKE_PORT:-3010}"
KEEP_RELEASES="${LMS_KEEP_RELEASES:-5}"
TARGET_REF="${1:-refs/remotes/origin/production}"

mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$DEPLOY_LOG_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Deployment lain sedang berjalan; lock $LOCK_FILE masih aktif." >&2
  exit 75
fi

if [[ ! -d "$BARE_REPO" ]]; then
  echo "Bare deployment repository tidak ditemukan: $BARE_REPO" >&2
  exit 2
fi

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "Runtime environment tidak ditemukan: $SHARED_DIR/.env" >&2
  exit 2
fi

git --git-dir="$BARE_REPO" fetch --prune origin \
  '+refs/heads/production:refs/remotes/origin/production'

PRODUCTION_SHA="$(git --git-dir="$BARE_REPO" rev-parse 'refs/remotes/origin/production^{commit}')"
TARGET_SHA="$(git --git-dir="$BARE_REPO" rev-parse "${TARGET_REF}^{commit}")"

if [[ "$TARGET_SHA" != "$PRODUCTION_SHA" ]]; then
  echo "Deploy ditolak: target $TARGET_SHA bukan HEAD origin/production $PRODUCTION_SHA." >&2
  exit 3
fi

if [[ -f "$SHARED_DIR/deployed-sha" ]] \
  && [[ "$(cat "$SHARED_DIR/deployed-sha")" == "$TARGET_SHA" ]] \
  && [[ -n "$(pm2 pid "$APP_NAME" 2>/dev/null || true)" ]]; then
  echo "Production sudah menjalankan $TARGET_SHA. Tidak ada perubahan."
  exit 0
fi

RELEASE_DIR="$RELEASES_DIR/$TARGET_SHA"
BUILD_LOG="$DEPLOY_LOG_DIR/build-$TARGET_SHA.log"
SMOKE_LOG="$DEPLOY_LOG_DIR/smoke-$TARGET_SHA.log"
CANDIDATE_PID=""

cleanup_candidate() {
  if [[ -n "$CANDIDATE_PID" ]] && kill -0 "$CANDIDATE_PID" 2>/dev/null; then
    kill "$CANDIDATE_PID" 2>/dev/null || true
    wait "$CANDIDATE_PID" 2>/dev/null || true
  fi
}
trap cleanup_candidate EXIT

if [[ ! -d "$RELEASE_DIR" ]]; then
  git --git-dir="$BARE_REPO" worktree add --detach "$RELEASE_DIR" "$TARGET_SHA"
fi

ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"

# Turbopack rejects project-directory symlinks that point outside the release
# root. Keep runtime directories absent while compiling, then attach them only
# after the build has completed.
for runtime_dir in .uploads baileys_auth_info .data; do
  rm -rf "$RELEASE_DIR/$runtime_dir"
done
rm -rf "$RELEASE_DIR/public/uploads"

(
  cd "$RELEASE_DIR"
  npm ci
  npm run build
) >"$BUILD_LOG" 2>&1

for runtime_dir in .uploads baileys_auth_info .data; do
  if [[ -d "$SHARED_DIR/$runtime_dir" ]]; then
    ln -s "$SHARED_DIR/$runtime_dir" "$RELEASE_DIR/$runtime_dir"
  fi
done

if [[ -d "$SHARED_DIR/public-uploads" ]]; then
  mkdir -p "$RELEASE_DIR/public"
  ln -s "$SHARED_DIR/public-uploads" "$RELEASE_DIR/public/uploads"
fi

if ss -ltn "sport = :$SMOKE_PORT" | grep -q LISTEN; then
  echo "Port smoke test $SMOKE_PORT sedang digunakan." >&2
  exit 4
fi

(
  cd "$RELEASE_DIR"
  NODE_ENV=production ./node_modules/.bin/next start -p "$SMOKE_PORT" \
    >"$SMOKE_LOG" 2>&1 &
  echo $! >"$DEPLOY_LOG_DIR/smoke-$TARGET_SHA.pid"
)
CANDIDATE_PID="$(cat "$DEPLOY_LOG_DIR/smoke-$TARGET_SHA.pid")"

CANDIDATE_READY=0
for _ in $(seq 1 45); do
  if curl --fail --silent --show-error "http://127.0.0.1:$SMOKE_PORT/login" >/dev/null; then
    CANDIDATE_READY=1
    break
  fi
  sleep 1
done

if [[ "$CANDIDATE_READY" != "1" ]]; then
  echo "Candidate release gagal smoke test. Lihat $SMOKE_LOG." >&2
  exit 5
fi

cleanup_candidate
CANDIDATE_PID=""

PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
if [[ -z "$PREVIOUS_TARGET" || ! -d "$PREVIOUS_TARGET" ]]; then
  echo "Current release/legacy rollback target tidak valid." >&2
  exit 6
fi

switch_current() {
  local target="$1"
  ln -sfn "$target" "$APP_ROOT/current.next"
  mv -Tf "$APP_ROOT/current.next" "$CURRENT_LINK"
}

start_current() {
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  (
    cd "$CURRENT_LINK"
    NODE_ENV=production pm2 start npm --name "$APP_NAME" -- start
  )
  pm2 save >/dev/null
}

rollback() {
  echo "Deployment gagal; rollback ke $PREVIOUS_TARGET." >&2
  switch_current "$PREVIOUS_TARGET"
  start_current
  for _ in $(seq 1 30); do
    if curl --fail --silent --show-error "http://127.0.0.1:$APP_PORT/login" >/dev/null; then
      echo "Rollback berhasil."
      return 0
    fi
    sleep 1
  done
  echo "Rollback dijalankan tetapi health check masih gagal." >&2
  return 1
}

switch_current "$RELEASE_DIR"

if ! start_current; then
  rollback
  exit 7
fi

PRODUCTION_READY=0
for _ in $(seq 1 45); do
  if curl --fail --silent --show-error "http://127.0.0.1:$APP_PORT/login" >/dev/null \
    && curl --fail --silent --show-error "https://lms.clev.io/login" >/dev/null; then
    PRODUCTION_READY=1
    break
  fi
  sleep 1
done

if [[ "$PRODUCTION_READY" != "1" ]]; then
  rollback
  exit 8
fi

printf '%s\n' "$TARGET_SHA" >"$SHARED_DIR/deployed-sha"
printf '%s\n' "$PREVIOUS_TARGET" >"$SHARED_DIR/previous-release"
printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SHARED_DIR/deployed-at"

mapfile -t OLD_RELEASES < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | awk -v keep="$KEEP_RELEASES" 'NR > keep {print $2}'
)

for old_release in "${OLD_RELEASES[@]:-}"; do
  [[ -z "$old_release" ]] && continue
  [[ "$old_release" == "$RELEASE_DIR" ]] && continue
  [[ "$old_release" == "$PREVIOUS_TARGET" ]] && continue
  git --git-dir="$BARE_REPO" worktree remove --force "$old_release" || true
done

echo "Deployment berhasil: $TARGET_SHA"
echo "Previous release: $PREVIOUS_TARGET"
