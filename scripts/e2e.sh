#!/usr/bin/env bash
# E2E tests against a fresh instance built from the source (compose.yaml + compose.build.yaml + e2e/compose.e2e.yaml).
#
#   ./scripts/e2e.sh                 # build, start, test, remove the instance and its data
#   E2E_KEEP=1 ./scripts/e2e.sh      # keep the instance running afterwards
#   E2E_BROWSER_CHANNEL=chrome ./scripts/e2e.sh   # use the installed Chrome
#   ./scripts/e2e.sh --project=chromium --shard=2/3   # one slice of the suites on one instance
#   E2E_SHARDS=3 ./scripts/e2e.sh    # 3 slices of the suites + the operations project, each on its
#                                    # own instance, all in parallel (4 instances, logs in e2e/test-results)
#
# Extra arguments are passed to "playwright test" (not with E2E_SHARDS).
#
# One instance = one compose project, so shards never share data. The project, ports and LiveKit
# media ports are configurable (E2E_PROJECT, E2E_PORT, E2E_TELEGRAM_PORT, E2E_LIVEKIT_TCP_PORT,
# E2E_LIVEKIT_UDP_PORT); E2E_SHARDS shifts them per instance. E2E_NO_BUILD=1 starts the images that
# are already built (CI builds them with a layer cache first).
#
# "--shard" must go with "--project=chromium": the operations project depends on chromium, and
# Playwright runs a dependency project in full in every shard instead of splitting it. The
# operations project (reset, restore, restart) runs on its own instance: --project=operations --no-deps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Plain builder: the bake delegation of Compose fails on some Docker Desktop setups.
export COMPOSE_BAKE="${COMPOSE_BAKE:-false}"
export E2E_PROJECT="${E2E_PROJECT:-teacherbox-e2e}"
export E2E_PORT="${E2E_PORT:-8091}"
export E2E_TEACHER_PASSWORD="${E2E_TEACHER_PASSWORD:-e2e-teacher-pass}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-e2e-admin-pass}"
export E2E_TELEGRAM_PORT="${E2E_TELEGRAM_PORT:-8099}"
export E2E_LIVEKIT_TCP_PORT="${E2E_LIVEKIT_TCP_PORT:-7881}"
export E2E_LIVEKIT_UDP_PORT="${E2E_LIVEKIT_UDP_PORT:-7882}"
export E2E_TELEGRAM_URL="${E2E_TELEGRAM_URL:-http://localhost:${E2E_TELEGRAM_PORT}}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${E2E_PORT}}"

compose() {
  docker compose -p "$E2E_PROJECT" --project-directory "$ROOT" \
    -f "$ROOT/compose.yaml" -f "$ROOT/compose.build.yaml" -f "$ROOT/e2e/compose.e2e.yaml" "$@"
}

prepare_tests() {
  cd "$ROOT/e2e"
  if [ ! -d node_modules ]; then
    npx -y npm@11 ci
  fi
  npm run typecheck
}

run_instance() {
  trap '[ "${E2E_KEEP:-}" = "1" ] || compose down -v --remove-orphans' EXIT
  echo "==> starting Teacher Box ${E2E_PROJECT} on ${E2E_BASE_URL}"
  if [ "${E2E_NO_BUILD:-}" = "1" ]; then
    compose up -d --no-build --wait --wait-timeout 180
  else
    compose up -d --build --wait --wait-timeout 180
  fi
  cd "$ROOT/e2e"
  echo "==> running e2e tests"
  npx playwright test "$@"
}

if [ -z "${E2E_SHARDS:-}" ]; then
  prepare_tests
  run_instance "$@"
  exit $?
fi

# Parallel instances: build once, then one instance per slice, shifted ports, own output directory.
if [ "$#" -gt 0 ]; then
  echo "E2E_SHARDS does not take extra arguments" >&2
  exit 2
fi
base_port="$E2E_PORT"
base_telegram="$E2E_TELEGRAM_PORT"
base_tcp="$E2E_LIVEKIT_TCP_PORT"
base_udp="$E2E_LIVEKIT_UDP_PORT"
base_project="$E2E_PROJECT"
out="$ROOT/e2e/test-results"
mkdir -p "$out"

echo "==> building the images once"
if [ "${E2E_NO_BUILD:-}" != "1" ]; then
  compose build
fi
export E2E_NO_BUILD=1
prepare_tests

# names[k] / args[k]: the chromium slices, then operations.
names=()
args=()
for ((i = 1; i <= E2E_SHARDS; i++)); do
  names+=("shard-$i")
  args+=("--project=chromium --shard=$i/$E2E_SHARDS")
done
names+=("operations")
args+=("--project=operations --no-deps")

pids=()
for k in "${!names[@]}"; do
  (
    export E2E_PROJECT="${base_project}-${names[$k]}"
    export E2E_PORT=$((base_port + k))
    export E2E_TELEGRAM_PORT=$((base_telegram + k))
    export E2E_LIVEKIT_TCP_PORT=$((base_tcp + 10 * k))
    export E2E_LIVEKIT_UDP_PORT=$((base_udp + 10 * k))
    export E2E_TELEGRAM_URL="http://localhost:${E2E_TELEGRAM_PORT}"
    export E2E_BASE_URL="http://localhost:${E2E_PORT}"
    export E2E_OUTPUT_DIR="test-results/${names[$k]}"
    # shellcheck disable=SC2086
    run_instance ${args[$k]}
  ) >"$out/${names[$k]}.log" 2>&1 &
  pids+=("$!")
  echo "==> ${names[$k]} started (port $((base_port + k)), log e2e/test-results/${names[$k]}.log)"
done

status=0
for k in "${!pids[@]}"; do
  if wait "${pids[$k]}"; then
    result=passed
  else
    result=FAILED
    status=1
  fi
  echo "==> ${names[$k]} ${result}; last lines:"
  tail -n 4 "$out/${names[$k]}.log" | sed 's/^/    /'
done
echo "==> all instances finished in $((SECONDS)) s (status $status)"
exit "$status"
