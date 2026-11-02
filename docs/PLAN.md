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
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## Repository maintenance

### Stage 336 — GitHub releases and README screenshots

- [x] **336.1** Publish missing GitHub releases for existing version tags using their
  `CHANGELOG.md` entries; refresh the nine `docs/assets/readme/*.png` screenshots from a
  disposable instance of v0.41.0 with fictional students and verify the README image links.

## Next release

Homework after the review of 0.43.0: the editor's section menu adds videos and boards, the open
assignment gives the task the main column and the students a narrow one, the video settings are
a dialog over the editor (sketches 4, 11, 39, 40 on the design canvas).

### Stage 354 — editor, open assignment, video dialog

- [x] **354.1 F** Editor materials (sketch 11): videos and the board leave «Материалы» for the
  left section menu («Добавить: Видео, Доску») and get sections of their own; «Тест с
  вопросами» leaves the materials (the test lives on «Тест»); textbooks and files are one
  segmented list without the extra gap; segmented lists keep the 16 px outer corner inside cards
  and dialogs (`styles.scss` `.tb-list`, `tb-list-group`). Entry points:
  `homework/teacher/assignment-editor-page.ts`, `homework/ui/material-chips.ts`,
  `shared/ui/section-nav.ts`.
- [x] **354.2 F** Open assignment on a wide screen (sketch 4): the task in the main column (text,
  materials as a segmented list, the test line), the students in a narrow right column grouped
  by status («Проверить», «На доработке», «Принято»; empty groups hidden) with compact rows,
  «Выдать ещё» as an icon button, «Ошибки по вопросам» under the students; medium and compact
  layouts (sketches 18, 7) unchanged. Entry point: `homework/teacher/assignment-page.ts`.
- [x] **354.3 F** Video settings as a dialog (sketches 39, 40): «Видео N из M» with previous and
  next, player, title, transcript, «Показывать расшифровку ученику», «Убрать видео» and
  «Готово»; changes save at once; full screen on a phone. Entry point:
  `homework/teacher/video-section.ts`.

## Backlog

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
