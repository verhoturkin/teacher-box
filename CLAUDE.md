# CLAUDE.md

Project rules — in AGENTS.md (single source for all agents); `backend/` and `frontend/` have their own
CLAUDE.md → AGENTS.md, loaded when you work there.

@AGENTS.md

## Workflow

1. **Work from the plan.** Find the task's substep in `docs/PLAN.md`; not there — add it first (or ask the user).
   Plans are written in English. Read only what AGENTS.md §2 lists for the task; `docs/archive/` only when
   history is needed, and grep for the item instead of reading whole files.
2. **Contract and tests first.** New use case: `api` facade/DTO/event → test → implementation. REST — controller
   test with role checks first.
3. **Module isolation is a hard rule** (AGENTS.md §4.2). Need another module's data — add a facade method or
   subscribe to an event; never read another module's schema.
4. **Verify before committing** (mandatory, see AGENTS.md §8): backend → `./mvnw clean verify`; frontend →
   `npm run lint && npm test && npm run build`; Docker files → `docker compose -f <file> config` (+ build if the
   daemon is up). Commit only when green; fix causes, never `--no-verify`.
5. Tick the substep in `docs/PLAN.md` in the same commit; release — skill `release`.
6. Keep docs current in the same commit: `docs/modules/<m>.md` for module behaviour, `docs/design-system.md`
   for UI rules, ADR index for new ADRs.

## Context economy

- Read the part of a file you need (`offset`/`limit`, Grep with context) rather than whole large files
  (`styles.scss`, `teacher-box-preset.ts`, help articles, CHANGELOG).
- Broad searches across many files ("where is X used", "how do modules do Y") — delegate to the Explore subagent
  and take its conclusion, not the file dumps.
- Targeted tests while iterating, `verify.sh` once before the commit (AGENTS.md §5). Don't run `npm run format`
  for files you edited: the PostToolUse hook in `.claude/settings.json` formats them.
- `package-lock.json` files are not readable (`permissions.deny`); check versions with `npm ls <pkg>`.

## Developer environment

- Windows 11, PowerShell 5.1 (no `&&` — use `;` and `if ($?)`); Git Bash for `*.sh`.
- JDK 25, Maven 3.9 (use `mvnw`), Node 22, npm 10 (install with `npx -y npm@11 ci|install` — ADR-0007), Docker
  (daemon may be down — check `docker info`).
- Files: UTF-8 without BOM, LF (`.gitattributes`).

## Up-to-date knowledge

Angular 21, PrimeNG 21, Spring Boot 4.1, Spring Security 7, Spring Modulith 2.1, Jackson 3, JUnit 6 are newer than
most online examples: **check current docs** (context7 MCP) before using an unfamiliar API. Version traps are in
the nested AGENTS.md files.

## Replies to the user

- The user writes in Russian — reply in Russian.
- Report checks honestly: what ran, what passed, what didn't.
