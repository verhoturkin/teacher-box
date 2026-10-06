#!/usr/bin/env bash
#
# Project verification: the same checks run by the pre-commit hook and CI (AGENTS.md §8).
#
#   scripts/verify.sh            # everything
#   scripts/verify.sh backend    # mvnw verify: tests, coverage gates, module verification
#   scripts/verify.sh frontend   # lint, tests with coverage gates, production build
#   scripts/verify.sh docker     # compose files are valid (images build, nginx config checks if the daemon is up)
#                                # + the installer checks
#   scripts/verify.sh installer  # shellcheck of the scripts, a dry run of install.sh (ADR-0032)
#   scripts/verify.sh e2e        # the E2E tests compile (running them: scripts/e2e.sh)
#
# Each step writes its full output to .verify-logs/<step>.log and prints one line; a failed step prints
# the end of its log. VERIFY_VERBOSE=1 streams the full output, VERIFY_TAIL=<n> sets how many lines of a
# failed log are printed (default 80).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.verify-logs"
mkdir -p "$LOG_DIR"

step() {
    printf '\n==> %s\n' "$*"
}

# run <name> <dir> <command...>: runs the command in the directory, its output goes to the step's log.
run() {
    local name="$1" dir="$2"
    shift 2
    local log="$LOG_DIR/$name.log" start=$SECONDS status=0
    if [ "${VERIFY_VERBOSE:-0}" = 1 ]; then
        (cd "$dir" && "$@") 2>&1 | tee "$log" || status=$?
    else
        (cd "$dir" && NO_COLOR=1 FORCE_COLOR=0 "$@") >"$log" 2>&1 || status=$?
    fi
    if [ "$status" -eq 0 ]; then
        printf '    %-30s ok (%ss)\n' "$name" $((SECONDS - start))
        return 0
    fi
    printf '    %-30s FAILED (%ss), full log: %s\n' "$name" $((SECONDS - start)) "${log#"$ROOT"/}"
    if [ "${VERIFY_VERBOSE:-0}" != 1 ]; then
        printf -- '---- last %s lines ----\n' "${VERIFY_TAIL:-80}"
        tail -n "${VERIFY_TAIL:-80}" "$log" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g'
        printf -- '----\n'
    fi
    exit "$status"
}

npm_install() {
    # npm >= 11 is required (ADR-0007); npx fetches it when the local npm is older.
    if [ ! -d "$2/node_modules" ]; then
        run "$1-install" "$2" npx -y npm@11 ci --no-audit --no-fund
    fi
}

verify_backend() {
    step "backend"
    run backend-verify "$ROOT/backend" ./mvnw -B -q clean verify
}

verify_frontend() {
    step "frontend"
    npm_install frontend "$ROOT/frontend"
    run frontend-lint "$ROOT/frontend" npm run lint
    run frontend-test "$ROOT/frontend" npm test
    run frontend-build "$ROOT/frontend" npm run build
}

verify_docker() {
    step "docker"
    if ! command -v docker >/dev/null 2>&1; then
        echo "    docker CLI not found, skipping"
        return 0
    fi
    run docker-config "$ROOT" docker compose config --quiet
    run docker-config-profiles "$ROOT" docker compose --profile https --profile calls config --quiet
    run docker-config-build "$ROOT" docker compose -f compose.yaml -f compose.build.yaml config --quiet
    if docker info >/dev/null 2>&1; then
        run docker-build "$ROOT" docker compose -f compose.yaml -f compose.build.yaml build
        # The nginx template gives a valid config without LIVEKIT_URL (as in CI; "backend" resolves only in compose).
        run docker-nginx-config "$ROOT" docker run --rm -e BACKEND_URL=http://127.0.0.1:8080 \
            ghcr.io/verhoturkin/teacher-box-frontend:latest nginx -t
    else
        echo "    docker daemon is not running, image build skipped"
    fi
    verify_installer
}

shellcheck_scripts() {
    local scripts=(scripts/install.sh scripts/teacherbox scripts/verify.sh scripts/e2e.sh)
    if command -v shellcheck >/dev/null 2>&1; then
        shellcheck -x "${scripts[@]}"
    else
        # Git Bash: give Docker the Windows form of the path and keep the arguments unconverted.
        MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd):/mnt" -w /mnt \
            koalaman/shellcheck:stable -x "${scripts[@]}"
    fi
}

# A dry run of the installer into .verify-logs/install: the written .env and compose.yaml make a valid configuration.
installer_dry_run() {
    local tmp="$LOG_DIR/install" env
    rm -rf "$tmp"
    bash scripts/install.sh --yes --no-start --source "$ROOT" --dir "$tmp/opt" --bin "$tmp/bin" \
        --domain https://school.example.com/ --calls --timezone Asia/Yekaterinburg || return 1
    env="$tmp/opt/.env"
    for line in TEACHERBOX_DOMAIN=school.example.com TEACHERBOX_HTTP_PORT=127.0.0.1:8080 \
        TEACHERBOX_TIMEZONE=Asia/Yekaterinburg COMPOSE_PROFILES=https,calls; do
        grep -qx "$line" "$env" || { echo "missing in .env: $line"; return 1; }
    done
    grep -Eqx 'TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET=[A-Za-z0-9]{48}' "$env" || { echo "no LiveKit secret"; return 1; }
    # The portal address follows the domain; Caddy and LiveKit are in the configuration.
    docker compose --project-directory "$tmp/opt" -f "$tmp/opt/compose.yaml" config >"$tmp/config.yaml" || return 1
    for line in "TEACHERBOX_PUBLIC_URL: https://school.example.com" "image: caddy:" "image: livekit/"; do
        grep -qF "$line" "$tmp/config.yaml" || { echo "missing in the configuration: $line"; return 1; }
    done
    TEACHERBOX_DIR="$tmp/opt" bash "$tmp/bin/teacherbox" help | grep -q "teacherbox update" || return 1
    # A second run keeps the settings.
    bash scripts/install.sh --yes --no-start --source "$ROOT" --dir "$tmp/opt" --bin "$tmp/bin" --no-calls || return 1
    grep -qx COMPOSE_PROFILES=https,calls "$env" || { echo ".env was rewritten"; return 1; }
}

verify_installer() {
    step "installer"
    if command -v shellcheck >/dev/null 2>&1 || docker info >/dev/null 2>&1; then
        run installer-shellcheck "$ROOT" shellcheck_scripts
    else
        echo "    neither shellcheck nor a running docker daemon, shellcheck skipped"
    fi
    run installer-dry-run "$ROOT" installer_dry_run
}

verify_e2e() {
    step "e2e"
    npm_install e2e "$ROOT/e2e"
    run e2e-typecheck "$ROOT/e2e" npm run typecheck
}

target="${1:-all}"
case "$target" in
    all)
        verify_backend
        verify_frontend
        verify_e2e
        verify_docker
        ;;
    backend) verify_backend ;;
    frontend) verify_frontend ;;
    docker) verify_docker ;;
    installer) verify_installer ;;
    e2e) verify_e2e ;;
    *)
        echo "usage: $0 [all|backend|frontend|docker|installer|e2e]" >&2
        exit 2
        ;;
esac

step "verification passed ($target)"
