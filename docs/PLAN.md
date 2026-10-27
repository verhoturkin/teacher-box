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

## v0.37.0

Goal: lesson notes and summary (roadmap 01). After a lesson the teacher writes «Что прошли» (seen by
the participants), «Что дальше» (plan, prefilled into the next lesson's topic) and a private
«Заметка для себя» per student; the student gets «Итоги урока» and both sides see a history feed of
held lessons. No ADR (new data inside `schedule`, no new module dependency). Decisions of the
teacher (2026-10-27): three fields; one shared summary per lesson + an optional private note per
participant in a group; notification «Итоги урока» (inbox + messenger) with its own preference
topic, on by default; the bot offers «Записать итоги» after «Проведено»; an AI draft of the summary.

Design:

- Data (`schedule`, migration `V3__lesson_notes.sql`): `lessons.summary` `varchar(4000)` (Markdown,
  visible to participants), `lessons.next_plan` `varchar(1000)`, `lessons.summary_updated_at`;
  table `lesson_notes (lesson_id, student_id, note varchar(4000), updated_at)`, PK
  `(lesson_id, student_id)`, private to the teacher.
- Summary and notes are editable only for a lesson that has started (`startsAt <= now`) and is not
  `CANCELLED`; a `MISSED` lesson with one student has none (a missed group lesson keeps them), the
  share action follows the same rule. Last write wins with `updated_at` returned (one author); edits never bump the lesson `version`
  used to lock time edits. Series edits (`LessonRepetitionService`) never touch them; deleting a
  lesson deletes its notes.
- «Что дальше» prefill (our decision): saving a non-empty `nextPlan` copies it into the topic of
  the next planned lesson of the same participants (same student, or same group) if that topic is
  empty; a filled topic is never overwritten.
- The calendar list endpoints, ICS and Google Calendar never carry summaries or notes — only the
  lesson details and the history endpoints.
- Event `LessonSummaryShared(lessonId, studentIds, teacherId)` in `schedule::api`, published only
  by the explicit «Сохранить и отправить» action, never by a plain save.
- AI: `ai` does not depend on `schedule`; the frontend sends the texts.

### Stage 304 — Summary and notes (B)

- [x] 304.1 B: migration `V3__lesson_notes.sql`, `domain/Lesson` fields, `LessonNote` record,
  repository methods in `schedule/persistence/`; `ScheduleService.updateSummary(lessonId, summary,
  nextPlan)` (with the «Что дальше» prefill above) and `ScheduleService.updateNote(lessonId,
  studentId, note)`; errors `schedule.summary-too-long`, `schedule.lesson-cancelled`,
  `schedule.not-a-participant`. REST: `PUT /api/teacher/schedule/lessons/{id}/summary`,
  `PUT …/{id}/notes/{studentId}`. `ScheduleViews`: the teacher lesson details get `summary`,
  `nextPlan`, `notes[]`; the student lesson view (`/api/me/schedule/lessons/…`) gets `summary`
  only. `ScheduleDataReset` covers `lesson_notes` (`ResetIntegrationTest`). Tests: controller roles
  (student 403 on teacher endpoints; another student never sees a summary of a lesson they are not
  in — 404); service — cancelled lesson, deleted lesson takes its notes, prefill only into an empty
  topic; the student view never carries `notes`; calendar list carries no summary.
- [x] 304.2 B: `GET /api/teacher/schedule/students/{studentId}/history?before&limit` — held lessons
  of a student (group lessons included), newest first: date, topic, outcome, summary, nextPlan, own
  note; `GET /api/teacher/schedule/groups/{groupId}/history` — the same without private notes;
  `GET /api/me/schedule/history` for the student — summary only. Paging by the `before` instant.
  Tests: roles, paging, a student sees only own lessons.

### Stage 305 — Notification «Итоги урока» (B)

- [x] 305.1 B: `POST /api/teacher/schedule/lessons/{id}/summary/share` (empty summary →
  `schedule.summary-empty`) publishes `LessonSummaryShared`; `notifications`:
  `ScheduleNotifications` turns it into an inbox record «Итоги урока dd.MM» with a link to the
  lesson and a messenger «Открыть» button; topic `LESSON_SUMMARY` in `NotificationTopic` (default
  on), texts ru/en, the preference on the student's «Мой аккаунт» (backend list of topics; the
  frontend picks it up if the list is data-driven, else in 307.1). Tests: event → inbox + delivery,
  preference off → inbox only, `ModularityTests`.

