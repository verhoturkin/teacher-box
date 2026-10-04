# AGENTS.md — Teacher Box

Single source of rules for AI agents and humans (Claude Code, Codex, Cursor, Copilot…).
`CLAUDE.md` imports this file.

## 1. Project

**Teacher Box** — self-hosted portal for a tutor/teacher.

- **One instance = one teacher**, created on first start from env vars; always exactly one. No public sign-up.
- **Many students.** The teacher adds a student and gives an invite link; the student sets login and
  password and gets a personal cabinet (ЛК).
- Backend modules:
  1. `identity` — auth for teacher and students (invites, login, JWT, refresh tokens), student groups.
  2. `billing` — lessons and payments, student balance, reports.
  3. `homework` — assign, submit, review, attachments.
  4. `notifications` — cabinet inbox, Telegram bot, messenger DMs (VK, MAX).
  5. `ai` — LLM: task generation, draft review of submissions.
  6. `schedule` — lessons and weekly series (student or group), attendance, student reschedule/cancel
     requests, reminders, calendar feed (ICS).
  7. `meetings` — permanent Yandex Telemost rooms for students and groups.
  8. `boards` — interactive boards (Холст) for students and groups via links.

Plan — [`docs/PLAN.md`](docs/PLAN.md) (active only; `docs/plan-archive/` — don't read unless history is
needed). ADRs — [`docs/adr/`](docs/adr).

## 2. Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Java | 25 (LTS) |
| | Spring Boot / Spring Modulith | 4.1.x / 2.1.x |
| | Spring JDBC (`JdbcClient`, explicit SQL) + Flyway | managed by Boot |
| | Spring Security 7 (OAuth2 Resource Server, JWT HS256) | managed by Boot |
| | DB | H2 2.x, file mode, schema-per-module ([ADR-0002](docs/adr/0002-embedded-database.md)) |
| | Build | Maven (via `mvnw`) |
| | Tests | JUnit 6, AssertJ, Mockito, Spring Modulith Test, ArchUnit, JaCoCo |
| Frontend | Angular (standalone, signals, zoneless) | 21.2 LTS ([ADR-0007](docs/adr/0007-frontend-stack-licensing.md)) |
| | PrimeNG (MIT) + @primeuix/themes 2 (Aura → Material 3 Expressive, [ADR-0017](docs/adr/0017-material-design-3.md), [ADR-0019](docs/adr/0019-material-3-expressive.md)) + primeicons 7, Roboto font | 21.1.x |
| | TypeScript | 5.9.x, `strict` |
| | Tests | Vitest (via `ng test`), jsdom |
| | Lint | ESLint + angular-eslint + typescript-eslint (type-checked) |
| Delivery | Docker, Docker Compose | 2 variants: split and single |

## 3. Repository layout

```
teacher-box/
├── AGENTS.md, CLAUDE.md, README.md, CHANGELOG.md
├── docs/
│   ├── PLAN.md                  # active plan (English)
│   ├── plan-archive/            # completed plans by release — read only when needed
│   ├── adr/                     # Architecture Decision Records
│   ├── audit/                   # design audits (large) — read only the parts a task cites
│   └── glossary.md              # UI wording
├── backend/src/main/java/ru/teacherbox/
│   ├── TeacherBoxApplication.java
│   ├── shared/                  # shared kernel (OPEN module): Ids, Money, CurrentUser, errors, HTTP clients, Portal
│   ├── platform/                # infra: security, HTTP errors, migrations, backups, SPA, portal settings
│   └── identity/ billing/ homework/ notifications/ ai/ schedule/ meetings/ boards/
├── frontend/src/app/
│   ├── core/                    # auth, interceptors, guards, layout, config
│   ├── shared/                  # reusable UI components, pipes
│   └── features/<module>/       # mirrors backend modules: data-access + teacher/ + student/ + home/
├── docker/                      # Dockerfile (targets: backend, frontend, single) and nginx
├── compose.split.yaml           # variant 1: backend + frontend containers
├── compose.single.yaml          # variant 2: one container
├── .env.example                 # all env vars
├── .githooks/pre-commit         # tests before commit
├── .github/workflows/ci.yml     # CI: backend, frontend, both images, e2e
├── e2e/                         # Playwright E2E against a running instance
└── scripts/                     # verify.sh (all checks = pre-commit = CI), e2e.sh (E2E on fresh single container)
```

