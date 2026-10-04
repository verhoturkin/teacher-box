# AGENTS.md — Teacher Box

Single source of rules for AI agents and humans (Claude Code, Codex, Cursor, Copilot…); `CLAUDE.md` imports it.
Part-specific rules load from the nested `backend/AGENTS.md` and `frontend/AGENTS.md`.

## 1. Project

**Teacher Box** — self-hosted portal for a tutor. **One instance = one teacher** (created on first start from
env vars; no public sign-up). **Many students:** the teacher adds a student and sends an invite link; the
student sets login and password and gets a cabinet (ЛК). An `ADMIN` account is technical only.

| Module | Purpose | Doc |
|---|---|---|
| `identity` | auth (invites, JWT, refresh tokens), student groups | [identity](docs/modules/identity.md) |
| `billing` | lesson charges, payments, balance, reports, prices | [billing](docs/modules/billing.md) |
| `homework` | assign, submit, review, attachments | [homework](docs/modules/homework.md) |
| `notifications` | inbox, Telegram / VK / MAX delivery, bot dialogs | [notifications](docs/modules/notifications.md) |
| `ai` | LLM drafts of tasks and reviews | [ai](docs/modules/ai.md) |
| `schedule` | lessons, series, attendance, requests, reminders, ICS, Google Calendar | [schedule](docs/modules/schedule.md) |
| `meetings` | permanent Yandex Telemost rooms | [meetings](docs/modules/meetings.md) |
| `boards` | Холст boards by link | [boards](docs/modules/boards.md) |
| `platform` / `shared` | infrastructure / shared kernel | [platform](docs/modules/platform.md), [backend](backend/AGENTS.md) |

Stack: Java 25, Spring Boot 4.1, Spring Modulith 2.1, Spring Security 7, `JdbcClient` + Flyway, H2 (file,
schema per module), Maven (`mvnw`); Angular 21.2 LTS (standalone, signals, zoneless), PrimeNG 21.1 (MIT) with an
M3 Expressive preset, TypeScript 5.9 strict, Vitest; Docker Compose — split or single.

## 2. What to read

| Task | Read |
|---|---|
| Any | this file, [`docs/PLAN.md`](docs/PLAN.md) |
| Backend code | `backend/AGENTS.md` (auto-loaded there) + the module's `docs/modules/<m>.md` |
| Frontend code | `frontend/AGENTS.md` + the relevant section of [`docs/design-system.md`](docs/design-system.md) |
| UI texts | [`docs/glossary.md`](docs/glossary.md) (Russian wording) |
| Why a decision was made | [`docs/adr/README.md`](docs/adr/README.md) → the specific ADR |
| Release, new module, new env var | skills `.claude/skills/{release,new-module,new-setting}/SKILL.md` |
| Running the product | `README.md`, `docs/operations.md` (Russian, for users) |

**Don't read unless the task needs it:** `docs/archive/` (completed plans, design audit — grep for the
specific item, e.g. `DA-081`), old `CHANGELOG.md` entries (only the top one), whole ADRs when the spec answers.

## 3. Repository layout

```
docs/          PLAN.md, design-system.md, glossary.md, operations.md, modules/, adr/, archive/
backend/       Spring Boot app — src/main/java/ru/teacherbox/{shared,platform,<modules>}
frontend/      Angular app — src/app/{core,shared,features/<module>}
docker/        Dockerfile (targets backend, frontend, single) and nginx; compose.split.yaml, compose.single.yaml
e2e/           Playwright tests against a running instance
scripts/       verify.sh (all checks = pre-commit = CI), e2e.sh (E2E on a fresh single container)
.env.example   every TEACHERBOX_* variable;  .githooks/pre-commit;  .github/workflows/ci.yml
```

## 4. Architecture and module isolation

Modular monolith on Spring Modulith ([ADR-0001](docs/adr/0001-modular-monolith.md)); each business module is
a direct subpackage of `ru.teacherbox`.

### 4.1 Module structure

`api/` (public: facades, DTOs, events) · `domain/` · `application/` · `persistence/` · `web/` · adapters —
details in [`backend/AGENTS.md`](backend/AGENTS.md).

### 4.2 Isolation rules (enforced by tests — violation = red build)

1. **Code:** a module uses another only via its `api` package; everything else is internal. No cycles.
   Checked by `ModularityTests` (`ApplicationModules.verify()`) + ArchUnit.
2. **Allowed dependencies** (declared in `package-info.java`):

   | Module | May depend on |
   |---|---|
   | `shared` | — |
   | `platform` | `shared` |
   | `identity` | `shared` |
   | `billing` | `shared`, `identity::api`, `schedule::api` (events only: lesson outcome → charge) |
   | `homework` | `shared`, `identity::api` |
   | `notifications` | `shared`, `identity::api` (events and facades), `billing::api`, `homework::api`, `schedule::api`, `meetings::api` (events only) |
   | `ai` | `shared` |
   | `schedule` | `shared`, `identity::api`, `meetings::api` (room links) |
   | `meetings` | `shared`, `identity::api` |
   | `boards` | `shared`, `identity::api` |

   Business modules never depend on `platform`; `platform` knows no business module (it collects SPI beans).
