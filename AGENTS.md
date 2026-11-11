# AGENTS.md — Teacher Box

Single source of rules for agents and humans; `CLAUDE.md` imports it. Nested `backend/` and
`frontend/` `AGENTS.md` load when you work there.

## 1. Project

**Teacher Box** — self-hosted portal for a tutor. **One instance = one teacher** (created on first
start from env vars; no public sign-up). **Many students:** the teacher sends an invite link; the
student sets login and password and gets a cabinet (ЛК). An `ADMIN` account is technical only.

| Module | Purpose |
|---|---|
| `identity` | auth (invites, JWT, refresh tokens), student groups |
| `billing` | lesson charges, payments, balance, reports, prices |
| `homework` | assign, submit, review, attachments |
| `notifications` | inbox, Telegram / VK / MAX delivery, bot dialogs |
| `ai` | LLM drafts of tasks and reviews |
| `schedule` | lessons, series, attendance, requests, reminders, ICS, Google Calendar |
| `meetings` | permanent Yandex Telemost rooms |
| `boards` | Excalidraw boards and external boards by link |
| `textbooks` | textbooks and workbooks, pages for homework and boards |
| `platform` / `shared` | infrastructure / shared kernel |

Module facts: `docs/modules/<module>.md` (`platform` — [platform](docs/modules/platform.md);
`shared` — [backend](backend/AGENTS.md)).

Stack: Java 25, Spring Boot 4.1, Spring Modulith 2.1, Spring Security 7, `JdbcClient` + Flyway, H2
(schema per module), Maven (`mvnw`); Angular 21.2 LTS (standalone, signals, zoneless), PrimeNG 21.1
with an M3 Expressive preset, TypeScript 5.9 strict, Vitest; Docker Compose — nginx + backend
([ADR-0031](docs/adr/0031-split-variant-only.md)), images in GHCR
([ADR-0032](docs/adr/0032-ready-images-and-installer.md)).

## 2. What to read