## 4. Architecture and module isolation

Backend is a **modular monolith** on Spring Modulith ([ADR-0001](docs/adr/0001-modular-monolith.md)).
Each business module is a direct subpackage of `ru.teacherbox`.

### 4.1 Module structure

```
<module>/
├── package-info.java   # @ApplicationModule(allowedDependencies = {...}) + @NullMarked
├── api/                # PUBLIC contract (@NamedInterface("api")): facades (interfaces), DTOs and domain events (records)
├── domain/             # aggregates, value objects, rules. Plain Java, no Spring
├── application/        # use-case services (@Service, @Transactional) implementing api facades
├── persistence/        # JdbcClient repositories: explicit SQL to own schema only
├── web/                # REST controllers and their request/response DTOs
└── <adapter>/          # external integrations (telegram/, vk/, llm/ ...)
```

### 4.2 Isolation rules (enforced by tests — violation = red build)

1. **Code:** a module uses another module **only** via its `api` package; everything else is internal.
   No cycles. Checked by `ModularityTests` (`ApplicationModules.verify()`) + ArchUnit.
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

   Business modules **do not** depend on `platform`; `platform` knows nothing of business modules.
3. **Data:** each module has its own DB schema (`identity`, `billing`, `homework`, `notifications`, `ai`,
   `schedule`, `meetings`, `boards`; `platform` — `platform` for portal settings), its own Flyway
   migrations in `db/migration/<module>/` and its own migration history table. **Forbidden:** SQL to
   another schema, cross-schema foreign keys and JOINs. Only IDs (UUID) cross module boundaries.
