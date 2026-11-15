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

- [x] 392.1 **B** *complex* — prune tombstones of deleted elements in `board_scenes.elements`:
  drop a tombstone older than a retention (e.g. 30 days, a constant first) when the scene is saved
  and in the nightly `BoardBackupJob`. Entry points: `boards/domain/SceneElements` (`merge`,
  `restored`), `boards/application/SceneService`, `BoardBackupService.filesOutsideScenes` (images
  referenced only by pruned tombstones become unreferenced). Risk to cover by tests: an editor
  offline longer than the retention must not bring a deleted element back on its next save;
  restore of a copy still deletes current elements. Update `docs/modules/boards.md`.
- [x] 392.2 **F** *simple* — warn the teacher when a scene nears the 5 M chars limit
  (`boards.scene-too-large`): the save answer carries the size, the board shows a hint to make a
  copy and start a new board. `m3-expressive` skill; help article and `docs/wiki/` page in both
  languages.
- [x] 392.3 **B** *complex* — review fixes of 392.1: read deletion records only for the elements
  of a save, restore or pruning (`SceneRetention.deletions`, `SceneRepository.deletions` in
  chunks of 500) instead of all records of the board twice per save; the live channel drops
  retired identities (`LiveRooms.elements`); the nightly pruning runs one transaction per board
  and keeps the scene version (`BoardBackupService.dailyCopies`, `SceneRepository.replaceElements`),
  so it makes no extra daily copy and no `SceneSaved`. ADR-0064 updated.

### 393. H2 file size

- [x] 393.1 **B** *complex* — measure first: a test or script that saves a 1 MB scene 10 000
  times and records the size of `db/` before and after a restart. Record the numbers in this
  substep. *Done as `platform/core/H2FileSizeMeasurement` (off unless
  `-Dteacherbox.measure.h2=true`; the command is in its Javadoc): the URL of `application.yaml`,
  `boards.board_scenes` of V1, one transaction per save, H2 2.4.240, Linux cloud container, 4 CPU.
  Numbers:*
  - *Saves back to back (worst case, 3–4 ms each): the open file grows by ~0.97 MB per 1 MB save
    — 942 MB after 1 000, 3.8 GB after 4 000, 9.7 GB after 10 000. H2 keeps replaced chunks for
    its 45 s retention, so nothing is reused during the burst. After 60 s idle the next saves
    reuse the space (3.9 GB → 2.9 GB or 57 MB while open).*
  - *Saves at the editor's pace (1 per second, `SAVE_DELAY_MS`; 900 + 100 saves, 17 min): the open
    file stays at 58–65 MB; a normal close leaves 1.0 MB. 10 000 saves at that pace (2.8 h) would
    stay on the same plateau: it is bounded by the save rate × the retention, not by the count.*
  - *Restart after the burst: a normal close (H2's default `MAX_COMPACT_TIME` of 200 ms) left
    15 MB, 100 MB, 101 MB, 101 MB, 2.9 GB and 2.9 GB in six runs of 4 000 saves; the close after the
    next start left 1.0–1.9 MB, except with a 768 MB heap (the container's 75 % of 1 GB), where
    2.9 GB survived two restarts. A close with `MAX_COMPACT_TIME=60000` took 1.25 s and left
    16 MB; `SHUTDOWN COMPACT` took 50–70 ms and left 0.5 MB (at 1 MB of live data).*
  - *Start: opening took 9–23 ms whatever the file size (0.5 MB–2.9 GB). Heap after a forced GC
    stayed under 600 MB of 768 MB, most of it the measurement's own strings.*
  - *Side finding: with JVM assertions on (as in Surefire) the burst past ~4 GB of file trips an
    `assert` of H2 (`RandomAccessStore.shrinkStoreIfPossible` → `validateFileLength`, the cached
    length above the measured one, by 8–12 KB, once by 1 GB) in 5 of 6 runs; with assertions off,
    as in production, 3 of 3 runs passed and the data reopened intact. The 10 000-save burst
    stopped 20–30 saves after the idle on the same assert, so its restart numbers come from the
    4 000-save runs.*
- [x] 393.2 **B** *complex* — depending on 393.1: compact on graceful shutdown (`SHUTDOWN
  COMPACT` or `MAX_COMPACT_TIME` in the JDBC URL of `application.yaml`) and/or a nightly compaction
  job (`ZonedJob`, off by `-`, setting via skill `new-setting`). Check the start time and memory
  under the 1 GB container limit. ADR if the open/close behaviour changes; update
  `docs/modules/platform.md`. *Decided from the numbers: no compaction is added, the JDBC URL and
  the open/close behaviour stay as they are (so no ADR); the decision is in
  `docs/modules/platform.md` («H2 file size»). Further runs of `H2FileSizeMeasurement` (4 000
  back-to-back saves, 768 MB heap, assertions off):*
  - *`MAX_COMPACT_TIME=5000`: the first close right after the burst left 2.9 GB in 5 of 5 runs
    (86 and 431 ms where timed), as the default mostly does — the replaced chunks are still within
    the 45 s retention, and no time budget frees them; the second close left 1.0 MB in 3 of 5
    runs and 101–111 MB in 2 (1.3 s there). The default second close left 1.0–1.9 MB in 6 of 7
    runs and 2.9 GB once. A longer budget costs time on a stop and wins nothing stable.*
  - *A close 60 s after the last save: 1.0 MB with the default (1 run; the other run left 2.9 GB
    and the next close 1.0 MB) and with `MAX_COMPACT_TIME=5000` (1 run).*
  - *`SHUTDOWN COMPACT` wins 0.5 MB over a normal close at 1 MB of live data, but rewrites all
    live data on every stop and needs SQL after the last user of the pool; a nightly run closes
    the database, i.e. a nightly outage — H2 has no online full compaction. Not worth it.*
  - *What bounds the file is the save rate, not the save count: ~65 MB per 1 MB scene saved
    once a second, freed by the next restart. Extrapolated: 10 editors saving 1 MB scenes every
    second at once would hold ~650 MB while they work. The size of `db/` reaches the
    administrator's status page in 394.2; revisit if real portals show more.*

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

- [x] 395.1 **B** *complex* — a failed scheduled backup (`ScheduledBackup` in
  `PlatformBackupAutoConfiguration`) and a failed Google Drive upload (`CloudBackupService`) notify
  the teacher (inbox and messengers). Check against ADR-0061 how `platform` may publish
  `shared.notice.NoticeRequested` (it depends on `shared` only); texts in both languages; wiki.
- [x] 395.2 **B** *complex* — less backup volume, teacher's decision: a separate, shorter
  retention for Google Drive copies — new `ADMIN` live setting `TEACHERBOX_BACKUP_GOOGLE_KEEP`
  (the last 3 copies by default, `keepDays` still applies; `BackupProperties.Google`,
  `CloudBackupService.rotate`, `SettingsCatalog`, admin card «Резервные копии»); textbook files
  stay in every archive (no split). ADR-0037 amended, `docs/operations.md`, wiki.

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
