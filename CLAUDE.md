# CLAUDE.md

Project rules, architecture, commands and conventions — in AGENTS.md (single source for all agents):

@AGENTS.md

Claude Code specifics below.

## Workflow

1. **Work from the plan.** Find the task's substep in `docs/PLAN.md`. Not there — add it first (or ask
   the user). Write plans in English. Don't read `docs/plan-archive/` or whole `docs/audit/` files unless
   the task needs them (history, cited DA-xxx findings) — grep for the specific item instead.
2. **Contract and tests first.** New use case: `api` facade/DTO/event → test → implementation. REST —
   controller test with role checks first.
3. **Module isolation is a hard rule.** Before importing from another module, make sure the class is in
   its `api` package and the dependency is allowed in `package-info.java` (AGENTS.md §4.2). Need another
   module's data — add a facade method or subscribe to an event; never read another module's schema.
4. **Verify before committing (mandatory):**
   - backend touched → `cd backend && ./mvnw clean verify` (Windows: `.\mvnw.cmd clean verify`; `clean`
     is required — after `-Pbundle-frontend` the SPA stays in `target/classes/static`);
   - frontend touched → `cd frontend && npm run lint && npm test && npm run build`;
   - Docker files touched → `docker compose -f <file> config` and, if the daemon is up, a build.
   Commit only when green. On failure fix the cause — never lower coverage gates or lint rules, never
   `--no-verify`.
5. After a substep, tick its checkbox in `docs/PLAN.md` in the same commit. After a release, archive it
   (see `docs/PLAN.md` → "How to use").

## Developer environment

- Windows 11, PowerShell 5.1 (no `&&` — use `;` and `if ($?)`); Git Bash for `*.sh`.
- JDK 25, Maven 3.9 (use `mvnw`), Node 22, npm 10 (install packages with `npx -y npm@11 ci|install` —
  ADR-0007), Docker (daemon may be down — check `docker info`).
- Files: UTF-8 without BOM, LF line endings (`.gitattributes`).

## Up-to-date knowledge

Angular 21, PrimeNG 21, Spring Boot 4.1, Spring Security 7, Spring Modulith 2.1, Jackson 3, JUnit 6 are
newer than most online examples. Before using an unfamiliar API, **check current docs** (context7 MCP),
not memory. Common traps:
- Boot 4: modular starters (`spring-boot-starter-webmvc`, `spring-boot-starter-flyway`,
  `spring-boot-starter-webmvc-test`, …); Jackson 3 lives in package `tools.jackson`.
- Angular 21: zoneless, standalone by default; `ng test` = Vitest.
- **Never upgrade PrimeNG/@primeuix/themes/primeicons to 22/3/8** — commercial PrimeUI license
  (ADR-0007). Angular — 21.x only.
- PrimeNG 21 themes: `providePrimeNG({ theme: { preset: Aura } })` from `@primeuix/themes`.
- `ai` module: load the `claude-api` skill before changing Claude/LLM integration code (models,
  parameters, limits).

## Replies to the user

- The user writes in Russian — reply in Russian.
- Report checks honestly: what ran, what passed, what didn't.