4. **Interaction:**
   - sync — call another module's `api` facade (reads/checks only);
   - async — domain events (`record` in `api`) published via `ApplicationEventPublisher`, handled by
     `@ApplicationModuleListener`, stored in the Event Publication Registry (resent after restart);
   - producers know nothing about consumers (e.g. `homework` doesn't know `notifications`).
5. **Files:** a module writes only to its own storage namespace (`FileStorage`, `/data/files/<module>/`).
6. **Frontend** mirrors the boundaries: `features/<module>/` imports another feature only via its public
   entries — `@features/<name>` (`index.ts`: pages for lazy routes) and `@features/<name>/parts`
   (`parts.ts`: widgets, panels, API and types to embed; no pages, so they don't leak into other
   bundles). Shared things — only from `core/` and `shared/` (ESLint `no-restricted-imports`). Home
   widgets live in their features; `features/home` only assembles them.

### 4.3 Roles and access

- `TEACHER` — full access to all data of the instance.
- `STUDENT` — own data only. Every endpoint returning student data must check `studentId` == current
  user (or role `TEACHER`), with a mandatory test "another student gets 403/404".
- `ADMIN` — technical account ([ADR-0010](docs/adr/0010-administrator-and-diagnostics.md)): only
  `/api/admin/**` and own account, **no access to student data**; admin endpoints return IDs and
  technical data, never names or texts.
- REST prefixes: `/api/auth/**` (public), `/api/public/**` (no login, secret link — e.g. calendar feed),
  `/api/teacher/**` (TEACHER), `/api/admin/**` (ADMIN; module data at `/api/admin/<module>/**` in the
  module), `/api/me/**` (teacher and student: cabinet; admin — only `/api/me` and `/api/me/password`),
  `/api/<module>/**` — per module rules.
- Logs hold no personal data: IDs, not names or texts. Admin actions and teacher changes via bot →
  `shared.diagnostics.AuditLog`; external service checks → SPI `shared.diagnostics.IntegrationCheck`.
- Full reset — SPI `shared.reset.DataReset`: each module clears its own tables. **Every new module table
  goes into its `DataReset.tables()` and `erase()`**, otherwise `ResetIntegrationTest` fails.
- Dangerous actions (backup restore, full reset) are confirmed with the user's password via
  `shared.security.PasswordConfirmation` (implemented by `identity`, used by `platform`).
- Portal name and URL — `shared.portal.Portal` ([ADR-0014](docs/adr/0014-portal-settings-reset-and-restore.md)):
  absolute links (messages, invites, calendars, OAuth redirect URIs) are built only via
  `Portal.link(...)`, never from the request address.
- Messenger bot actions — SPI `shared.chat.ChatAction` ([ADR-0013](docs/adr/0013-bot-dialogs.md)): a
  module declares a bean, the engine in `notifications` shows it in the menu. The action checks rights
  like a REST endpoint and changes only its own module's data.

## 5. Commands

From the repo root unless noted.

```bash
# Backend
cd backend && ./mvnw clean verify      # build + all tests + JaCoCo gates + Modulith verify
cd backend && ./mvnw spring-boot:run   # run (data in ./backend/data)
cd backend && ./mvnw test -Dtest=ModularityTests

# Frontend
cd frontend && npx -y npm@11 ci        # install: needs npm >= 11 (ADR-0007)
cd frontend && npm run lint            # ESLint (no any, feature boundaries), Prettier, knip
cd frontend && npm test                # Vitest + coverage gates (single run)
cd frontend && npm start               # dev server :4200, proxy /api -> :8080
cd frontend && npm run build           # production build

# Everything (same as pre-commit and CI)
./scripts/verify.sh                    # all checks
./scripts/verify.sh backend|frontend   # one part

# E2E (Playwright) on a fresh single container (port 8091, data removed afterwards)
./scripts/e2e.sh                       # in CI; locally E2E_BROWSER_CHANNEL=chrome works

# Docker
docker compose -f compose.split.yaml up -d --build    # variant 1: two containers
docker compose -f compose.single.yaml up -d --build   # variant 2: one container
```

Windows: `./mvnw` → `mvnw.cmd`; bash scripts via Git Bash.

## 6. Code conventions

### 6.1 General
- English: code, identifiers, code comments, commit messages, `AGENTS.md`, `CLAUDE.md`, `docs/PLAN.md`.
  Russian: other docs (`docs/adr`, `docs/audit`, README, CHANGELOG, help) and UI texts; UI wording per
  [`docs/glossary.md`](docs/glossary.md).
- No secrets in the repo. All settings via env vars (`TEACHERBOX_*`); each new one is documented in
  `.env.example` and added to the admin settings catalog `platform.settings.SettingsCatalog`
  ([ADR-0016](docs/adr/0016-admin-settings.md)).
- Time stored in UTC (`Instant`); teacher time zone — `TEACHERBOX_TIMEZONE`.
- Money — integer minor units (`long` kopecks) + instance currency. Never `double`.

### 6.2 Backend (Java)
- Java 25: `record` for DTOs/events/value objects, `sealed` for closed hierarchies, pattern matching in
  `switch`. No Lombok.
- Constructor injection only; `private final` fields; no field `@Autowired`.
- Null-safety: `@NullMarked` (JSpecify) in every package's `package-info.java`; nullable — explicit `@Nullable`.
- IDs — `UUID` v7 via `shared.Ids`.
- DB — `JdbcClient` with explicit SQL; table names always schema-prefixed (`billing.payments`), unquoted.
  Mutable tables have a `version` column (optimistic locking: `UPDATE ... WHERE id = ? AND version = ?`).
- Migrations: bean `ModuleMigrations.initializer(dataSource, "<module>")` in the module config, scripts
  in `src/main/resources/db/migration/<module>/V<n>__<description>.sql`.
- `platform` infra is registered as auto-configuration (`META-INF/spring/...AutoConfiguration.imports`);
  `shared` and `platform` are shared modules (`@Modulithic(sharedModules = ...)`), so they start in every
  isolated `@ApplicationModuleTest`. Business modules get infra only via Spring/`shared` types
  (`JwtEncoder`, `PasswordEncoder`, `Clock`, `FileStorage`, `CurrentUser`).
- Module tests: meta-annotation `@<Module>IntegrationTest` (`@ApplicationModuleTest` + MockMvc +
  `MutableClock`); other modules — `@MockitoBean` of their `api` facades.
- Errors: domain exceptions from `shared.error` → `ProblemDetail` (RFC 9457) in `platform`.
- External HTTP APIs — `RestClient` from the `shared.http.OutboundHttp` factory (HTTP/1.1, body
  buffering, proxy). Each integration has its own proxy variable (`TEACHERBOX_<MODULE>_..._PROXY`, parsed
  by `OutboundProxy.setting`); Russian services go direct ([ADR-0009](docs/adr/0009-external-integrations.md)).
- Input DTO validation — Jakarta Validation in `web`.
- `domain` doesn't import Spring (ArchUnit).
- Module config — typed `@ConfigurationProperties` records with prefix `teacherbox.<module>`.

### 6.3 Frontend (TypeScript/Angular)
- `tsconfig`: `strict` + `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`; `strictTemplates: true`.
- **`any` is forbidden** in any form (`: any`, `as any`, `<any>`, implicit). Unknown data — `unknown` +
  type guard. ESLint `no-explicit-any` and all `no-unsafe-*` are `error`; `eslint-disable` for them is forbidden.
- Standalone components only, `OnPush`, signals, `inject()`, new control flow (`@if`, `@for`),
  `input()`/`output()`.
- UI components — PrimeNG; custom ones only when PrimeNG has nothing suitable.
- Buttons, FAB, page header, sections, lists — [ADR-0018](docs/adr/0018-component-rules.md): main action —
  filled `tb-page-fab`; secondary — tonal (`severity="secondary"`), no `outlined` or `size="small"`;
  header — `tb-page-header` from `@shared/ui`. Button colour = meaning
  ([ADR-0019](docs/adr/0019-material-3-expressive.md), [ADR-0026](docs/adr/0026-decision-buttons-and-dialogs.md)):
  confirm — `success` (green); delete, lesson cancel, refusal with consequences — `danger` (red); close
  without consequences — neutral text button «Отмена»; max one red button per dialog; dialog
  confirmations — `dangerConfirmation` / `safeConfirmation` from `@shared/ui/confirmation`. Dialog submit
  — `type="submit" [attr.form]` in the footer, `[loading]` for request actions; dialog width — class
  `tb-dialog`, not inline style. Bottom bar — four sections and «Ещё»
  ([ADR-0027](docs/adr/0027-bottom-navigation.md)).
- Lists in cards are segmented ([ADR-0020](docs/adr/0020-lists-in-cards.md)): `ul.tb-list` with rows
  `tb-list__lead` / `tb-list__text` / `tb-list__trail`; tables — `styleClass="tb-cards"`; initials —
  `tb-avatar` and pipe `initials` from `@shared/ui/initials`.
- A section is one column of cards on any screen ([ADR-0021](docs/adr/0021-single-column.md)): blocks
  stacked (`tb-stack`), no card grids; metrics — `tb-stats`; wide lists — `tb-cards--wide`; text wraps
  between words (`overflow-wrap: break-word`).
- Fields, menus, phone actions — M3 Expressive ([ADR-0022](docs/adr/0022-expressive-fields-menus-sheets.md)):
  field — `.tb-field` with `label` first (label sits on the outline); search — `p-iconfield` with
  `pi-search`; row actions that don't fit on a phone — bottom sheet (`p-drawer` bottom,
  `styleClass="tb-sheet"`); action pairs — `tb-button-group`; button with a fallback — split button `tb-split`.
