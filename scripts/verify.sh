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
#   scripts/verify.sh fresh <part>  # exit 0 if <part> passed on exactly the current working tree
#   scripts/verify.sh staged <part> # the pre-commit check of <part>: on exactly the content of the commit
#
# A part that passes in full writes .verify-logs/<part>.ok with the fingerprint of the content it checked:
# the tree object of that content (for the working tree, the tree of a temporary index after `git add -A`:
# tracked, modified and untracked, not ignored files). A part that failed or skipped a check (no docker or
# no shellcheck), or a tree that changed during the run, leaves no stamp.
#
# `staged` (called by .githooks/pre-commit) works on the tree of the commit's index (`git write-tree`):
# - a stamp equal to that tree means this very content passed, so the part is skipped;
# - when the working tree equals the index (no unstaged edits, no untracked files, no staged deletion of a
#   file still on disk) the part runs in place;
# - otherwise (`git add -p`, unstaged edits, untracked files) it runs on an export of the index: a
#   temporary repository sharing this one's objects, `read-tree -u` of the tree, node_modules of frontend/
#   and e2e/ linked (a junction on Windows) when package.json and package-lock.json are the same, else
#   installed. The working tree and the index are not touched; a green export stamps the tree.
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

# --- The pre-commit check of the commit content (`staged`) ---

is_windows() {
    case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) return 0 ;; esac
    return 1
}

# make_link <target dir> <link>: a symbolic link, on Windows a junction (needs no administrator rights).
make_link() {
    if is_windows; then
        MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$2")" "$(cygpath -w "$1")" >/dev/null
    else
        ln -s "$1" "$2"
    fi
}

# drop_link <link>: removes the link only, never the directory it points to.
drop_link() {
    if is_windows; then
        MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$1")" >/dev/null 2>&1 || true
    else
        rm -f "$1"
    fi
}

# A path deleted in the index but still on disk (an ignored file `git rm --cached`): the working tree
# fingerprint does not see it, the checks would.
staged_deletion_on_disk() {
    local path
    while IFS= read -r -d '' path; do
        if [ -e "$ROOT/$path" ] || [ -L "$ROOT/$path" ]; then
            return 0
        fi
    done < <(git -C "$ROOT" diff --cached --name-only --no-renames --diff-filter=D -z)
    return 1
}

# Directories whose node_modules an export may reuse.
DEPS_DIRS="frontend e2e"

# link_deps <export> <list>: links <dir>/node_modules of this tree into the export when the manifest and
# the lockfile there are the same as here (otherwise the part installs them); each link goes to <list>.
link_deps() {
    local dest="$1" list="$2" dir f
    for dir in $DEPS_DIRS; do
        [ -d "$ROOT/$dir/node_modules" ] && [ -d "$dest/$dir" ] || continue
        for f in package.json package-lock.json; do
            [ "$(git -C "$ROOT" hash-object "$dir/$f" 2>/dev/null)" = \
                "$(git -C "$dest" rev-parse -q --verify ":$dir/$f" 2>/dev/null)" ] || continue 2
        done
        printf '%s\n' "$dest/$dir/node_modules" >>"$list"
        make_link "$ROOT/$dir/node_modules" "$dest/$dir/node_modules" || return 1
    done
}

# export_tree <tree> <dir>: a repository in <dir> whose index and work tree hold exactly <tree>.
export_tree() {
    local objects
    objects="$(git -C "$ROOT" rev-parse --path-format=absolute --git-path objects)" || return 1
    git init -q "$2" || return 1
    printf '%s\n' "$objects" >"$2/.git/objects/info/alternates"
    git -C "$2" read-tree --reset -u "$1"
}

# exported_verify <export> <part>: the part's checks of the commit (its own scripts/verify.sh).
exported_verify() {
    bash "$1/scripts/verify.sh" "$2"
}

