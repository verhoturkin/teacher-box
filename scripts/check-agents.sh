#!/usr/bin/env bash
#
# Agent configs for Claude Code and Codex stay one source (AGENTS.md): the copies must not drift.
#   .claude/skills/*          == .agents/skills/*
#   .claude/hooks/format.mjs  == .codex/hooks/format.mjs
#   the docs-sync agent exists for both, with the same description
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
errors=0
fail() { echo "check-agents: $*" >&2; errors=$((errors + 1)); }

diff -r .claude/skills .agents/skills >/dev/null 2>&1 ||
    fail ".claude/skills and .agents/skills differ (diff -r .claude/skills .agents/skills)"
cmp -s .claude/hooks/format.mjs .codex/hooks/format.mjs ||
    fail ".claude/hooks/format.mjs and .codex/hooks/format.mjs differ"

claude_agent=.claude/agents/docs-sync.md
codex_agent=.codex/agents/docs-sync.toml
for f in "$claude_agent" "$codex_agent"; do
    [ -f "$f" ] || fail "missing agent $f"
done
if [ -f "$claude_agent" ] && [ -f "$codex_agent" ]; then
    a="$(sed -n 's/^description: //p' "$claude_agent" | head -n 1)"
    b="$(sed -n 's/^description = "\(.*\)"$/\1/p' "$codex_agent" | head -n 1)"
    [ -n "$a" ] && [ "$a" = "$b" ] || fail "the docs-sync descriptions differ between $claude_agent and $codex_agent"
fi

[ "$errors" -eq 0 ] || exit 1
echo "agent configs are in sync"
