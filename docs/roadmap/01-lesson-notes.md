# 01. Lesson notes and summary

Status: proposal. Size: M. ADR: not needed (new data inside `schedule`, no new dependency).

## Goal

After a lesson the teacher writes in a few taps what was covered and what is next. The student
sees the summary of each held lesson; the teacher sees the history of a student's lessons as a
feed. Today a lesson has only `topic` (`schedule.lessons.topic`, 500 chars) and an outcome, so the
learning history of a student lives nowhere.

## Decisions for the teacher

1. Fields: proposed «Что прошли» (shown to the student) and «Заметка для себя» (teacher only).
   A third «Что дальше» (plan for the next lesson, prefilled into the next lesson's topic)?
2. Per participant in a group lesson, or one summary for the whole group plus a private note per
   student? Proposed: one shared summary + optional private note per participant.
3. Should the student get a notification «Итоги урока» (inbox + messenger), and is it a separate
   preference topic?
4. Should the bot ask for the summary right after «Проведено» is marked from the messenger?
5. AI draft of the summary from the topic, the assignment given and the teacher's short words —
   wanted?

## Design

- Data (`schedule`, migration `V3__lesson_notes.sql`):
  - `lessons.summary` `varchar(4000)` — Markdown, visible to participants;
  - `lessons.next_plan` `varchar(1000)` (if decision 1 keeps it);
  - `lesson_notes (lesson_id, student_id, note varchar(4000), updated_at)` — private, PK
    `(lesson_id, student_id)`; for an individual lesson there is one row.
- The summary is editable only for a lesson that is not `CANCELLED`; it is allowed before the
  outcome too (teacher writes during the lesson). Editing does not change the lesson `version`
  used for optimistic locking of time edits; it has its own `summary_version` or a last-write-wins
  rule — pick last-write-wins with `updated_at` returned, it is one author.
- Series edits (`LessonRepetitionService`) never touch summaries or notes; a deleted lesson takes
  its notes with it (`ScheduleService.delete`), tombstones unchanged.
- Event `LessonSummaryShared(lessonId, studentIds, teacherId)` in `schedule::api`, published when a
  summary becomes non-empty or changes after a quiet period (no event per keystroke: publish on the
  explicit «Отправить ученику» action, not on autosave).
- `notifications`: `ScheduleNotifications` turns it into an inbox record «Итоги урока dd.MM» with a
  link to the lesson, topic `LESSON_SUMMARY` in `NotificationTopic` (default on).
- `ai` (optional, decision 5): `AiFeature.LESSON_SUMMARY`, prompts `lesson-summary.system.v1` /
  `.user.v1`, `POST /api/teacher/ai/lesson-summary {topic, words, assignmentTitles[]}` →
  `{summary}`;
  the frontend passes the texts, `ai` does not depend on `schedule`. Editable system prompt like
  ADR-0043 (`SystemPrompts`).
- Reset: `ScheduleDataReset` covers the new table; `ResetIntegrationTest` will fail until it does.

## Stages

### A — Backend: notes and summary (B)

- [ ] **A.1** Migration, `domain/Lesson` fields, `LessonNote` record, repository methods in
  `persistence/`; `ScheduleService.updateSummary(lessonId, summary, nextPlan)` and
  `ScheduleService.updateNote(lessonId, studentId, note)`; validation errors
  `schedule.summary-too-long`, `schedule.lesson-cancelled`.
  REST: `PUT /api/teacher/schedule/lessons/{id}/summary`, `PUT …/{id}/notes/{studentId}`,
  `POST …/{id}/summary/share`. Views: `ScheduleViews` adds `summary`, `nextPlan`, `notes[]` to the
  teacher lesson view; the student view (`/api/me/schedule/lessons`) gets `summary` only.
  Tests: controller role tests (student 403 on teacher endpoints; another student never sees a
  summary of a lesson they are not in — 404), service tests for cancelled / deleted lessons, a
  test that the student view never carries `notes`.
- [ ] **A.2** `GET /api/teacher/schedule/students/{studentId}/history?before&limit` — held lessons
  of a student (group lessons included) newest first with topic, outcome, summary, own note; and
  `GET /api/me/schedule/history` for the student (summary only). Paging by `before` instant.
- [ ] **A.3** `LessonSummaryShared` event + `notifications` listener, topic, texts in
  `ScheduleMessages` (ru, en), messenger «Открыть» button; preference on the student's «Мой
  аккаунт». Tests: event → inbox + delivery, preference off → inbox only.

### B — Frontend (F, with the `m3-expressive` skill)

- [ ] **B.1** Lesson card (`schedule/teacher/lesson-details-dialog.ts`, rebuilt in stage 288): a
  «Итоги» section — summary field (Markdown, `Текст / Просмотр` like the homework editor), private
  note per participant, «Отправить ученику» action; autosave on blur with a saved indicator. For a
  group the participant notes are a `tb-list` with an expand per student.
- [ ] **B.2** Student card «Занятия» tab (`schedule/teacher/student-lessons-tab.ts`): a «История»
  feed of held lessons with summary and note, «Показать ещё». Group card the same, without
  private notes of others.
- [ ] **B.3** Student side: lesson sheet (`schedule/student/lesson-summary.ts`) shows «Что прошли»;
  a «История занятий» list on the student's schedule page or home.
- [ ] **B.4** (optional) AI draft button in the summary field, using the existing AI side-panel
  pattern (`HomeworkAiState` as the model, but a small inline draft is enough here).

### C — Bot (B, optional by decision 4)

- [ ] **C.1** `schedule/chat/MarkLessonsChatAction`: after «Проведено» offer «Записать итоги» —
  the next text message becomes the summary, «Пропустить» ends the dialog. Audit via
  `AuditLog.bot` as other teacher changes.

### D — Docs and release

- [ ] **D.1** `docs/modules/schedule.md` (rules, data, REST), `docs/modules/notifications.md`
  (topic),
  `docs/wiki/Schedule.md` (Russian), help articles «Расписание» in ru and en; E2E in
  `e2e/tests/schedule/`: teacher writes and shares a summary, student sees it, another student
  does not.

## Risks and out of scope

- Big Markdown texts in every lesson view: the calendar list endpoint must not return summaries —
  only the lesson details and the history endpoints.
- ICS feed and Google Calendar keep no summaries (privacy, and events would churn).
- Attachments to a summary are out of scope: homework already carries files.
