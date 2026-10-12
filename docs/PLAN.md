# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md); don't read them
unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5 lines),
  new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes (`schedule/teacher/lesson-details-dialog.ts`,
  `ScheduleService.cancel`) — so the work starts there instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to Backlog. This file
  keeps only unreleased work and the Backlog.

## v0.12.0

Goals: copies of the portal backups in the teacher's Google Drive besides the local ones (a disaster on the server
no longer takes the backups with it; a copy from the cloud can be brought back to the server and restored); the
portal backup keeps only the current version of each board — its copies (daily and the teacher's) and the images
only they use stay out, so backups do not grow with the board history.

ADR: 0037 — backups in Google Drive and what the portal backup leaves out.

### Stage 157. Only the current board in the portal backup (B)

- [x] 157.1 SPI `shared.backup.BackupExclusions` (tables whose rows stay out, files of the module's namespace that
  stay out); `platform/backup/BackupService.writeDatabase` drops the H2 `SCRIPT` rows of those tables together
  with their `SYSTEM_LOB_STREAM` parts (`BackupDump`), `writeFiles` skips the files;
  `boards/application/BoardsBackupExclusions`: `boards.board_backups` and the images no scene uses (rows of
  images without a file are removed by `BoardBackupService.collectGarbage` as before). Docs: `boards.md`,
  `platform.md`.

### Stage 158. Backups in Google Drive (B, F)

- [x] 158.1 B: `platform/backup/drive/` — `DriveApi` (Google OAuth, Drive v3 with scope `drive.file`: folder,
  resumable upload, list, download, delete, account), the connection in `<data-dir>/google-drive.json` (survives
  a restore and a full reset, like the local backups), `CloudBackupService` (status, OAuth client from the
  interface or `TEACHERBOX_BACKUP_GOOGLE_CLIENT_ID|_SECRET`, authorize / callback, disconnect, upload of every
  scheduled and manual backup after `BackupCreated` in the background, rotation to `TEACHERBOX_BACKUP_KEEP`,
  list, upload of a chosen backup, download of a cloud copy to the server for a restore),
  `TEACHERBOX_BACKUP_GOOGLE_PROXY`; REST `/api/teacher/backups/google/**`,
  `/api/public/backups/google/callback`; `DriveIntegrationCheck`. ADR-0037, `platform.md`.
- [ ] 158.2 F: `settings/backups/drive-panel.ts` in the teacher's backups card — client, connect / disconnect,
  last upload and error, cloud copies with «Перенести на сервер»; «Отправить в Google Диск» in a backup's menu and
  a cloud mark on backups that are already there; return from Google (`?drive=`).

### Stage 159. Release 0.12.0

- [ ] 159.1 Skill `release`: help, E2E `version-0-12-0.spec.ts`, CHANGELOG, version, archive.

## Backlog

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
