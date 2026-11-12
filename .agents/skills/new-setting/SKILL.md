---
name: new-setting
description: Add a new setting to Teacher Box — a TEACHERBOX_* variable and its place in the portal (properties record, SettingsCatalog owner/live, administrator's or teacher's Settings page, .env.example for deployment-only ones, wiki, tests). Use whenever code needs a new setting.
---

# New setting `TEACHERBOX_<MODULE>_<NAME>`

Since ADR-0056 (amends 0014, 0016) `.env` is no longer the home of every setting. **First decide the
owner**, it fixes every later step:

| Owner (`SettingDefinition.Owner`) | Whose | Lives in | `.env.example` |
|---|---|---|---|
| `TEACHER` | the teacher's own choice (rules, messengers, keys, prices…) | a row in the owning module's schema, edited in the portal's Settings; applies at once | no |
| `ADMIN` | server limits, proxies, sessions, delivery, backup crons | `.env` > the administrator's «Настройки» (`<data>/config/settings.properties`) > default | no |
| `ENV_ONLY` | read before the portal starts or needed when it cannot be entered: Compose, accounts, token secret, LiveKit, log | `.env` only (read-only in the interface) | **yes** |

Default to `ADMIN` for a technical knob and `TEACHER` for what the teacher would want to change
without an administrator. `ENV_ONLY` only when the portal cannot work without it at start. A new
`TEACHER` setting needs no `.env` variable at all — see the last section.

## Every owner

1. **Property** — a typed field (`Duration`, `DataSize`, enums, `@DefaultValue`) in the module's
   `@ConfigurationProperties("teacherbox.<module>")` record, `<module>/application/<Module>Properties`
   (platform: `platform/<part>/…Properties`). Relaxed binding maps `TEACHERBOX_<MODULE>_<NAME>`. Other
   modules never read it (AGENTS.md §4.2): they go through the module's `api`.
2. **`platform.settings.SettingsCatalog`** — a `Builder` call in the section's `b.group(…)` of
   `build()`: `add` (editable), `secret`, `env` / `envChoice` / `envSecret` (read-only, `Access.ENV`),
   `docker` / `dockerSecret` (Compose reads it), `account`. Titles and hints are `w(ru, en)` — both
   languages. The type (`SettingKind`: number, duration, data size, cron, URL, proxy, time zone,
   currency, choice…) validates the value. Secrets (`*_TOKEN`, `*_SECRET`, `*_API_KEY`,
   `*_PASSWORD`) must be `secret`: never shown, only "set / not set" (`SettingsCatalogTest` checks the
   name pattern). The owner follows from the call: `ENV_ONLY` for every non-`add`; an `add` is `ADMIN`
   unless the name is in `SettingsCatalog.TEACHER`.
3. **Tests** (`backend/src/test/.../platform/settings/`):
   - `SettingsCatalogTest` — update the sets it pins (`TEACHER`, `LIVE`, the list of `Access.ENV`
     names), and that `.env.example` has exactly the `ENV_ONLY` variables, nothing more;
   - `AdminSettingsIntegrationTest` / `LiveAdminSettingsIntegrationTest` — a behaviour test for an
     editable (and live) setting: stored, validated, `applied` or restart;
   - the module's own test for the behaviour the setting changes;
   - `ModularityTests` / `SchemaIsolationTests` stay green. `./mvnw clean verify` (CI in the cloud:
     no JDK 25) and the JaCoCo gates.
4. **Wiki** (Russian, `docs/wiki/`, same commit, AGENTS.md §6.1): the page by owner —
   `Admin.md` («Настройки» → cards; `Settings.md` has only a pointer), the teacher's page by topic
   (`Settings`, `Messengers`, `Schedule`, `Calls`, `Boards`, `AI-assistant`, `Backups`, `Proxy`),
   `Install.md` for deployment ones. README stays slim. Lines ≤ 100 columns; `./scripts/verify.sh docs`
   checks the links.