3. **Data:** own schema per module (`platform` too), own Flyway migrations in `db/migration/<module>/` and history
   table. **Forbidden:** SQL to another schema, cross-schema FKs and JOINs (`SchemaIsolationTests`). Only UUIDs
   cross module boundaries.
4. **Interaction:** sync — another module's `api` facade (reads/checks only); async — domain events
   (`@ApplicationModuleListener`, Event Publication Registry). Producers don't know consumers.
5. **Files:** only the module's own namespace of `FileStorage` (`/data/files/<module>/`).
6. **Frontend** mirrors the boundaries: a feature imports another only via `@features/<name>` (`index.ts`, pages)
   or `@features/<name>/parts` (`parts.ts`, widgets/API/types); shared code only from `core/` and `shared/`
   (ESLint `no-restricted-imports`).

### 4.3 Roles and access

- `TEACHER` — all data of the instance. `STUDENT` — own data only: every endpoint returning student data checks
  `studentId` == current user (or `TEACHER`) and has a test "another student gets 403/404".
- `ADMIN` ([ADR-0010](docs/adr/0010-administrator-and-diagnostics.md)) — only `/api/admin/**`, `/api/me`,
  `/api/me/password`; **no student data** — IDs and technical data, never names or texts.
- REST prefixes: `/api/auth/**` (public), `/api/public/**` (no login, secret link — e.g. calendar feed),
  `/api/teacher/**`, `/api/admin/**` (module data at `/api/admin/<module>/**` in the module), `/api/me/**`
  (teacher and student cabinet), `/api/<module>/**` per module rules.
- Logs hold no personal data (IDs only). Dangerous actions (restore, full reset) need the user's password.
  Absolute links only via `Portal.link(...)`. Bot actions check rights like REST.

## 5. Commands

From the repo root (Windows: `mvnw.cmd`, bash scripts via Git Bash).

```bash
./scripts/verify.sh                    # all checks (= pre-commit = CI)
./scripts/verify.sh backend|frontend|docker|e2e
cd backend && ./mvnw clean verify      # tests + JaCoCo gates + Modulith verify
cd backend && ./mvnw spring-boot:run   # API :8080, data in ./backend/data
cd frontend && npx -y npm@11 ci        # npm >= 11 (ADR-0007)
cd frontend && npm run lint && npm test && npm run build
cd frontend && npm start               # :4200, proxy /api -> :8080
./scripts/e2e.sh                       # Playwright on a fresh single container (port 8091); locally E2E_BROWSER_CHANNEL=chrome
docker compose -f compose.split.yaml up -d --build    # or compose.single.yaml
```

## 6. Conventions

### 6.1 General
- English: code, identifiers, comments, commit messages, `AGENTS.md`/`CLAUDE.md` files, `docs/PLAN.md`,
  `docs/design-system.md`, `docs/modules/`, skills. Russian: README, `docs/operations.md`, `docs/glossary.md`,
  ADRs, CHANGELOG, help articles and all UI texts.
- No secrets in the repo. Settings only via `TEACHERBOX_*` env vars; each new one → `.env.example`,
  `platform.settings.SettingsCatalog` ([ADR-0016](docs/adr/0016-admin-settings.md)), README (skill `new-setting`).
- Time in UTC (`Instant`); teacher time zone — `TEACHERBOX_TIMEZONE`. Money — `long` minor units + instance
  currency, never `double`.
- An architecture change → a new ADR (row in `docs/adr/README.md`) and an update of the spec it changes.

### 6.2 Backend — [`backend/AGENTS.md`](backend/AGENTS.md)

### 6.3 Frontend — [`frontend/AGENTS.md`](frontend/AGENTS.md) and [`docs/design-system.md`](docs/design-system.md)

## 7. Testing

All code is tested; the build fails below the gates. Test kinds — in the nested AGENTS.md files.

| Part | Tool | Gate |
|---|---|---|
| Backend | JaCoCo (`mvnw verify`) | lines ≥ 90 %, branches ≥ 80 % |
| Frontend | Vitest coverage (`npm test`) | lines/statements/functions ≥ 90 %, branches ≥ 80 % |

Tests are written with (or before) the code. Never lower gates or lint rules to get green.

## 8. Commits

1. Checks of the touched parts pass before every commit (`./scripts/verify.sh`; hook `.githooks/pre-commit`,
   enable with `git config core.hooksPath .githooks`). Never `--no-verify`.
2. Conventional Commits: `feat(billing): record lesson payments`, `fix(identity): …`, `test`, `docs`, `build`,
   `chore`. Scope — module or `frontend`, `docker`, `platform`.
3. One commit = one complete logical unit (usually a plan substep); tick its checkbox in `docs/PLAN.md` in the
   same commit; archive the release per `docs/PLAN.md`.

## 9. Definition of Done

- [ ] Isolation rules (§4) and conventions (§6, nested AGENTS.md, design system) followed.
- [ ] Tests written, `./scripts/verify.sh` green, gates met.
- [ ] New env vars in `.env.example`, `SettingsCatalog`, README.
- [ ] Architecture change → ADR; changed behaviour → `docs/modules/<m>.md` / `docs/design-system.md` updated.
- [ ] Checkbox in `docs/PLAN.md` ticked.
