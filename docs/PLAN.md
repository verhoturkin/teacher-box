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

## v0.18.0

User guides move to the GitHub wiki (enabled 2026-10-16) with a slim README; the wiki becomes part of every
release. Before the first installations: `teacherbox reset` wipes everything a new installation would not have,
the migrations of every module restart from one `V1`, backups are kept a number of days instead of a number of
copies.

### 208. User guides to the wiki, slim README (D)

- [x] 208.1 **D** Wiki pages (`teacher-box.wiki.git`): `Home`, `Features`, `Install`, `First-steps`,
  `Update`, `Backups`, `Messengers`, `Schedule`, `Calls`, `Boards`, `AI-assistant`, `Proxy`, `FAQ`
  (Russian, from README; repo links made absolute). Process follows the move: skill `new-setting`
  §4 and `AGENTS.md` §6.1 point user settings at the wiki, `docs/operations.md` proxy link → wiki.
- [x] 208.2 **D** Slim stylish README (~150 lines, Russian): centered hero, badges, highlights,
  feature grid, one-command install, short manual/HTTPS/NAS (`<details>`), first steps, update,
  settings, FAQ and security in short, links to the wiki pages.

### 209. Full data wipe in the `teacherbox` command (D)

- [ ] 209.1 **D** `scripts/teacherbox reset [--yes]`: asks for «УДАЛИТЬ», `compose down --volumes --remove-orphans`,
  then removes what is left with the project label (containers of profiles turned off, volumes, networks), starts
  the portal and prints the login and the new password — as after a new installation; `compose.yaml`, `.env` and
  images stay. `verify.sh` dry run checks the command; `docs/operations.md`, admin help, wiki `Backups`/`FAQ`/`Install`.

### 210. Migrations restart from V1 (B)

- [x] 210.1 **B** One `V1__create_<module>_schema.sql` per module in `db/migration/<module>/` (the schema the old
  V1…Vn produced — compared through H2 `INFORMATION_SCHEMA`: columns, checks, keys, indexes, seed rows). Tests tied
  to old schemas: none run old versions or data migrations; the pre-0.3 "backup without a kind" wording goes.
  `backend/AGENTS.md`: a released script is never edited.

### 211. Backups kept N days (B, F)

- [ ] 211.1 **B** `TEACHERBOX_BACKUP_KEEP_DAYS` (14) replaces `TEACHERBOX_BACKUP_KEEP`: `BackupProperties.keepDays`,
  `BackupService.deleteExpired` (every kind, by file time, after a new backup), `CloudBackupService.rotate` (Drive
  files uploaded earlier); `SettingsCatalog`, `.env.example`, `docs/modules/platform.md`, `docs/operations.md`,
  ADR-0014/0037 notes. **F** settings texts (`settings/i18n`), admin settings fixtures and specs.

### 212. The wiki in the release rules (D)

- [ ] 212.1 **D** `AGENTS.md` §2, §6.1, §9, `CLAUDE.md` workflow, skills `release` (wiki pages, LF clone, push
  after the tag) and `new-setting`, `backend/AGENTS.md`.

### 213. Release 0.18.0

- [ ] 213.1 Help (teacher, admin; ru, en), wiki pages, E2E `version-0-18-0.spec.ts`, CHANGELOG, version, archive.

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
