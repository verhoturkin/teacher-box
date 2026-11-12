# AGENTS.md — Teacher Box

Single source of rules for agents and humans; `CLAUDE.md` imports it. Nested `backend/` and
`frontend/` `AGENTS.md` load when you work there. Layout, all commands, environments —
[`docs/agent-environment.md`](docs/agent-environment.md).

## 1. Project

**Teacher Box** — self-hosted portal for a tutor. **One instance = one teacher** (created on first
start from env vars; no public sign-up). **Many students:** the teacher sends an invite link; the
student sets login and password and gets a cabinet (ЛК). An `ADMIN` account is technical only.

Modules (facts — `docs/modules/<module>.md`; `shared` — `backend/AGENTS.md`): `identity` (auth,
invites, groups), `billing` (charges, payments, balance), `homework`, `notifications` (inbox,
Telegram / VK / MAX, bots), `ai` (LLM drafts), `schedule` (lessons, attendance, calendars),
`meetings` (Telemost rooms), `boards`, `textbooks`; `platform` — infrastructure, `shared` — kernel.

Stack: Java 25, Spring Boot 4.1, Modulith 2.1, Security 7, `JdbcClient` + Flyway, H2, Maven;
Angular 21.2 (standalone, signals, zoneless), PrimeNG 21.1 (M3 Expressive), TypeScript 5.9 strict,
Vitest; Docker Compose, GHCR images.

## 2. What to read

| Task | Read |
|---|---|
| Any | this file, [`docs/PLAN.md`](docs/PLAN.md) |
| Backend code | `backend/AGENTS.md` + `docs/modules/<m>.md` |
| Frontend code | `frontend/AGENTS.md` + the section of `docs/design-system.md` and the screen in `docs/screens.md` |
| UI texts, help, wiki | `docs/glossary.md`, `docs/writing.md` |
| Why a decision was made | `docs/adr/README.md` → the ADR |
| Release, new module, new env var | skills `release`, `new-module`, `new-setting` |
| Redesign history, running the product | [`docs/agent-environment.md`](docs/agent-environment.md) |

**Don't read unless needed:** `docs/archive/` (hidden by `.ignore`; find an item with
`rg --no-ignore DA-081 docs/archive`), old `CHANGELOG.md` entries, whole ADRs when the spec answers.

## 3. Repository layout — [`docs/agent-environment.md`](docs/agent-environment.md)

## 4. Architecture and module isolation

Modular monolith on Spring Modulith; a business module is a direct subpackage of `ru.teacherbox`.
Module structure (4.1) — `backend/AGENTS.md`.

### 4.2 Isolation rules (enforced by tests — violation = red build)

1. **Code:** a module uses another only via its `api` package; no cycles (`ModularityTests` —
   `ApplicationModules.verify()`, ArchUnit).
2. **Allowed dependencies** (declared in `package-info.java`):

   | Module | May depend on |
   |---|---|
   | `shared` | — |
   | `platform`, `identity` | `shared` |
   | `meetings`, `boards`, `textbooks` | `shared`, `identity::api` |
   | `billing` | `shared`, `identity::api`, `schedule::api` (events only: lesson outcome → charge) |
   | `homework` | `shared`, `identity::api`, `textbooks::api` (summaries and pages of bound textbooks) |
   | `notifications` | `shared`, `identity::api` (recipients and their languages; ADR-0061) |
   | `ai` | `shared`, `textbooks::api`, `homework::api` (sources of drafts, ADR-0039) |
   | `schedule` | `shared`, `identity::api`, `meetings::api` (room links) |

   Business modules never depend on `platform`; `platform` knows no business module (it collects SPI
   beans).
3. **Data:** own schema per module (`platform` too), own Flyway migrations in
   `db/migration/<module>/` and history table. **Forbidden:** SQL to another schema, cross-schema
   FKs and JOINs (`SchemaIsolationTests`); only UUIDs cross module boundaries.
4. **Interaction:** sync — another module's `api` facade (reads/checks only); async — domain events
   (`@ApplicationModuleListener`). Producers don't know consumers. A notification is written by
   the module it is about and published as `shared.notice.NoticeRequested` (ADR-0061).
5. **Files:** only the module's own `FileStorage` namespace; absolute links only via
   `Portal.link(...)`.
6. **Frontend** mirrors the boundaries (`@features/<name>`, `@features/<name>/parts`, feature
   directions) — `frontend/AGENTS.md`, ADR-0058.

### 4.3 Roles and access

- `TEACHER` — all data of the instance. `STUDENT` — own data only: every endpoint returning student
  data checks `studentId` == current user (or `TEACHER`) and has a test "another student gets
  403/404".
- `ADMIN` (ADR-0010) — only `/api/admin/**`, `/api/me`, `/api/me/password`, `/api/me/language`;
  **no student data** — IDs and technical data only.
- REST prefixes: `/api/auth/**` (public), `/api/public/**` (secret link, no login), `/api/teacher/**`,
  `/api/admin/**` (`/api/admin/<module>/**`), `/api/me/**` (cabinet), `/api/<module>/**`.
- Logs hold no personal data (IDs only). Dangerous actions (restore, reset) need the user's
  password. Bot actions check rights like REST.

## 5. Commands