- Colour — only `--p-md-*` roles ([ADR-0023](docs/adr/0023-status-colors-and-contrast.md)): no
  `--p-surface-N` / `--p-<colour>-N` palettes or opacity for dimming in styles; status — severity per the
  ADR-0023 table (`warn` — warning role, `info` — tertiary); text contrast ≥ 4.5:1.
- Accessibility — [ADR-0024](docs/adr/0024-accessibility.md): section title — `h2` (`tb-card-title`);
  field error — text under the field (`<form tbFieldErrors>`); required fields marked; submit isn't
  disabled for invalid fields; dialogs return focus; media queries in `em` ranges (`width <= 48em`).
- Section data loading — `LoadState` and `tb-load-state` ([ADR-0025](docs/adr/0025-page-states.md)):
  loading, error with «Повторить», empty state only after a response.
- HTTP models — `interface`/`type` in `features/<module>/data-access/*.models.ts`, 1:1 with backend DTOs.
- Lazy routing: `/teacher/**` (teacher), `/cabinet/**` (student cabinet), `/admin/**` (admin), `/login`,
  `/invite/:token`.

## 7. Testing

**All code is tested.** The build fails on insufficient coverage.

| Part | Tool | Gate |
|---|---|---|
| Backend | JaCoCo (`mvnw verify`) | lines ≥ 90%, branches ≥ 80% |
| Frontend | Vitest coverage (`npm test`) | lines/statements/functions ≥ 90%, branches ≥ 80% |

