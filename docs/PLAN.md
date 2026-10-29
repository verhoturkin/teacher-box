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

## v0.41.0

Goals: the student card and the homework list scale to hundreds of items; a lesson has a title and
a separate topic, and its summary lives in the lesson card. New ADR for the title / topic split.

### 332. Student card

- [ ] 332.1 **F** «Ближайшие занятия» (`schedule/teacher/student-lessons-card.ts`) as an M3 list:
  a 40 px icon circle (the nearest one primary), «Сегодня, 15:00–16:00» and «title · topic»; the
  custom date tile goes.
- [ ] 332.2 **B F** «Предстоящие» (`student-lessons-tab.ts`): a series is one row («Каждый вт и чт,
  15:00 · 60 мин», since, end, «ещё N»), one-off lessons and exceptions (moved, cancelled) are their
  own rows; «Показать все даты» unfolds the full list.

### 333. Homework list

- [ ] 333.1 **F** `homework/teacher/assignments-page.ts`: assignments grouped by deadline («Срок на
  этой неделе», «Позже», «Без срока», «Просрочено» folded), a «Кому» select (student or group, in
  the address); «Готовые» loads 20 at a time.

### 334. Lesson title and topic

- [ ] 334.1 **B** `schedule`: the column `topic` becomes `title` (default from the student or the
  group: calendar, ICS, Google, bot, events to billing), a new nullable `topic` (what the lesson
  covers); a saved «Тема следующего занятия» goes into the topic of the next planned lesson of the
  same student or group when empty. ADR, `docs/modules/schedule.md`.
- [ ] 334.2 **F** Lesson form and card: «Название» and «Тема»; the topic in the card, the home hero,
  the student's views.

### 335. Summary in the lesson card

- [ ] 335.1 **F** The lesson card holds «Что прошли» (prefilled with the topic, visible to the
  students, AI «Черновик» kept) and «Тема следующего занятия», with «Сохранить» and «Отправить
  ученику»; the dialog «Итоги урока» goes; private notes are no longer written, old ones stay
  read-only in «История».
- [ ] 335.2 Release 0.41.0 (skill `release`).

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

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
