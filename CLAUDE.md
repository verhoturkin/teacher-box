# CLAUDE.md

Project rules — in AGENTS.md (single source for all agents, including workflow §10, context economy §11,
environment §12, replies §14); `backend/` and `frontend/` have their own CLAUDE.md → AGENTS.md, loaded when you
work there. Add new shared rules to AGENTS.md, not here.

@AGENTS.md

## Claude Code specifics

- Broad searches across many files — delegate to the Explore subagent.
- Project subagent `docs-sync` (Sonnet, `.claude/agents/`) — only when a change touches 3 or more docs, or to
  sync docs before a release; a subagent starts cold and costs more for one doc.
- Don't run `npm run format` for files you edited: the PostToolUse hook in `.claude/settings.json` formats them.
- Browser checks: `read_page` / `get_page_text` first, one final screenshot with `scale: 0.5`.
- `package-lock.json`, build output, `docs/assets/` and the help-articles fixture are unreadable
  (`permissions.deny` in `.claude/settings.json`).
- A whole-file Read of a file over 40 KB is refused (PreToolUse hook `.claude/hooks/big-read.mjs`):
  grep the outline, then Read with `offset`/`limit`.
- Output limits (`env` in `.claude/settings.json`): Bash 20 000 characters, MCP 15 000 tokens;
  longer output is cut or saved to a file.
- Library docs — context7 MCP.