Backend — required test kinds:
- **Unit** — domain and application (Mockito for ports).
- **Module** — `@ApplicationModuleTest` per module: only the module and its allowed dependencies start
  (runtime isolation check); events via `Scenario`.
- **Web** — MockMvc/`MockMvcTester`: status codes, validation, role auth, students see only own data.
- **Persistence** — repositories on in-memory H2 with the module's real Flyway migrations (`@JdbcTest` +
  `@Import` of the module config, or `@ApplicationModuleTest`).
- **Data isolation** — `SchemaIsolationTests` forbids SQL references to other schemas.
- **Architecture** — `ModularityTests` (Modulith verify + docs generation) and ArchUnit.
- **Adapters** — external HTTP APIs (Telegram, VK, MAX, LLM) via `MockRestServiceServer` (or a local HTTP
  server for non-`RestClient` clients, e.g. the Anthropic SDK); no real network calls.

Frontend — required test kinds:
- Components — `TestBed` + Vitest, interaction via DOM.
- Services — `HttpTestingController`.
- Guards/interceptors — separate tests.
- Common setup — `testProviders(...)` from `@testing/setup` (HTTP with `HttpTestingController`, router,
  PrimeNG, `MessageService`); fixtures — `@testing/*-fixtures`; DOM helpers — `@testing/dom`.
- `npm run lint` runs ESLint, Prettier formatting and knip (dead code).

Tests are written with (or before) the code, never "later".

## 8. Commits

1. **Tests of touched parts pass before every commit**: `./scripts/verify.sh`. The hook
   `.githooks/pre-commit` does it (enable: `git config core.hooksPath .githooks`). Never `--no-verify`.
2. Conventional Commits: `feat(billing): record lesson payments`, `fix(identity): ...`, `test(...)`,
   `docs(...)`, `build(...)`, `chore(...)`. Scope — module name or `frontend`, `docker`, `platform`.
3. One commit = one complete logical unit (usually a plan substep).
4. Tick the substep's checkbox in `docs/PLAN.md` in the same commit; archive the release per `docs/PLAN.md`.

## 9. Definition of Done

- [ ] Code follows isolation rules (§4) and conventions (§6).
- [ ] Tests written, `./scripts/verify.sh` green, coverage gates met.
- [ ] New env vars — in `.env.example` and README.
- [ ] Architecture change — new ADR in `docs/adr/`.
- [ ] Checkbox in `docs/PLAN.md` ticked.