| Task | Read |
|---|---|
| Any | this file, [`docs/PLAN.md`](docs/PLAN.md) |
| Backend code | `backend/AGENTS.md` (auto-loaded there) + the module's `docs/modules/<m>.md` |
| Frontend code | `frontend/AGENTS.md` + the section of [`docs/design-system.md`](docs/design-system.md) and the screen in [`docs/screens.md`](docs/screens.md) |
| UI texts, help, wiki | [`docs/glossary.md`](docs/glossary.md), [`docs/writing.md`](docs/writing.md) |
| History of the 2026-10 redesign (stages 229–249) | [`docs/archive/redesign-2026-10/README.md`](docs/archive/redesign-2026-10/README.md) — only for history |
| Why a decision was made | [`docs/adr/README.md`](docs/adr/README.md) → the specific ADR |
| Release, new module, new env var | skills `.claude/skills/{release,new-module,new-setting}` |
| Running the product | `README.md`, `docs/operations.md`, `docs/wiki/` (the [wiki](https://github.com/verhoturkin/teacher-box/wiki), Russian) |

**Don't read unless needed:** `docs/archive/` (left out of searches by `.ignore` — find an item with
`rg --no-ignore DA-081 docs/archive`), old `CHANGELOG.md` entries (only the top one), whole ADRs
when the spec answers.

## 3. Repository layout

```
docs/          PLAN.md, design-system.md, screens.md, glossary.md, writing.md, operations.md, modules/, adr/, archive/, wiki/, sketches/
backend/       Spring Boot app — src/main/java/ru/teacherbox/{shared,platform,<modules>}
frontend/      Angular app — src/app/{core,shared,features/<module>}
docker/        Dockerfile (targets backend, frontend), nginx
compose.yaml   ready GHCR images;  compose.build.yaml — override that builds from the source
e2e/           Playwright tests against a running instance
scripts/       verify.sh (all checks = pre-commit = CI), e2e.sh, agent-setup.sh, check-agents.sh, publish-wiki.sh
.env.example   every TEACHERBOX_* variable;  .githooks/pre-commit;  .github/workflows/
```

## 4. Architecture and module isolation

Modular monolith on Spring Modulith ([ADR-0001](docs/adr/0001-modular-monolith.md)); a business
module is a direct subpackage of `ru.teacherbox`.

### 4.1 Module structure

Only in [`backend/AGENTS.md`](backend/AGENTS.md).

### 4.2 Isolation rules (enforced by tests — violation = red build)

1. **Code:** a module uses another only via its `api` package; everything else is internal. No
   cycles. Checked by `ModularityTests` (`ApplicationModules.verify()`) + ArchUnit.
2. **Allowed dependencies** (declared in `package-info.java`):

   | Module | May depend on |
   |---|---|
   | `shared` | — |
   | `platform`, `identity` | `shared` |
   | `billing` | `shared`, `identity::api`, `schedule::api` (events only: lesson outcome → charge) |
   | `homework` | `shared`, `identity::api`, `textbooks::api` (summaries and pages of bound textbooks) |
   | `notifications` | `shared`, `identity::api` (recipients and their languages; the modules write their notices — `shared.notice`, ADR-0061) |
   | `ai` | `shared`, `textbooks::api`, `homework::api` (sources of drafts, ADR-0039) |
   | `schedule` | `shared`, `identity::api`, `meetings::api` (room links) |
   | `meetings`, `boards`, `textbooks` | `shared`, `identity::api` |

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
6. **Frontend** mirrors the boundaries: a feature imports another only via `@features/<name>`
   (`index.ts`, pages) or `@features/<name>/parts` (`parts.ts`, widgets/API/types); shared code only
   from `core/` and `shared/` (ESLint `no-restricted-imports`). Features depend on each other in
   one direction — the table in `frontend/AGENTS.md`
   ([ADR-0058](docs/adr/0058-frontend-feature-directions.md)); it follows screen embedding and is
   not a copy of the table above.

### 4.3 Roles and access

- `TEACHER` — all data of the instance. `STUDENT` — own data only: every endpoint returning student
  data checks `studentId` == current user (or `TEACHER`) and has a test "another student gets
  403/404".
- `ADMIN` ([ADR-0010](docs/adr/0010-administrator-and-diagnostics.md)) — only `/api/admin/**`,
  `/api/me`, `/api/me/password`, `/api/me/language`; **no student data** — IDs and technical data
  only.
- REST prefixes: `/api/auth/**` (public), `/api/public/**` (secret link, no login — e.g. calendar
  feed), `/api/teacher/**`, `/api/admin/**` (module data at `/api/admin/<module>/**`), `/api/me/**`
  (teacher and student cabinet), `/api/<module>/**` per module rules.
- Logs hold no personal data (IDs only). Dangerous actions (restore, reset) need the user's
  password. Bot actions check rights like REST.

## 5. Commands

```bash
./scripts/verify.sh                    # all checks (= pre-commit = CI); full logs in .verify-logs/
./scripts/verify.sh backend|frontend   # one part
./scripts/verify.sh e2e                # the E2E tests compile
./scripts/verify.sh docs               # wiki links, agent configs in sync, stamp test
./scripts/verify.sh docker             # compose files, image build, nginx config + installer
./scripts/verify.sh installer          # only shellcheck of scripts/ and the dry run of install.sh
cd backend && ./mvnw clean verify      # tests + JaCoCo gates + Modulith verify
cd backend && ./mvnw spring-boot:run   # API :8080, data in ./backend/data
cd frontend && npx -y npm@11 ci        # npm >= 11 (ADR-0007)
cd frontend && npm run lint && npm test && npm run build
cd frontend && npm start               # :4200, proxy /api -> :8080
./scripts/e2e.sh                       # Playwright, fresh instance (:8091); locally E2E_BROWSER_CHANNEL=chrome
docker compose -f compose.yaml -f compose.build.yaml up -d --build   # build from the source
```

Windows: `mvnw.cmd`, bash scripts via Git Bash. **While iterating run only the affected tests**
(`npm run test:only -- <path>`, `./mvnw -q test -Dtest=<Class>`); `./scripts/verify.sh <part>` once
before committing. A failed step prints its log tail: read it, then grep `.verify-logs/<step>.log`;
no whole logs, no verbose reruns. A part that passes writes `.verify-logs/<part>.ok` (fingerprint of
the whole tree) and the pre-commit hook skips a part with a matching stamp, so run `verify.sh
<part>` after the final edit; a part with a skipped check leaves no stamp.

## 6. Conventions

### 6.1 General
- Wrap Markdown prose and list items at 100 columns, continuation indentation included; check added
  and edited lines in every changed `.md` before committing. Tables, fenced code and unbreakable
  URLs may exceed it.
- Languages, help articles, wiki — [`docs/writing.md`](docs/writing.md). In short: code, comments,
  commits, agent files, plan and developer docs are English; README, `docs/operations.md`, glossary,
  ADRs, CHANGELOG and the wiki are Russian; product copy and help are written in both languages
  together. A user-visible change edits its `docs/wiki/<Page>.md` in the same commit; never edit the
  GitHub wiki by hand.
- No secrets in the repo. Settings only via `TEACHERBOX_*` env vars; each new one → `.env.example`,
  `platform.settings.SettingsCatalog` ([ADR-0016](docs/adr/0016-admin-settings.md)), wiki (skill
  `new-setting`).
- Time in UTC (`Instant`); teacher time zone — `shared.time.InstanceTimeZone`, read per call.
  Money — `long` minor units + instance currency, never `double`.
- An architecture change → a new ADR (row in `docs/adr/README.md`) and an update of the spec it
  changes.

### 6.2 Backend — [`backend/AGENTS.md`](backend/AGENTS.md)

### 6.3 Frontend — [`frontend/AGENTS.md`](frontend/AGENTS.md) and [`docs/design-system.md`](docs/design-system.md)

**Every interface change is made with the `m3-expressive` skill:** load it before touching templates
or styles, take M3 values from its references, mark anything M3 does not publish as our decision (as
`docs/design-system.md` does). Without it follow m3.material.io.

## 7. Testing

E2E rules (functional suites, no `version-X-Y-Z.spec.ts`, `operations` project) — `e2e/README.md`.

All code is tested; the build fails below the gates. Test kinds — in the nested AGENTS.md files.

| Part | Tool | Gate |
|---|---|---|
| Backend | JaCoCo (`mvnw verify`) | lines ≥ 90 %, branches ≥ 80 % |
| Frontend | Vitest coverage (`npm test`) | lines/statements/functions ≥ 90 %, branches ≥ 80 % |

Tests come with (or before) the code. Never lower gates or lint rules to get green.

## 8. Commits

1. **A new branch starts from the latest `main`:** `git fetch origin`, `git switch -c <branch>
   origin/main` (stages continue from `main`). A long-lived branch takes `main` with `git merge
   origin/main`.
2. Checks of the touched parts pass before every commit (hook `.githooks/pre-commit`, enable with
   `git config core.hooksPath .githooks`). Never `--no-verify`.
3. Conventional Commits: `feat(billing): record lesson payments`, `fix(identity): …`, `test`,
   `docs`, `build`, `chore`. Scope — module or `frontend`, `docker`, `platform`.
4. One commit = one complete logical unit (usually a plan substep); tick its checkbox in
   `docs/PLAN.md` in the same commit; archive the release per `docs/PLAN.md`.

## 9. Definition of Done

- [ ] Isolation rules (§4) and conventions (§6, nested AGENTS.md, design system) followed.
- [ ] Tests written, `./scripts/verify.sh` green, gates met.
- [ ] New env vars in `.env.example`, `SettingsCatalog`, wiki user docs.
- [ ] User-visible change → wiki pages and help articles in every language
      ([`docs/writing.md`](docs/writing.md)).
- [ ] Interface change → made with the `m3-expressive` skill (§6.3).
- [ ] New shared component or variant → its sample in `frontend/src/app/features/gallery/` in the
  same commit (ADR-0059).
- [ ] Architecture change → ADR; changed behaviour → `docs/modules/<m>.md`, `docs/design-system.md`,
  `docs/screens.md` updated.
- [ ] Checkbox in `docs/PLAN.md` ticked.

## 10. Workflow

What §5 (commands), §8 (commits) and §9 (done) do not already say:

1. **Work from the plan.** Find the task's substep in `docs/PLAN.md`; not there — add it first (or
   ask the user). Plans are in English. Read only what §2 lists; grep `docs/archive/` for an item
   instead of reading it.
