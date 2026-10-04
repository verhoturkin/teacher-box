# backend/AGENTS.md — Spring Boot backend

Loaded when working under `backend/`. The root [`AGENTS.md`](../AGENTS.md) (isolation table §4.2, roles §4.3,
commits §8) still applies. Module facts — [`docs/modules/`](../docs/modules).

## Module structure

Each business module is a direct subpackage of `ru.teacherbox` ([ADR-0001](../docs/adr/0001-modular-monolith.md)):

```
<module>/
├── package-info.java   # @ApplicationModule(allowedDependencies = {...}) + @NullMarked
├── api/                # PUBLIC contract (@NamedInterface("api")): facades (interfaces), DTOs and domain events (records)
├── domain/             # aggregates, value objects, rules. Plain Java, no Spring (ArchUnit)
├── application/        # use-case services (@Service, @Transactional) implementing api facades
├── persistence/        # JdbcClient repositories: explicit SQL to own schema only
├── web/                # REST controllers and their request/response DTOs
└── <adapter>/          # external integrations (telegram/, vk/, llm/, google/, chat/ ...)
```

- Sync calls to another module — its `api` facade, reads/checks only. Async — domain events (`record` in
  `api`) published via `ApplicationEventPublisher`, handled by `@ApplicationModuleListener`, stored in the
  Event Publication Registry (resent after restart). Producers know nothing about consumers.
- Listeners are idempotent: a redelivered event must not double-apply (e.g. `billing` remembers `completionId`).
- Files — only via `shared.files.FileStorage`, in the module's namespace `/data/files/<module>/`.

## Shared kernel and SPIs (`shared`, OPEN module)

| Need | Use |
|---|---|
| IDs | `UUID` v7 via `shared.Ids` |
| Money | `shared.money.Money` — `long` minor units + instance currency; never `double` |
| Current user / role | `shared.security.CurrentUser` |
| Password confirmation for dangerous actions | `shared.security.PasswordConfirmation` (implemented by `identity`) |
| Absolute links (messages, invites, calendars, OAuth redirects) | `shared.portal.Portal.link(...)` — never the request address ([ADR-0014](../docs/adr/0014-portal-settings-reset-and-restore.md)) |
| Outbound HTTP | `RestClient` from `shared.http.OutboundHttp` (HTTP/1.1, buffered body, proxy); per-integration proxy `TEACHERBOX_<MODULE>_..._PROXY` parsed by `OutboundProxy.setting`; Russian services go direct ([ADR-0009](../docs/adr/0009-external-integrations.md)) |
| Full reset | SPI `shared.reset.DataReset` — **every new table goes into the module's `tables()` and `erase()`**, or `ResetIntegrationTest` fails |
| Admin / bot audit | `shared.diagnostics.AuditLog` (no personal data) |
| External service health | SPI `shared.diagnostics.IntegrationCheck` (collected by `platform`) |
| Messenger bot action | SPI `shared.chat.ChatAction` + helpers in `shared.chat` ([ADR-0013](../docs/adr/0013-bot-dialogs.md)); checks rights like REST, changes only its own module |
| Domain errors | exceptions from `shared.error` → `ProblemDetail` (RFC 9457) in `platform` |

`platform` infra is auto-configuration (`META-INF/spring/...AutoConfiguration.imports`); `shared` and
`platform` are shared modules (`@Modulithic(sharedModules = ...)`) and start in every
`@ApplicationModuleTest`. Business modules never depend on `platform`; they get infra only via Spring/`shared`
types (`JwtEncoder`, `PasswordEncoder`, `Clock`, `FileStorage`, `CurrentUser`).

## Conventions

- Java 25: `record` for DTOs/events/value objects, `sealed` for closed hierarchies, pattern matching in
  `switch`. No Lombok. Constructor injection only, `private final` fields, no field `@Autowired`.
- `@NullMarked` (JSpecify) in every package's `package-info.java`; nullable — explicit `@Nullable`.
- Time — `Instant` (UTC) from the injected `Clock`; teacher time zone — `TEACHERBOX_TIMEZONE`.
- DB — `JdbcClient` with explicit SQL; table names schema-prefixed (`billing.payments`), unquoted; mutable
  tables have `version` (optimistic locking `UPDATE ... WHERE id = ? AND version = ?`). No SQL, FKs or JOINs to
  other schemas; only UUIDs cross module boundaries.
- Migrations — bean `ModuleMigrations.initializer(dataSource, "<module>")` in the module config, scripts in
  `src/main/resources/db/migration/<module>/V<n>__<description>.sql`, own history table.
- Config — typed `@ConfigurationProperties` records, prefix `teacherbox.<module>`. A new env var → `.env.example`
  + `platform.settings.SettingsCatalog` (a test compares them) + README (skill `new-setting`).
- Input validation — Jakarta Validation in `web`. REST prefixes and role checks — root §4.3; every endpoint
  returning student data has a test "another student gets 403/404".
- Logs — IDs, never names or texts.
- Spring Boot 4: modular starters (`spring-boot-starter-webmvc`, `-flyway`, `-webmvc-test`); Jackson 3 is
  package `tools.jackson`. Check current docs (context7) for unfamiliar APIs.
- `ai` module: Claude/LLM integration code — load the `claude-api` skill first.

## Tests

Stack: JUnit 6, AssertJ, Mockito, Spring Modulith Test, ArchUnit, JaCoCo. Gate (`./mvnw clean verify`): lines ≥ 90 %, branches ≥ 80 %.
`clean` is required: after
`-Pbundle-frontend` the SPA stays in `target/classes/static`.

- **Unit** — domain and application (Mockito for ports).
- **Module** — `@<Module>IntegrationTest` (`@ApplicationModuleTest` + MockMvc + `testing.MutableClock`): only the
  module and its allowed dependencies start; other modules — `@MockitoBean` of their `api` facades; events via
  `Scenario`.
- **Web** — MockMvc/`MockMvcTester`: status codes, validation, role auth, own-data access.
- **Persistence** — in-memory H2 with the module's real Flyway migrations (`@JdbcTest` + `@Import` of the
  module config, or `@ApplicationModuleTest`).
- **Architecture** — `ModularityTests` (Modulith verify + docs), ArchUnit, `SchemaIsolationTests` (no SQL to
  other schemas).
- **Adapters** — `MockRestServiceServer`, or a local HTTP server for non-`RestClient` clients (Anthropic SDK);
  no real network.

```bash
./mvnw clean verify                     # everything
./mvnw test -Dtest=ModularityTests      # one test
./mvnw spring-boot:run                  # run, data in ./data
```