5. **Secrets** never in the repo, logs or API responses; logs hold IDs only (AGENTS.md §4.3).
6. A proxy of an external service: own `TEACHERBOX_<MODULE>_..._PROXY` (`ADMIN`, usually `live`),
   parsed by `OutboundProxy.setting`, requests through `OutboundHttp` (`liveRequestFactory` re-reads
   it per request); Russian services go direct (ADR-0009).

## `ADMIN`

- Not in `.env.example`; the administrator edits it in «Администрирование» → «Настройки» (change
  confirmed by password). `.env` still wins, the interface shows the source («по умолчанию», «из
  .env», «задано здесь»).
- **Live or restart.** If consumers can read it on every use, add the name to
  `SettingsCatalog.LIVE`: read it through `shared.settings.LiveProperties<YourProperties>` (bind
  anew per call, never keep it in a field; register the bean in the module's `…Configuration`), and
  rebuild anything built from it (client, schedule) on `shared.settings.SettingsChanged`. Otherwise
  leave it out: saving restarts the portal. A `CRON` setting is a `ZonedJob`; add its default to
  `SettingsCatalog.DEFAULT_CRONS` so the interface shows «вкл/выкл + время».
- **Card.** The page (`frontend/.../features/admin/settings/settings-page.ts`) puts each setting in
  a card by `CARD_OF` (`files`, `network`, `sessions`, `messages`, `backups`); a name missing there
  lands in «Другие настройки». Add it to `CARD_OF` if it belongs elsewhere; a new card needs `T`
  texts in both languages and a row in `COLUMNS`. Update `settings-page.spec.ts` if the card changes.
- Wiki: `Admin.md`, section «Настройки» (card list).

## `ENV_ONLY`

- `.env.example` — a commented line (`# TEACHERBOX_X=default`) in the fitting `# ---` block, English
  comment (as the file already is), the default shown. The test requires the exact set of variables.
- `Access.DOCKER` when Compose reads it (`compose.yaml`: `${TEACHERBOX_X:-default}`; the backend
  gets all of `.env` through `env_file`, so a variable only the backend reads needs nothing in
  Compose); `Access.ENV` for the rest. A new `Access.ENV` name goes to the list in
  `SettingsCatalogTest`. If the installer should ask for it, `scripts/install.sh` (`set_env`).
- Wiki: `Install.md` (deployment, HTTPS, resources) or `Calls.md`; `docs/operations.md` if it
  changes how the server is run.

## `TEACHER` — a setting in the portal

No `.env.example`, no administrator's card (the administrator sees only «Перенесено в настройки
учителя» for old variables still set).

1. **Storage:** a row/column in the owning module's schema — a Flyway migration in
   `db/migration/<module>/` (e.g. `schedule/V5__settings.sql`); only UUIDs cross modules. Data is
   in backups with the schema.
2. **API:** a read and a `PUT` under `/api/teacher/**` (role `TEACHER`; a controller test with
   role checks first, AGENTS.md §10.2); a student gets 403. Another module reads the value through
   the owner's `api` facade.
3. **UI:** the teacher's Settings page (`frontend/.../features/settings/`: cards, field components
   in `settings/fields/`) and, if it is needed on the first login, the setup wizard
   (`settings/setup/`). Made with the `m3-expressive` skill; texts in both languages; a new shared
   component gets its gallery sample (ADR-0059).
4. **Catalog entry — only when there was an old variable** with that name: add it to
   `SettingsCatalog.TEACHER` and implement `shared.settings.TeacherSettingsImport` in the module
   (`names()`, `importFrom(OldSettings)`: store each value unless the teacher's own exists, skip
   invalid ones; the `…SettingsImport` classes of `schedule`, `billing`, `homework`, `notifications`,
   `ai`, `platform` are the models; do not depend on module order). `platform.settings.EnvImport`
   collects the beans and calls them once. Tests: the module's import test
   (`SettingsImportIntegrationTests`), `EnvImportTest` if the mechanics change. A brand-new
   teacher setting has no old variable — skip this step.
5. **Wiki:** the teacher's page and the table «Учитель — только в портале» in `Update.md` (only for
   an old variable). `docs/modules/<module>.md`, `docs/screens.md` for the screen.