2. **Contract and tests first.** New use case: `api` facade/DTO/event → test → implementation. REST
   — controller test with role checks first.
3. **Module isolation is a hard rule** (§4.2): need another module's data — add a facade method or
   subscribe to an event.
4. Release — skill `.claude/skills/release/SKILL.md`. Docs go with the code (§9).

## 11. Context economy

- Read the part of a file you need (offset/limit, grep), not whole large files (`styles.scss`,
  `teacher-box-preset.ts`, help articles, CHANGELOG). Broad searches — a search sub-agent, take its
  conclusion. Ticking the PLAN.md checkbox or editing one doc — inline.
- Targeted tests while iterating, `verify.sh` once before the commit (§5). No `npm run format` for
  files a hook formats.
- Browser checks only for UI changes: text tools first (page text, console, network), one final
  screenshot.
- `package-lock.json` and build output (`dist`, `target/classes`, `node_modules`, HTML coverage,
  `backend/data`) are noise: don't read them; check versions with `npm ls <pkg>`.

## 12. Developer environment

**Local:**

- Windows 11, PowerShell 5.1 (no `&&` — use `;` and `if ($?)`); Git Bash for `*.sh`.
- JDK 25, Maven 3.9 (use `mvnw`), Node 22, npm 10 (install with `npx -y npm@11 ci|install` —
  ADR-0007), Docker (daemon may be down — check `docker info`).
- Files: UTF-8 no BOM, LF.

**Cloud** (Linux container; setup script `scripts/agent-setup.sh` — hooks path, `npm ci` in
`frontend/`, `e2e/`):

- No JDK 25, no Docker daemon, no E2E runs. Run what works (`./scripts/verify.sh frontend|docs|e2e`,
  shellcheck when available); say in the reply and the PR what was not run and why; never claim an
  unrun check green. Backend is verified by CI on the pull request; never weaken a check to get green.

## 13. Up-to-date knowledge

Angular 21, PrimeNG 21, Spring Boot 4.1, Security 7, Modulith 2.1, Jackson 3, JUnit 6 are newer than
most online examples: **check current docs** (context7 MCP or the official site) before an
unfamiliar API. Version traps — in the nested AGENTS.md files.

## 14. Replies to the user

- The user writes in Russian — reply in Russian.
- Report checks honestly: what ran, what passed, what didn't.
