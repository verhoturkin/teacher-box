#!/usr/bin/env bash
# E2E tests against a fresh single-container instance (compose.single.yaml + e2e/compose.e2e.yaml).
#
#   ./scripts/e2e.sh                 # build, start, test, remove the instance and its data
#   E2E_KEEP=1 ./scripts/e2e.sh      # keep the instance running afterwards
#   E2E_BROWSER_CHANNEL=chrome ./scripts/e2e.sh   # use the installed Chrome
#
# Extra arguments are passed to "playwright test".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export E2E_PORT="${E2E_PORT:-8091}"
export E2E_TEACHER_PASSWORD="${E2E_TEACHER_PASSWORD:-e2e-teacher-pass}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-admin-pass}"
export E2E_TELEGRAM_PORT="${E2E_TELEGRAM_PORT:-8099}"
export E2E_TELEGRAM_URL="${E2E_TELEGRAM_URL:-http://localhost:${E2E_TELEGRAM_PORT}}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${E2E_PORT}}"

compose() {
  docker compose -p teacherbox-e2e --project-directory "$ROOT" \
    -f "$ROOT/compose.single.yaml" -f "$ROOT/e2e/compose.e2e.yaml" "$@"
}

cleanup() {
  if [ "${E2E_KEEP:-}" != "1" ]; then
    compose down -v --remove-orphans
  fi
}
trap cleanup EXIT

echo "==> starting Teacher Box on ${E2E_BASE_URL}"
compose up -d --build --wait --wait-timeout 180

cd e2e
if [ ! -d node_modules ]; then
  npx -y npm@11 ci
fi
npm run typecheck
echo "==> running e2e tests"
npx playwright test "$@"
