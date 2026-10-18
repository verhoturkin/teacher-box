#!/usr/bin/env bash
#
# Publishes docs/wiki to the GitHub wiki: the wiki repository gets exactly the pages of docs/wiki.
# CI runs it for a release tag (and on demand, workflow wiki.yml); pages edited in the wiki itself are overwritten.
#
#   GH_TOKEN=<token with contents: write> scripts/publish-wiki.sh <version>
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="${1:?usage: $0 <version>}"
: "${GH_TOKEN:?GH_TOKEN is required}"
repo="${GITHUB_REPOSITORY:-verhoturkin/teacher-box}"

wiki="$(mktemp -d)"
trap 'rm -rf "$wiki"' EXIT
git clone --quiet --depth 1 "https://x-access-token:${GH_TOKEN}@github.com/${repo}.wiki.git" "$wiki"
find "$wiki" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp "$ROOT"/docs/wiki/*.md "$wiki"/

cd "$wiki"
git add --all
if git diff --cached --quiet; then
    echo "The wiki is up to date"
    exit 0
fi
git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit --quiet -m "docs(wiki): ${version}"
git push --quiet origin HEAD
echo "The wiki is published (${version})"
