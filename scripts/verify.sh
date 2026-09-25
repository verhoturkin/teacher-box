#!/usr/bin/env bash
#
# Project verification: the same checks run by the pre-commit hook and CI (AGENTS.md §8).
#
#   scripts/verify.sh            # everything
#   scripts/verify.sh backend    # mvnw verify: tests, coverage gates, module verification
#   scripts/verify.sh frontend   # lint, tests with coverage gates, production build
#   scripts/verify.sh docker     # compose files are valid (and images build if the daemon is up)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

step() {
    printf '\n==> %s\n' "$*"
}

verify_backend() {
    step "backend: mvnw clean verify"
    (cd "$ROOT/backend" && ./mvnw -B -q clean verify)
}

verify_frontend() {
    step "frontend: lint, test, build"
    cd "$ROOT/frontend"
    if [ ! -d node_modules ]; then
        # npm >= 11 is required (ADR-0007); npx fetches it when the local npm is older.
        npx -y npm@11 ci --no-audit --no-fund
    fi
    npm run lint
    npm test
    npm run build
}

verify_docker() {
    step "docker: compose configuration"
    if ! command -v docker >/dev/null 2>&1; then
        echo "docker CLI not found, skipping"
        return 0
    fi
    for file in compose.split.yaml compose.single.yaml; do
        docker compose -f "$ROOT/$file" config --quiet
        echo "$file: OK"
    done
    if docker info >/dev/null 2>&1; then
        step "docker: build images"
        docker compose -f "$ROOT/compose.split.yaml" build
        docker compose -f "$ROOT/compose.single.yaml" build
    else
        echo "docker daemon is not running, image build skipped"
    fi
}

target="${1:-all}"
case "$target" in
    all)
        verify_backend
        verify_frontend
        verify_docker
        ;;
    backend) verify_backend ;;
    frontend) verify_frontend ;;
    docker) verify_docker ;;
    *)
        echo "usage: $0 [all|backend|frontend|docker]" >&2
        exit 2
        ;;
esac

step "verification passed ($target)"
