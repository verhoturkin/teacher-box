---
name: new-module
description: Checklist for adding a new Teacher Box backend business module (Spring Modulith) with its schema, migrations, reset, tests and frontend feature. Use when a plan stage introduces a new module.
---

# New business module `<m>`

An architecture change: write an ADR first (`docs/adr/NNNN-*.md`, row in `docs/adr/README.md`).

Backend (`backend/src/main/java/ru/teacherbox/<m>/`, see `backend/AGENTS.md`):
1. `package-info.java` — `@ApplicationModule(displayName = "...", allowedDependencies = {"shared", ...})` +
   `@NullMarked`; add the row to the table in root `AGENTS.md` §4.2. No cycles; never `platform`.
2. Packages `api/` (`@NamedInterface("api")` in its `package-info.java`), `domain/`, `application/`,
   `persistence/`, `web/`; `@NullMarked` in each.
3. Schema `<m>`: `src/main/resources/db/migration/<m>/V1__create_<m>_schema.sql`; bean
   `ModuleMigrations.initializer(dataSource, "<m>")` in the module configuration. Tables `<m>.<table>`,
   `version` column on mutable ones.
4. `DataReset` bean listing **all** tables in `tables()` and clearing them in `erase()` (`ResetIntegrationTest`).
5. Settings: `@ConfigurationProperties("teacherbox.<m>")` record; each env var via skill `new-setting`.
6. If it calls external services: `RestClient` from `OutboundHttp`, own proxy variable, an `IntegrationCheck`.
7. Bot actions, if any: `ChatAction` beans in `<m>/chat/`.
8. Security: REST under `/api/teacher/<...>`, `/api/me/<...>`, `/api/admin/<m>/**`; student-data endpoints get
   the "another student gets 403/404" test.
9. Tests: meta-annotation `@<M>IntegrationTest` (`@ApplicationModuleTest` + MockMvc + `MutableClock`), unit,
   web, persistence; `ModularityTests` and `SchemaIsolationTests` stay green. Coverage gates 90/80.

Frontend (`frontend/src/app/features/<m>/`, see `frontend/AGENTS.md`):
10. `data-access/` (`*.models.ts` mirroring DTOs, API service), pages exported in `index.ts` for lazy routes,
    widgets/API/types in `parts.ts`; `<m>-labels.ts` for statuses; fixtures in `src/testing/<m>-fixtures.ts`.
11. Routes and navigation items (`core/layout`), help article.

Docs: `docs/modules/<m>.md` (purpose, rules, contract, data, REST, frontend), list it in root `AGENTS.md`;
plan stage in `docs/PLAN.md`.
