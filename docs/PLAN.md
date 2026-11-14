# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Every new substep carries a complexity mark — *simple* (mechanical edit, docs, config) or
  *complex* (architecture, big refactor, subtle bug) — so the user or an orchestrating agent picks
  the model: smaller for simple, larger for complex. Several complex substeps do not share a
  session.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Next release

Goals: keep a portal healthy after a year or more of use. Board scenes stop growing without bound,
the H2 file is compacted, `restore/` leftovers and backups no longer fill the disk, the teacher
learns that a scheduled backup failed, and operations docs state the disk budget and the RPO.

Source: long-term risk review of 2026-11-14 (static review of the code, nothing measured). ADRs:
a new one if 393 changes how the database is opened or closed; 395 may amend ADR-0037.

### 392. Board scene tombstones

- [ ] 392.1 **B** *complex* — prune tombstones of deleted elements in `board_scenes.elements`:
  drop a tombstone older than a retention (e.g. 30 days, a constant first) when the scene is saved
  and in the nightly `BoardBackupJob`. Entry points: `boards/domain/SceneElements` (`merge`,
  `restored`), `boards/application/SceneService`, `BoardBackupService.filesOutsideScenes` (images
  referenced only by pruned tombstones become unreferenced). Risk to cover by tests: an editor
  offline longer than the retention must not bring a deleted element back on its next save;
  restore of a copy still deletes current elements. Update `docs/modules/boards.md`.
- [ ] 392.2 **F** *simple* — warn the teacher when a scene nears the 5 M chars limit
  (`boards.scene-too-large`): the save answer carries the size, the board shows a hint to make a
  copy and start a new board. `m3-expressive` skill; help article and `docs/wiki/` page in both
  languages.

### 393. H2 file size

- [ ] 393.1 **B** *complex* — measure first: a test or script that saves a 1 MB scene 10 000
  times and records the size of `db/` before and after a restart. Record the numbers in this
  substep.
- [ ] 393.2 **B** *complex* — depending on 393.1: compact on graceful shutdown (`SHUTDOWN
  COMPACT` or `MAX_COMPACT_TIME` in the JDBC URL of `application.yaml`) and/or a nightly compaction
  job (`ZonedJob`, off by `-`, setting via skill `new-setting`). Check the start time and memory
  under the 1 GB container limit. ADR if the open/close behaviour changes; update
  `docs/modules/platform.md`.

### 394. Disk usage of data and backups

- [ ] 394.1 **B** *simple* — delete `restore/previous-*` and `restore/applied/*` older than
  `TEACHERBOX_BACKUP_KEEP_DAYS` after a successful start (`platform/backup/PendingRestore`);
  `restore/failed/` keeps its archives. Tests in `PendingRestore*Tests`; update
  `docs/operations.md` («Восстановление вручную»).
- [ ] 394.2 **B F** *simple* — sizes of `db/`, `files/`, `backups/`, `restore/` and free disk space
  on the administrator's status page (`platform/admin/SystemStatus`, `features/admin/` status);
  a warning when free space is below the size of the last backup. `m3-expressive` skill; wiki.
- [ ] 394.3 **B** *simple* — before `BackupService.create` check free space against the size of
  the last backup and fail with a clear reason instead of a half-written `.part`.

### 395. Backup volume and failures

- [ ] 395.1 **B** *complex* — a failed scheduled backup (`ScheduledBackup` in
  `PlatformBackupAutoConfiguration`) and a failed Google Drive upload (`CloudBackupService`) notify
  the teacher (inbox and messengers). Check against ADR-0061 how `platform` may publish
  `shared.notice.NoticeRequested` (it depends on `shared` only); texts in both languages; wiki.
- [ ] 395.2 **B** *complex* — less backup volume: a separate retention for Google Drive copies
  (e.g. last 3) and/or textbook files (`files/textbooks/`, change rarely) not repeated in every
  archive — needs the teacher's decision on which; ADR-0037 amendment, skill `new-setting` for a
  new retention, `docs/operations.md`.

### 396. Operations docs

- [ ] 396.1 *simple* — `docs/operations.md`: disk budget (data × (keep days + 1) on the server, the
  same in Google Drive against its quota), RPO of up to 24 hours with nightly backups and how to
  shorten it (a second backup cron), board history not in the portal backup, H2 major upgrades go
  through the SQL dump of a backup. Wiki page in both languages.


## Backlog

- Candidates for `shared/` from 387.5: `EditorAutosave`, `WhomFilter`.
- `ArchitectureTests.BUSINESS_MODULES` lacks `textbooks`: derive it like `SchemaIsolationTests`.

After the bundle measurement of 2026-11-11 (see [0.47.1](archive/plans/v0.47.1.md)), not planned:

- Attachments are served with `no-store` (`shared/http/FileDownloads`), so pictures of homework are
  downloaded at every opening; boards serve theirs as `private, immutable`. Needs the teacher's
  decision: a private cache keeps files on a shared computer.
- One language of the dictionaries per load: the unused language is 19 kB of the initial bundle
  and 128 kB over all lazy chunks — too little for the change it needs.
- Caddy alone instead of Caddy in front of nginx (profile `https`): changes ADR-0031 and ADR-0032.

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Voice answers («Записать голос»): `MediaRecorder` in the answer panel of `my-task-page.ts` would upload
a record as an attachment. Missing: the browser records `audio/webm` and `FilePolicy` accepts no `webm` (a one-line
addition, plus `ACCEPTED_FILES`); decided against for now.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
