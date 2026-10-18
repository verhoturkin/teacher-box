#!/usr/bin/env bash
#
# Checks the links to wiki pages: links between the pages of docs/wiki ([Text](Page), [Text](Page#anchor)) and
# the wiki links of the other docs (https://github.com/verhoturkin/teacher-box/wiki/Page) name existing pages.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
status=0

check() { # check <file> <page>
    if [ ! -f "docs/wiki/$2.md" ]; then
        echo "$1: no wiki page \"$2\""
        status=1
    fi
}

for file in docs/wiki/*.md; do
    while IFS= read -r page; do
        check "$file" "$page"
    # Relative links only: external ones (with a scheme or a path) are not wiki pages.
    done < <(grep -oE '\]\([^)]+\)' "$file" | sed -E 's/^\]\(//; s/[)#].*//' | grep -vE '[:/]' || true)
done

while IFS=: read -r file page; do
    check "$file" "$page"
done < <(grep -roE --include='*.md' --include='*.ts' --exclude-dir=node_modules --exclude-dir=archive \
    'github\.com/verhoturkin/teacher-box/wiki/[^)#" ]+' README.md docs .claude frontend/src backend/src 2>/dev/null |
    sed 's#github\.com/verhoturkin/teacher-box/wiki/##' || true)

[ "$status" -eq 0 ] && echo "Wiki links are valid"
exit "$status"
