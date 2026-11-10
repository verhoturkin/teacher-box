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
#   scripts/verify.sh docs       # wiki links are valid, agent configs are in sync, the stamp test
#   scripts/verify.sh fresh <part>  # exit 0 if <part> passed on exactly the current tree (see below)
#
# A part that passes in full writes .verify-logs/<part>.ok with the fingerprint of the whole working tree
# (the tree of a temporary index after `git add -A`: tracked, modified and untracked, not ignored files).
# The pre-commit hook skips a part whose stamp equals the current fingerprint. Any change to any file, a
# part that failed or skipped a check (no docker, no shellcheck), or a tree that changed during the run
# leaves no stamp, so an unverified tree is never let through.
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

# Fingerprint of the working tree: the tree object of a copy of the index after `git add -A`.
# Prints nothing and fails when it cannot be computed (then nothing is stamped and nothing is skipped).
tree_fingerprint() {
    local idx tmp out status=0
    idx="${GIT_INDEX_FILE:-$(git -C "$ROOT" rev-parse --git-path index)}"
    case "$idx" in /*) ;; *) idx="$ROOT/$idx" ;; esac
    tmp="$(mktemp)" || return 1
    cp "$idx" "$tmp" 2>/dev/null || : >"$tmp"
    out="$(GIT_INDEX_FILE="$tmp" git -C "$ROOT" add -A >/dev/null 2>&1 &&
        GIT_INDEX_FILE="$tmp" git -C "$ROOT" write-tree 2>/dev/null)" || status=1
    rm -f "$tmp"
    [ "$status" -eq 0 ] && [ -n "$out" ] || return 1
    printf '%s\n' "$out"
}

stamp_file() { printf '%s/%s.ok' "$LOG_DIR" "$1"; }

# stamp_fresh <part>: the part passed on exactly the current tree.
stamp_fresh() {
    local file fp
    file="$(stamp_file "$1")"
    [ -f "$file" ] || return 1
    fp="$(tree_fingerprint)" || return 1
    [ -n "$fp" ] && [ "$(cat "$file")" = "$fp" ]
}

# A step that could not run its checks calls skipped; such a part is not stamped.
SKIPPED=0
skipped() { SKIPPED=1; }

# stamp_write <part> <fingerprint taken before the run>: only when the tree did not change during the run.
stamp_write() {
    local part="$1" before="$2" after
    [ "$SKIPPED" -eq 0 ] && [ -n "$before" ] || return 0
    after="$(tree_fingerprint)" || return 0
    if [ "$after" = "$before" ]; then
        printf '%s\n' "$after" >"$(stamp_file "$part")"
    fi
}

# Checks the stamp logic in a throwaway repository: green run stamps, unchanged tree is fresh, any
# change (tracked, untracked, staged) is not, a skipped or failed run leaves no stamp.
stamp_selftest() {
    local tmp
    tmp="$(mktemp -d)"
    (
        set -e
        ROOT="$tmp"
        LOG_DIR="$tmp/.verify-logs"
        mkdir -p "$LOG_DIR"
        git init -q "$ROOT"
        git -C "$ROOT" config user.email t@example.com
        git -C "$ROOT" config user.name t
        printf '.verify-logs/\nignored/\n' >"$ROOT/.gitignore"
        echo a >"$ROOT/a.txt"
        git -C "$ROOT" add -A
        git -C "$ROOT" commit -q -m init
        fail() { echo "stamp selftest: $*"; exit 1; }
        stamp_fresh p && fail "fresh without a stamp"
        before="$(tree_fingerprint)"
        stamp_write p "$before"
        stamp_fresh p || fail "not fresh after a green run"
        mkdir -p "$ROOT/ignored" && echo x >"$ROOT/ignored/f" && : >"$ROOT/.verify-logs/other.log"
        stamp_fresh p || fail "ignored files must not matter"
        echo b >>"$ROOT/a.txt"
        stamp_fresh p && fail "fresh after editing a tracked file"
        git -C "$ROOT" checkout -q a.txt
        stamp_fresh p || fail "reverting must restore the stamp"
        echo n >"$ROOT/new.txt"
        stamp_fresh p && fail "fresh after adding an untracked file"
        git -C "$ROOT" add new.txt
        stamp_fresh p && fail "fresh after staging a new file"
        rm -f "$(stamp_file p)"
        SKIPPED=1
        stamp_write q "$(tree_fingerprint)"
        [ ! -f "$(stamp_file q)" ] || fail "a skipped part was stamped"
        SKIPPED=0
        before="$(tree_fingerprint)"
        echo c >>"$ROOT/a.txt"
        stamp_write q "$before"
        [ ! -f "$(stamp_file q)" ] || fail "stamped although the tree changed during the run"
    ) || { rm -rf "$tmp"; return 1; }
    rm -rf "$tmp"
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
        skipped
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
        skipped
    fi
    verify_installer
}

shellcheck_scripts() {
    local scripts=(scripts/install.sh scripts/teacherbox scripts/verify.sh scripts/e2e.sh scripts/check-wiki.sh
        scripts/publish-wiki.sh scripts/agent-setup.sh scripts/check-agents.sh)
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
        --domain https://school.example.com/ --calls || return 1
    env="$tmp/opt/.env"
    for line in TEACHERBOX_DOMAIN=school.example.com TEACHERBOX_HTTP_PORT=127.0.0.1:8080 \
        COMPOSE_PROFILES=https,calls; do
        grep -qx "$line" "$env" || { echo "missing in .env: $line"; return 1; }
    done
    ! grep -q '^TEACHERBOX_TIMEZONE=' "$env" || { echo "the installer must not set the time zone"; return 1; }
    grep -Eqx 'TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET=[A-Za-z0-9]{48}' "$env" || { echo "no LiveKit secret"; return 1; }
    # The domain (the default portal address) reaches the backend; Caddy and LiveKit are in the configuration.
    docker compose --project-directory "$tmp/opt" -f "$tmp/opt/compose.yaml" config >"$tmp/config.yaml" || return 1
    for line in "TEACHERBOX_DOMAIN: school.example.com" "image: caddy:" "image: livekit/"; do
        grep -qF "$line" "$tmp/config.yaml" || { echo "missing in the configuration: $line"; return 1; }
    done
    TEACHERBOX_DIR="$tmp/opt" bash "$tmp/bin/teacherbox" help | grep -q "teacherbox reset" || return 1
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
        skipped
    fi
    run installer-dry-run "$ROOT" installer_dry_run
}

verify_e2e() {
    step "e2e"
    npm_install e2e "$ROOT/e2e"
    run e2e-typecheck "$ROOT/e2e" npm run typecheck
}

verify_docs() {
    step "docs"
    run docs-wiki-links "$ROOT" bash scripts/check-wiki.sh
    run docs-agent-configs "$ROOT" bash scripts/check-agents.sh
    run docs-stamp-selftest "$ROOT" stamp_selftest
}

# Runs the part and stamps it when it passed in full on the tree it started with.
part() {
    local name="$1" fp
    rm -f "$(stamp_file "$name")"
    fp="$(tree_fingerprint)" || fp=""
    SKIPPED=0
    "verify_$name"
    stamp_write "$name" "$fp"
}

target="${1:-all}"
case "$target" in
    all)
        part docs
        part backend
        part frontend
        part e2e
        part docker
        ;;
    docs | backend | frontend | docker | installer | e2e) part "$target" ;;
    fresh)
        stamp_fresh "${2:?usage: $0 fresh <part>}"
        exit $?
        ;;
    *)
        echo "usage: $0 [all|docs|backend|frontend|docker|installer|e2e|fresh <part>]" >&2
        exit 2
        ;;
esac

step "verification passed ($target)"
