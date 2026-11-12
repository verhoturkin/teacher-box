#!/usr/bin/env bash
#
# Prepares a fresh clone for an agent (docs/agent-environment.md): the cloud environment's setup script.
# Idempotent: a second run changes nothing.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git config core.hooksPath .githooks

for dir in frontend e2e; do
    if [ ! -d "$dir/node_modules" ]; then
        # npm >= 11 is required (ADR-0007); npx fetches it when the local npm is older.
        (cd "$dir" && npx -y npm@11 ci --no-audit --no-fund)
    fi
done
