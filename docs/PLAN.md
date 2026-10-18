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

## v0.18.1

The wiki sources move into the repository: pages are edited and reviewed in the same branch as the code, CI
publishes them for every release tag, so the wiki shows the released version and no manual push is left.

### 215. The wiki in the repository (D)

- [x] 215.1 **D** `docs/wiki/` from `teacher-box.wiki.git` (with the unpushed 0.18.0 pages) + `_Footer.md`;
  `scripts/publish-wiki.sh`, CI job «Publish the wiki» after the images on a tag, manual `wiki.yml`;
  `scripts/check-wiki.sh` (`verify.sh docs`, pre-commit for `*.md`, CI job «Docs»); `AGENTS.md` §2, §3, §6.1,
  §9, `CLAUDE.md`, skills `release`, `new-setting`.

### 216. Interface fixes (F)

- [x] 216.1 **F** No divider under the top bar on the phone (`core/layout/shell.scss`); the dropped lesson's
  «Перенести» / «Отменить перенос» in the middle of its card as M3E extra small icon buttons (filled wide ✓,
  tonal ✕) over a surface veil (`styles.scss` `.tb-lesson-move`); a chip in student multiselects is removed with «×», not the «!» of `times-circle`
  (`styles.scss` `.p-chip`); no divider above «Прочитанные» in the inbox (`notifications/inbox/inbox-panel.ts`).

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
