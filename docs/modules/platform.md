# platform

Infrastructure: security, HTTP errors, migrations bootstrap, file storage, backups and restore, full reset,
portal settings, admin sections and diagnostics. Depends on: `shared`; knows no business module
(it collects SPI beans). Schema `platform`. ADRs: [0002](../adr/0002-embedded-database.md),
[0004](../adr/0004-delivery-variants.md), [0010](../adr/0010-administrator-and-diagnostics.md),
[0014](../adr/0014-portal-settings-reset-and-restore.md), [0016](../adr/0016-admin-settings.md). Operations
guide for people — [`docs/operations.md`](../operations.md) (Russian).

## Parts

- `security/` — Spring Security 7 resource server (JWT HS256, `TEACHERBOX_SECURITY_JWT_SECRET`), role rules by
  prefix (root AGENTS.md §4.3), auth rate limit. `ADMIN` reaches only `/api/admin/**`, `/api/me`,
  `/api/me/password` — enforced here, not in controllers.
- `web/` — `ProblemDetailsAdvice` (domain errors → RFC 9457 with `requestId`), `X-Request-Id` in MDC and
  response, `/api/client-errors` (browser errors, rate-limited). The SPA is served by nginx (ADR-0031).
- `core/` — auto-configuration, `Clock` (UTC), `teacherbox.*` platform properties.
- `storage/` — `FileStorage` implementation (`/data/files/<module>/`).
- `portal/` — `shared.portal.Portal` implementation: name, address (`TEACHERBOX_PUBLIC_URL` wins), colour, logo
  (`/api/public/portal`, `/api/public/portal/logo`, `/api/public/portal/manifest.webmanifest` — the web app manifest:
  the portal's name, its logo before the default icons `/icons/icon-{192,512,maskable-512}.png`, `theme_color` /
  `background_color` from `?theme=&background=` (`#rrggbb`, else the default `#efecf8`), `id` and `start_url` `/`), first-run setup flag (`/api/teacher/portal/setup`).
  Address changes by admin are audited.
- `backup/` — scheduled backups (`TEACHERBOX_BACKUP_CRON`, `_KEEP`), download, restore via restart (check
  archive → backup current → put into `restore/` → exit → apply before DB opens → module migrations;
  `TEACHERBOX_BACKUP_RESTART`), **full reset** (`/api/teacher/reset`) calling every module's `DataReset`;
  restore and reset are confirmed by password (`PasswordConfirmation`). `ResetIntegrationTest` checks that all
  tables are covered.
- `settings/` — admin settings (`/api/admin/settings`): `SettingsCatalog` mirrors `.env.example` (test),
  values in `<data>/config/settings.properties` loaded first by `AdminSettingsLoader`; secrets write-only;
  Compose variables and accounts read-only; change confirmed by password, then restart. Each setting has a
  `section` key (`ai`, `backups`…): the page folds by section (`tb-fold-card`, open ones in `?open=`).
- `admin/` — logs search and temporary log levels, status (version, uptime, memory, disk, DB, health),
  incomplete Modulith events with resubmit, integration checks (`IntegrationCheck` beans), diagnostics archive.
  Admin actions → `teacherbox.audit` logger.
- Logs — JSON (ECS) in `/data/logs/teacher-box.log` with rotation; console plain text; no personal data.

## Data

`portal_settings` (one row). Backups and settings file live in the data directory, not in the DB.

## Frontend

`features/admin/` (logs, status, events, integrations, backups, settings, diagnostics — `/admin/**`),
`features/settings/` (teacher settings: portal card, setup wizard, backups, reset), `core/portal`.