# run_exported <part> <tree>: runs the part on an export of <tree> and stamps <tree> when it passed in
# full. The logs are copied to .verify-logs/.
run_exported() {
    local name="$1" tree="$2" tmp dest status=0 stamped=false link kept=false
    tmp="$(mktemp -d)" || return 1
    dest="$tmp/tree"
    : >"$tmp/links"
    (
        # The hook's GIT_INDEX_FILE (and the like) belong to this repository, not to the export.
        unset GIT_INDEX_FILE GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_PREFIX GIT_OBJECT_DIRECTORY \
            GIT_ALTERNATE_OBJECT_DIRECTORIES
        export_tree "$tree" "$dest" && link_deps "$dest" "$tmp/links" && exported_verify "$dest" "$name"
    ) || status=$?
    [ -f "$dest/.verify-logs/$name.ok" ] && stamped=true
    cp "$dest"/.verify-logs/*.log "$LOG_DIR"/ 2>/dev/null || true
    # The links go first: removing the export must never reach the node_modules of this tree.
    while IFS= read -r link; do
        drop_link "$link"
        if [ -e "$link" ] || [ -L "$link" ]; then
            kept=true
        fi
    done <"$tmp/links"
    if [ "$kept" = true ]; then
        echo "    export left in $tmp: a node_modules link could not be removed" >&2
    else
        rm -rf "$tmp"
    fi
    [ "$status" -eq 0 ] || return "$status"
    if [ "$stamped" = true ]; then
        printf '%s\n' "$tree" >"$(stamp_file "$name")"
    fi
}

# staged_part <part>: the part's checks of exactly the content of the commit.
staged_part() {
    local name="$1" tree fp
    tree="$(git -C "$ROOT" write-tree 2>/dev/null)" || {
        echo "cannot write the tree of the index (unmerged paths?)" >&2
        return 1
    }
    if [ -f "$(stamp_file "$name")" ] && [ "$(cat "$(stamp_file "$name")")" = "$tree" ]; then
        echo "==> $name: already verified on the content of this commit, skipped"
        return 0
    fi
    rm -f "$(stamp_file "$name")"
    fp="$(tree_fingerprint)" || fp=""
    if [ -n "$fp" ] && [ "$fp" = "$tree" ] && ! staged_deletion_on_disk; then
        part "$name"
        if [ "$SKIPPED" -eq 0 ] && [ "$(cat "$(stamp_file "$name")" 2>/dev/null)" != "$tree" ]; then
            echo "==> $name: the working tree changed during the check; commit again" >&2
            return 1
        fi
        return 0
    fi
    echo "==> $name: the working tree differs from the commit, checking an export of the index"
    run_exported "$name" "$tree"
}

# Checks the stamp logic in a throwaway repository: green run stamps, unchanged tree is fresh, any
# change (tracked, untracked, staged) is not, a skipped or failed run leaves no stamp; `staged` skips only
# for a stamp of the commit content and checks an export when the working tree differs from the index.
# The body runs with ROOT and LOG_DIR of the throwaway repository, given for the call only.
stamp_selftest_fail() {
    echo "stamp selftest: $*"
    exit 1
}

stamp_selftest_body() {
    local before
    mkdir -p "$LOG_DIR"
    git init -q "$ROOT"
    git -C "$ROOT" config user.email t@example.com
    git -C "$ROOT" config user.name t
    printf '.verify-logs/\nignored/\n' >"$ROOT/.gitignore"
    echo a >"$ROOT/a.txt"
    git -C "$ROOT" add -A
    git -C "$ROOT" commit -q -m init
    stamp_fresh p && stamp_selftest_fail "fresh without a stamp"
    before="$(tree_fingerprint)"
    stamp_write p "$before"
    stamp_fresh p || stamp_selftest_fail "not fresh after a green run"
    mkdir -p "$ROOT/ignored" && echo x >"$ROOT/ignored/f" && : >"$ROOT/.verify-logs/other.log"
    stamp_fresh p || stamp_selftest_fail "ignored files must not matter"
    echo b >>"$ROOT/a.txt"
    stamp_fresh p && stamp_selftest_fail "fresh after editing a tracked file"
    git -C "$ROOT" checkout -q a.txt
    stamp_fresh p || stamp_selftest_fail "reverting must restore the stamp"
    echo n >"$ROOT/new.txt"
    stamp_fresh p && stamp_selftest_fail "fresh after adding an untracked file"
    git -C "$ROOT" add new.txt
    stamp_fresh p && stamp_selftest_fail "fresh after staging a new file"
    rm -f "$(stamp_file p)"
    SKIPPED=1
    stamp_write q "$(tree_fingerprint)"
    [ ! -f "$(stamp_file q)" ] || stamp_selftest_fail "a skipped part was stamped"
    SKIPPED=0
    before="$(tree_fingerprint)"
    echo c >>"$ROOT/a.txt"
    stamp_write q "$before"
    [ ! -f "$(stamp_file q)" ] || stamp_selftest_fail "stamped although the tree changed during the run"
    git -C "$ROOT" checkout -q a.txt
    stamp_selftest_staged
}

# The `staged` cases. verify_p records an in-place run; exported_verify checks that the export holds the
# index and that the node_modules of this tree reach it, then passes (or fails with EXPORT_FAIL=1).
stamp_selftest_staged() {
    local tree ran="$LOG_DIR/ran"
    # shellcheck disable=SC2329 # run by part as verify_$name
    verify_p() { echo inplace >>"$ran"; }
    exported_verify() {
        [ "$(cat "$1/a.txt")" = "$(git -C "$ROOT" show :a.txt)" ] || stamp_selftest_fail "export is not the index"
        [ ! -e "$1/new.txt" ] || stamp_selftest_fail "untracked file in the export"
        [ -f "$1/frontend/node_modules/pkg" ] || stamp_selftest_fail "node_modules not linked"
        echo export >>"$ran"
        [ "${EXPORT_FAIL:-0}" = 0 ] || return 1
        mkdir -p "$1/.verify-logs"
        echo exported >"$1/.verify-logs/p-step.log"
        echo stamped >"$1/.verify-logs/p.ok"
    }
    git -C "$ROOT" rm -q --cached new.txt
    rm -f "$ROOT/new.txt" "$LOG_DIR"/*.ok
    mkdir -p "$ROOT/frontend/node_modules"
    printf '/frontend/node_modules/\n' >>"$ROOT/.gitignore"
    echo pkg >"$ROOT/frontend/node_modules/pkg"
    echo '{}' >"$ROOT/frontend/package.json"
    echo '{}' >"$ROOT/frontend/package-lock.json"
    git -C "$ROOT" add -A
    git -C "$ROOT" commit -q -m deps
    tree="$(git -C "$ROOT" write-tree)"

    staged_part p >/dev/null || stamp_selftest_fail "clean tree: the check failed"
    [ "$(cat "$ran")" = inplace ] || stamp_selftest_fail "clean tree: not checked in place"
    [ "$(cat "$(stamp_file p)")" = "$tree" ] || stamp_selftest_fail "clean tree: the index tree not stamped"
    : >"$ran"
    staged_part p >/dev/null || stamp_selftest_fail "stamped tree: failed"
    [ ! -s "$ran" ] || stamp_selftest_fail "stamped tree: checked again"

    # git add -p: the staged half differs from the working tree; the worktree stamp must not count.
    echo staged >"$ROOT/a.txt"
    git -C "$ROOT" add a.txt
    echo unstaged >>"$ROOT/a.txt"
    tree="$(git -C "$ROOT" write-tree)"
    part p >/dev/null
    : >"$ran"
    staged_part p >/dev/null || stamp_selftest_fail "partial staging: the check failed"
    [ "$(cat "$ran")" = export ] || stamp_selftest_fail "partial staging: the index was not exported"
    [ "$(cat "$(stamp_file p)")" = "$tree" ] || stamp_selftest_fail "partial staging: the index tree not stamped"
    [ "$(cat "$ROOT/a.txt")" = "$(printf 'staged\nunstaged')" ] || stamp_selftest_fail "working tree changed"
    [ "$(git -C "$ROOT" write-tree)" = "$tree" ] || stamp_selftest_fail "index changed"
    [ "$(cat "$LOG_DIR/p-step.log")" = exported ] || stamp_selftest_fail "export logs not copied"
    [ -f "$ROOT/frontend/node_modules/pkg" ] || stamp_selftest_fail "removing the export reached node_modules"
    [ -z "$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -newer "$ROOT/.gitignore" ! -name ran)" ] ||
        stamp_selftest_fail "export not removed"
    : >"$ran"
    staged_part p >/dev/null || stamp_selftest_fail "partial staging, stamped: failed"
    [ ! -s "$ran" ] || stamp_selftest_fail "partial staging, stamped: checked again"

    # Untracked file: fully staged otherwise, still not the content of the commit.
    git -C "$ROOT" add a.txt
    echo n >"$ROOT/new.txt"
    : >"$ran"
    staged_part p >/dev/null || stamp_selftest_fail "untracked file: the check failed"
    [ "$(cat "$ran")" = export ] || stamp_selftest_fail "untracked file: not exported"
    rm -f "$ROOT/new.txt"

    # A failed export: no stamp, the hook fails.
    echo again >"$ROOT/a.txt"
    git -C "$ROOT" add a.txt
    echo more >>"$ROOT/a.txt"
    if EXPORT_FAIL=1 staged_part p >/dev/null 2>&1; then stamp_selftest_fail "failed export passed"; fi
    [ ! -f "$(stamp_file p)" ] || stamp_selftest_fail "failed export stamped"
    git -C "$ROOT" checkout -q a.txt

    # A staged deletion of an ignored file that is still on disk.
    git -C "$ROOT" add -A
    echo kept >"$ROOT/kept.txt"
    git -C "$ROOT" add kept.txt
    git -C "$ROOT" commit -q -m kept
    printf '/kept.txt\n' >>"$ROOT/.gitignore"
    git -C "$ROOT" rm -q --cached kept.txt
    git -C "$ROOT" add .gitignore
    : >"$ran"
    staged_part p >/dev/null || stamp_selftest_fail "staged deletion: the check failed"
    [ "$(cat "$ran")" = export ] || stamp_selftest_fail "staged deletion on disk: not exported"
}

stamp_selftest() {
    local tmp status=0
    tmp="$(mktemp -d)"
    mkdir "$tmp/repo" "$tmp/tmp"
    # Under the hook GIT_INDEX_FILE names the index of the commit: the throwaway repository must not use it.
    (
        unset GIT_INDEX_FILE GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_PREFIX GIT_OBJECT_DIRECTORY \
            GIT_ALTERNATE_OBJECT_DIRECTORIES
        ROOT="$tmp/repo" LOG_DIR="$tmp/repo/.verify-logs" TMPDIR="$tmp/tmp" stamp_selftest_body
    ) || status=1
    rm -rf "$tmp"
    return "$status"
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
        scripts/publish-wiki.sh scripts/agent-setup.sh scripts/check-agents.sh
        docker/nginx/15-backend-upstream.envsh)
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
    staged)
        case "${2:-}" in
            docs | backend | frontend | docker | installer | e2e) staged_part "$2" ;;
            *)
                echo "usage: $0 staged <part>" >&2
                exit 2
                ;;
        esac
        target="$2, content of the commit"
        ;;
    *)
        echo "usage: $0 [all|docs|backend|frontend|docker|installer|e2e|fresh <part>|staged <part>]" >&2
        exit 2
        ;;
esac

step "verification passed ($target)"