```bash
./scripts/verify.sh [backend|frontend|e2e|docs|docker|installer]  # all = pre-commit = CI
cd backend && ./mvnw -q test -Dtest=<Class>
cd frontend && npm run test:only -- <path>
cd frontend && npx -y npm@11 ci                                    # npm >= 11
```

The full list, Windows notes and how the hook uses stamps — `docs/agent-environment.md`. **While
iterating run only the affected tests**; `./scripts/verify.sh <part>` once, after the final edit
with everything staged. A failed step prints its log tail: read it, then grep
`.verify-logs/<step>.log`; no whole logs, no verbose reruns.

## 6. Conventions

- Wrap Markdown prose and list items at 100 columns, continuation indentation included; check added
  and edited lines in every changed `.md` before committing. Tables, fenced code and unbreakable
  URLs may exceed it.
- Languages — `docs/writing.md`: code, commits, agent files, plan, developer docs — English; README,
  operations, glossary, ADRs, CHANGELOG, wiki — Russian; product copy and help — both together. A
  user-visible change edits its `docs/wiki/<Page>.md` in the same commit, never the GitHub wiki.
- No secrets in the repo. A setting has an owner (teacher / administrator / deployment-only) in
  `platform.settings.SettingsCatalog` — skill `new-setting`.
- Time in UTC (`Instant`); teacher time zone — `shared.time.InstanceTimeZone`, read per call.
  Money — `long` minor units + instance currency, never `double`.
- An architecture change → a new ADR (row in `docs/adr/README.md`) and an update of the spec it
  changes.
- 6.2 Backend — `backend/AGENTS.md`. 6.3 Frontend — `frontend/AGENTS.md`, `docs/design-system.md`;
  **every interface change is made with the `m3-expressive` skill** (how — `frontend/AGENTS.md`).

## 7. Testing

All code is tested, tests come with (or before) the code; kinds — nested AGENTS.md, E2E —
`e2e/README.md`. Gates: backend JaCoCo lines ≥ 90 %, branches ≥ 80 %; frontend Vitest
lines/statements/functions ≥ 90 %, branches ≥ 80 %. Never lower gates or lint rules to get green.

## 8. Commits

1. **A new branch starts from the latest `main`:** `git fetch origin`, `git switch -c <branch>
   origin/main`. A long-lived branch takes `main` with `git merge origin/main`.
2. Checks of the touched parts pass before every commit (hook `.githooks/pre-commit`, enable with
   `git config core.hooksPath .githooks`). Never `--no-verify`.
3. Conventional Commits: `feat(billing): record lesson payments`, `fix(identity): …`, `test`,
   `docs`, `build`, `chore`. Scope — module or `frontend`, `docker`, `platform`.
4. One commit = one complete logical unit (usually a plan substep); tick its checkbox in
   `docs/PLAN.md` in the same commit; archive the release per `docs/PLAN.md`.

## 9. Definition of Done

- [ ] §4 and §6 (with nested AGENTS.md, design system, `m3-expressive`) followed; tests written,
  `./scripts/verify.sh` green, gates met; checkbox in `docs/PLAN.md` ticked.
- [ ] New setting → skill `new-setting`. User-visible change → wiki pages and help articles in
  every language. New shared component or variant → its sample in `features/gallery/` (ADR-0059).
- [ ] Architecture change → ADR; changed behaviour → `docs/modules/<m>.md`, `docs/design-system.md`,
  `docs/screens.md` updated.

## 10. Workflow

1. **Work from the plan.** Find the task's substep in `docs/PLAN.md`; not there — add it first (or
   ask the user). Plans are in English. A new substep gets a complexity mark, *simple* or
   *complex* (`docs/PLAN.md` "How to use").
2. **Contract and tests first.** New use case: `api` facade/DTO/event → test → implementation. REST
   — controller test with role checks first.
3. Another module's data — add a facade method or subscribe to an event (§4.2).
4. Release — skill `release`. Docs go with the code (§9).

## 11. Context economy

- Read only what §2 lists, and only the part you need. A big doc: `grep -n '^##' <file>` for the
  outline, then Read the section with offset/limit (`styles.scss`, `teacher-box-preset.ts`, help
  articles, CHANGELOG, `docs/design-system.md`). Grep `docs/archive/` for an item, don't read it.
- Broad searches — a search sub-agent, take its conclusion; one doc edit or a checkbox — inline.
- Targeted tests while iterating (§5). No `npm run format` for files a hook formats.
- Browser checks only for UI changes: text tools first, one final screenshot.
- `package-lock.json` and build output (`dist`, `target/classes`, `node_modules`, HTML coverage,
  `backend/data`) are noise: don't read them; check versions with `npm ls <pkg>`.

## 12. Developer environment — [`docs/agent-environment.md`](docs/agent-environment.md)

Local Windows 11 + PowerShell; cloud Linux without JDK 25, Docker and E2E: run what works, say in
the reply and the PR what was not run; never claim an unrun check green.

## 13. Up-to-date knowledge

The stack (and Jackson 3, JUnit 6) is newer than most online examples: check current docs (context7
MCP or the official site) before an unfamiliar API. Version traps — in the nested AGENTS.md files.

## 14. Replies to the user

- The user writes in Russian — reply in Russian.
- Report checks honestly: what ran, what passed, what didn't.
