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
- `core/` — auto-configuration, `Clock` (UTC), `teacherbox.*` platform properties, `shared.persistence.MigrationConnection`
  (module migrations run on one connection outside the pool, open until shutdown: H2 compiles `check (x in (…))`
  against the session that altered the table, and a pooled session is closed by the pool sooner or later).
- `storage/` — `FileStorage` implementation (`/data/files/<module>/`).
- `portal/` — `shared.portal.Portal` implementation: name, address (`TEACHERBOX_PUBLIC_URL` wins), source colour,
  M3 scheme, named contrast, logo
  (`/api/public/portal`, `/api/public/portal/logo`, `/api/public/portal/manifest.webmanifest` — the web app manifest:
  the portal's name, its logo before the default icons `/icons/icon-{192,512,maskable-512}.png`, `theme_color` /
  `background_color` from `?theme=&background=` (`#rrggbb`, else the default `#efecf8`), `id` and `start_url` `/`), first-run setup flag (`/api/teacher/portal/setup`).
  Address changes by admin are audited.
- `backup/` — scheduled backups (`TEACHERBOX_BACKUP_CRON`; backups of every kind older than
  `TEACHERBOX_BACKUP_KEEP_DAYS`, 14 by default, are deleted after a new one), download, restore via restart (check
  archive → backup current → put into `restore/` → exit → apply before DB opens → module migrations;
  `TEACHERBOX_BACKUP_RESTART`), **full reset** (`/api/teacher/reset`) calling every module's `DataReset`;
  restore and reset are confirmed by password (`PasswordConfirmation`). `ResetIntegrationTest` checks that all
  tables are covered. What a module leaves out of the backup — SPI `shared.backup.BackupExclusions` (ADR-0037):
  rows of its tables (dropped from the H2 `SCRIPT` with their `SYSTEM_LOB_STREAM` parts, `BackupDump`) and files
  of its namespace (found before the dump).
- `backup/drive/` — copies in the teacher's Google Drive (ADR-0037): `DriveApi` (OAuth, Drive v3, scope
  `drive.file`; uploads and downloads streamed through `OutboundHttp.streamingRequestFactory`), the connection in
  `<data-dir>/google-drive.json` (`DriveConnectionStore`; survives restore and reset), `CloudBackupService`: after
  `BackupCreated` of a scheduled or manual backup it uploads it in the background (one task at a time) into the
  portal's folder and deletes the ones uploaded more than `TEACHERBOX_BACKUP_KEEP_DAYS` ago; a rejected token disconnects with an error.
  The administrator also has `GET /api/admin/backups/google`, `GET …/files`, `POST …/uploads/{name}`
  and `POST …/files/{id}/download`: technical backup management only, with no archive download to the device,
  OAuth management, account address, client ID or detailed connection errors. The admin backups page reuses
  `DrivePanel` with a page-scoped `DriveStore`; restored cloud copies refresh the server list.
  OAuth client — `TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID|_SECRET` or entered by the teacher; proxy
  `TEACHERBOX_BACKUP_GOOGLE_PROXY`. REST (teacher): `GET|DELETE /api/teacher/backups/google`, `PUT …/client`,
  `POST …/authorize` (`{origin}` → consent URL), `GET …/files`, `POST …/files/{id}/download` (202, the copy is
  adopted as a backup via `BackupService.adopt` after the archive check), `POST …/uploads/{name}` (202); redirect
  `/api/public/backups/google/callback` → `/teacher/settings?drive=connected|denied|expired|failed#backups`.
  `DriveIntegrationCheck` for the administrator (no account address).
- `settings/` — admin settings (`/api/admin/settings`): `SettingsCatalog` mirrors `.env.example` (test),
  values in `<data>/config/settings.properties` loaded first by `AdminSettingsLoader`; secrets write-only;
  Compose variables and accounts read-only; change confirmed by password, then restart. Each setting has a
  `section` key (`ai`, `backups`…): the page folds by section (`tb-fold-card`, open ones in `?open=`).
  Sections, titles, hints and value problems come in the language of the request (`Accept-Language`,
  `Wording` pairs `ru`/`en`, `SettingKind.problem(…, Language)`; 0.11.1, ADR-0036).
- `admin/` — logs search and temporary log levels, status (version, uptime, memory, disk, DB, health),
  incomplete Modulith events with resubmit, integration checks (`IntegrationCheck` beans; names and answers in
  the language of the request, `Language.current()`), diagnostics archive.
  Admin actions → `teacherbox.audit` logger.
- Logs — JSON (ECS) in `/data/logs/teacher-box.log` with rotation; console plain text; no personal data.

## Data

`portal_settings` (one row). Platform migration V2 adds the appearance preferences with `fidelity` / `standard`
defaults, preserving existing branding. Scheme IDs: `fidelity`, `tonal-spot`, `vibrant`, `expressive`, `neutral`,
`monochrome`, `content`, `rainbow`, `fruit-salad`. Contrast IDs: `reduced`, `standard`, `increased`, `maximum`.
The teacher's portal update validates both; public portal settings expose them. Omitted preferences in legacy
update requests retain their saved values. Logo changes, administrator updates and setup completion also
preserve them. They are included in backups; full reset restores the defaults.
Backups and settings file live in the data directory, not in the DB.

## Frontend

`features/admin/` (logs, status, events, integrations, backups, settings, diagnostics — `/admin/**`),
`features/settings/` (teacher settings: portal card, setup wizard, backups with the Google Drive panel `backups/drive-panel.ts` and `DriveStore`, reset), `core/portal`.
The Portal card has identity and preview above a nine-scheme gallery, base-colour swatches, an inline custom
colour picker with HEX input and named contrast choices. Changes are previewed locally and applied to the
portal on explicit save. Theme generation lives in `core/theme/`; scheme, contrast and colour each trigger
reapplication. MCU contrast values are −1 / 0 / 0.5 / 1 for the four stored IDs; the UI shows names only.