### Stage 306 — AI draft of the summary (B)

- [x] 306.1 B: `AiFeature.LESSON_SUMMARY`, prompts `lesson-summary.system.v1` / `.user.v1`, editable
  system prompt in `SystemPrompts` (as ADR-0043), `POST /api/teacher/ai/lesson-summary {topic,
  words, assignmentTitles[]}` → `{summary}`. Tests: controller roles, prompt rendering, disabled AI →
  the usual error.

### Stage 307 — «Итоги» in the lesson card (F, `m3-expressive`)

- [x] 307.1 F: `schedule/teacher/lesson-details-dialog.ts` — one `tb-list` row «Итоги» (the first
  line of «Что прошли» or «Добавить итоги», chevron) for a started lesson that is not cancelled and
  not an individual `MISSED` one; it opens the dialog «Итоги урока» (`lesson-summary-dialog.ts`,
  `tb-dialog`): «Что прошли» (Markdown, `Текст / Просмотр` like the homework editor), «Что дальше»,
  private «Заметка для себя» (a group: a `tb-list` with an expand per student). Explicit
  «Отмена» / «Сохранить» / «Сохранить и отправить» (disabled for an empty summary), no autosave;
  snackbars «Итоги сохранены» / «Итоги отправлены». Backend: the writes and the share reject a
  lesson that has not started (`schedule.lesson-not-started`) and an individual `MISSED` one
  (`schedule.lesson-missed`). Unit tests.
- [x] 307.2 F: AI draft button in the «Что прошли» field of the dialog «Итоги урока» — a small inline draft from the topic, the
  assignments given at the lesson and the teacher's short words (`HomeworkAiState` as the model),
  shown only when the AI feature is on. Unit tests.
- [x] 307.3 F: the date and time of the lesson card stay on one line (wrap only on a narrow phone):
  the rows of `schedule/ui/lesson-card.ts` share the columns of the list (subgrid), so the wide
  «Итог» toggle squeezed the text column of every row; its row now keeps its own
  columns (CSS only, checked in the browser).
- [x] 307.4 F: students list — the trailing column (debt, status, «Архив») is as wide as its own
  row's content and absent when empty, the text takes its place: modifier `tb-list--own-trail`
  (`styles.scss`: own columns per row, no subgrid; a row without `tb-list__trail` spans the text
  over it) on the list of `identity/students/students-page.ts` (`hasTrail`). Other lists keep the
  shared column. Unit tests.

### Stage 308 — History feeds (F, `m3-expressive`)

- [ ] 308.1 F: student card «Занятия» tab (`schedule/teacher/student-lessons-tab.ts`) — feed
  «История» of held lessons with summary, «Что дальше» and note, «Показать ещё»; the group card the
  same without private notes. Unit tests.
- [ ] 308.2 F: student side — the lesson sheet (`schedule/student/lesson-summary.ts`) shows «Что
  прошли»; a «История занятий» list on the student's schedule page; the inbox link opens the lesson.
  Unit tests.

### Stage 309 — «Записать итоги» in the bot (B)

- [ ] 309.1 B: `schedule/chat/MarkLessonsChatAction` — after «Проведено» offer «Записать итоги» /
  «Пропустить»; the next text message becomes the summary (`ScheduleService.updateSummary`), then
  «Отправить ученику» / «Готово». Rights as REST, audit via `AuditLog.bot`. Tests: dialog paths,
  too-long text, a non-teacher chat.

### Stage 310 — Docs and release 0.37.0

- [ ] 310.1 docs + E2E: `docs/modules/schedule.md` (rules, data, REST),
  `docs/modules/notifications.md` (topic), `docs/modules/ai.md` (feature), `docs/screens.md` (lesson card, history), `docs/wiki/`
  (Schedule, AI, messengers — Russian), help articles «Расписание» in every language; E2E in
  `e2e/tests/schedule/`: the teacher writes and shares a summary, the student sees it in the inbox
  and the history, another student does not.
- [ ] 310.2 Release 0.37.0 (skill `release`).

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes, web
push, self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
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
