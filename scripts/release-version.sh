#!/usr/bin/env bash
#
# The release version of the tree and whether it is a new release (ADR-0063). CI runs it on every pull
# request and push; a push to main with a new version publishes the release, tags it and writes the wiki.
#
#   scripts/release-version.sh [--notes <file>]
#
# Checks that backend/pom.xml, frontend/package.json and the root of frontend/package-lock.json carry one
# SemVer version. The version is new when the tag v<version> is not on origin; a new version needs its
# "## [X.Y.Z]" section in CHANGELOG.md, which --notes writes to <file> (the GitHub release text).
# Prints "version=…" and "release=true|false", and appends them to $GITHUB_OUTPUT under GitHub Actions.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

notes=''
if [ "${1:-}" = '--notes' ]; then
    notes="${2:?usage: $0 [--notes <file>]}"
fi

fail() {
    echo "release-version: $*" >&2
    exit 1
}

# The project's own <version>: the first one after the parent block.
backend="$(sed -n '/<\/parent>/,$ s:^    <version>\(.*\)</version>$:\1:p' backend/pom.xml | head -n 1)"
frontend="$(grep -m 1 -o '"version": "[^"]*"' frontend/package.json | sed 's/.*: "\(.*\)"/\1/')"
# The root "version" of the lockfile and of its packages[""] entry.
lock="$(grep -m 2 -o '"version": "[^"]*"' frontend/package-lock.json | sed 's/.*: "\(.*\)"/\1/' | sort -u)"

[ -n "$backend" ] || fail "no project <version> in backend/pom.xml"
[[ "$backend" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || fail "backend/pom.xml: '$backend' is not SemVer"
[ "$frontend" = "$backend" ] || fail "frontend/package.json has '$frontend', backend/pom.xml '$backend'"
[ "$lock" = "$backend" ] ||
    fail "frontend/package-lock.json has '$lock', backend/pom.xml '$backend'" \
        "(in frontend/: npx -y npm@11 install --package-lock-only)"

version="$backend"
tag="v$version"

if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null; then
    release=false
else
    status=$?
    # 2: no such ref; anything else: origin could not be asked, which must not look like a new release.
    [ "$status" -eq 2 ] || fail "cannot list the tags of origin (git ls-remote exit $status)"
    release=true
fi

if [ "$release" = true ]; then
    # The section from its heading to the next release heading, without the heading and edge blank lines.
    section="$(awk -v head="## [$version]" '
        index($0, head) == 1 { found = 1; next }
        found && /^## \[/ { exit }
        found { print }
    ' CHANGELOG.md | sed -e '/./,$!d' | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')"
    [ -n "$section" ] || fail "CHANGELOG.md has no '## [$version]' section for the new release $tag"
    if [ -n "$notes" ]; then
        printf '%s\n' "$section" >"$notes"
    fi
fi

echo "version=$version"
echo "release=$release"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
        echo "version=$version"
        echo "release=$release"
    } >>"$GITHUB_OUTPUT"
fi
