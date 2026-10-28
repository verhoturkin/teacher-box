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

## v0.39.0 — auto-checked quizzes (stages 318–327)

Goal (roadmap 06): an assignment may have, next to its Markdown text, a list of questions the
portal checks itself. The student answers in the portal and sees the result; the teacher sees the
score and the wrong answers and still reviews the work as today. AI drafts the questions from the
same sources as the homework draft. ADR 0052 «Вопросы с автопроверкой в задании» (amends ADR-0041:
a quiz is a part of an assignment, not a new kind; unlike ADR-0040 the questions are structured
data checked by the backend).

Decisions of the teacher (2026-10-28):

1. Six question types in this release: single choice, multiple choice, short text (several
   accepted answers; trim, collapsed spaces, case and `ё/е` insensitive), number (with a
   tolerance), matching (pairs left ↔ right, the right column shuffled), ordering (items to put in
   order, shown shuffled).
2. When the student sees the correct answers — a setting of the assignment: right after submitting
   the quiz (default), after the due date, never. The score itself is shown right after submitting.
3. Attempts — a setting of the assignment: 1, N or unlimited (default 1); the **best** attempt
   counts.
4. Each question has its own points (default 1; matching and ordering — all or nothing in v1). The
   quiz score is **suggested** into the review grade field («7 из 10»), the teacher may change it.

Design:

- `homework` data (migration `V3__quizzes.sql` or the next free number):
  `assignment_questions (id, assignment_id, position, type, text varchar(2000), options
  varchar/json, answer varchar/json, points smallint, explanation varchar(2000))`;
  assignment columns `quiz_reveal` (`AFTER_SUBMIT` / `AFTER_DUE` / `NEVER`) and `quiz_attempts`
  (null = unlimited); `quiz_attempts (id, task_id, started_at, submitted_at, score_points,
  max_points)`; `quiz_answers (attempt_id, question_id, answer, correct, points, overridden)`.
  Check whether H2 `JSON` works with `JdbcClient`; otherwise `varchar` + Jackson 3. Max 50
  questions per assignment, 2–10 options / pairs / items.
- Domain `homework/domain/quiz/`: sealed `Question` (`SingleChoice`, `MultipleChoice`, `ShortText`,
  `Numeric`, `Matching`, `Ordering`) with pure `check(answer)`; short-answer normalization
  (trim, collapse spaces, case, `ё→е`) — table tests. Options, pairs and items carry stable ids, so
  the student's answer refers to ids and a shuffled view leaks nothing.
- Editing questions after any student started an attempt is refused (`homework.quiz-started`);
  the assignment's text, files and settings stay editable.
- REST, teacher: `questions[]`, `quizReveal`, `quizAttempts` in the assignment create / update
  requests (replace the list as `videos` does); task review details carry the best attempt with
  each answer and its correctness; `PUT /api/teacher/homework/tasks/{id}/quiz/answers/{questionId}`
  overrides one answer as correct / wrong (recomputes the score); assignment stats per question
  («ошиблись 4 из 6»).
- REST, student: `GET /api/me/homework/tasks/{id}/quiz` (questions without the key, options /
  pairs / items shuffled per attempt, attempts used and left, best score), `POST …/quiz/attempts`,
  `PUT …/quiz/attempts/{attemptId}/answers/{questionId}` (autosave), `POST …/quiz/attempts/
  {attemptId}/submit` → score, and correct answers + explanations only when the reveal rule
  allows. A test asserts the JSON never holds the key before that. Another student's task → 404.
  Attempts are closed once the task is submitted / accepted.
- Submitting a quiz does not submit the task: the student still presses «Сдать». For an assignment
  with questions and no text answer expected the «Сдать» button submits the open attempt too.
- `ai`: `AiFeature.QUIZ_DRAFT`, JSON schema `{questions: [...]}` with the six types, sources from
  `DraftSources` (as the homework draft), an editable system prompt (`SystemPrompts`,
  `PromptLibrary`). `ai` must not see `homework` internals: the output is validated through a
  `homework::api` facade method (e.g. `QuizQuestions.validate(...)`) or a schema-level check in
  `ai` mirrored by the homework validation on save.
- Out of scope: KaTeX in questions (Markdown only), board and audio answers, partial points for
  matching / ordering.

### Stage 318 — Quiz domain and data (B)

- [x] 318.1 B: ADR 0052 (+ row in `docs/adr/README.md`); migration; `homework/domain/quiz/` sealed
  `Question` with the six types, `check`, normalization, validation (limits, ids, at least one
  correct option) — table tests; `QuestionRepository` / `QuizAttemptRepository` in
  `homework/persistence/` with repository tests; `HomeworkDataReset` and the backup cover the new
  tables.

### Stage 319 — Teacher REST (B)

- [x] 319.1 B: `questions[]`, `quizReveal`, `quizAttempts` in the assignment requests and views
  (`TeacherHomeworkController`, `AssignmentService`, `HomeworkViews`); validation errors with
  codes (`homework.quiz-*`); refusal `homework.quiz-started`; controller tests with role checks
  (student → 403).

### Stage 320 — Student attempts REST (B)

- [x] 320.1 B: `MyHomeworkController` + a `QuizService` (`homework/application/`): get quiz, start
  attempt (limit), autosave answer, submit (best attempt, score), reveal rules (after submit / after
  due / never), shuffling by stable ids; «Сдать» of a quiz-only assignment submits the open attempt
  (`StudentHomeworkService`). Tests: «the key is not leaked» (JSON assertions per reveal rule),
  «another student 404», attempt limit, overdue, task already submitted.

### Stage 321 — Review results and stats (B)

- [x] 321.1 B: quiz result in the task review details (`TaskDetailsAssembler`), grade suggestion
  «N из M», per-answer override `PUT /api/teacher/homework/tasks/{id}/quiz/answers/{questionId}`
  (recomputes the attempt score), per-question stats of an assignment. Tests incl. roles.

### Stage 322 — AI quiz draft (B)

- [ ] 322.1 B: `AiFeature.QUIZ_DRAFT`, JSON schema, system prompt (`SystemPrompts`,
  `PromptLibrary`, editable like the others), sources via `DraftSources`, endpoint next to the
  homework draft, output validated (see Design; module isolation §4.2 — `ai` may use
  `homework::api` only). Tests against the local HTTP server / mock LLM as the existing drafts do.

### Stage 323 — Question editor (F, `m3-expressive`)

- [ ] 323.1 F: «Вопросы» card in `homework/teacher/assignment-editor-page.ts` (a component like
  `video-section.ts`): add a question by type, options with «верный» toggles, accepted answers
  chips, number + tolerance, matching pairs, ordering items, points, explanation, reorder, delete;
  reveal and attempts settings; `canLeave` dirty tracking; server errors shown on the fields;
  locked state after `homework.quiz-started`. Unit tests; browser check (compact and wide).

### Stage 324 — Student quiz (F, `m3-expressive`)

- [ ] 324.1 F: quiz on `homework/student/my-task-page.ts`: one question per screen on compact, a
  list on wide; inputs for the six types (matching and ordering usable by touch and keyboard, no
  drag-only interaction); autosave; submit with confirmation; result view (score, correct answers
  when revealed, explanations), new attempt when allowed. Unit tests; browser check.

### Stage 325 — Review and AI in the frontend (F, `m3-expressive`)

- [ ] 325.1 F: review page block «Тест: 7 из 10» with the answers, wrong ones first, per-answer
  override, the grade suggestion in the grade field (`homework/teacher/task-review-page.ts`);
  per-question stats on `assignment-page.ts`. Unit tests; browser check.
- [ ] 325.2 F: «Вопросы» mode in the editor's AI pane (`ai/homework-ai-panel.ts`): draft questions
  from the sources, review, apply (append / replace). Unit tests; browser check.

### Stage 326 — Docs and E2E

- [ ] 326.1 Docs: `docs/modules/homework.md`, `docs/modules/ai.md`, `docs/screens.md`, wiki pages
  for homework and AI (`docs/wiki/`), help articles in every language; E2E
  `e2e/tests/homework/quiz.spec.ts` (teacher creates a quiz with all six types, student answers,
  reveal rule, best attempt, teacher override and grade suggestion).

### Stage 327 — Release 0.39.0

- [ ] 327.1 Release per skill `release` with a **full E2E run** (`./scripts/e2e.sh`, all suites)
  and a browser check of the changed screens: help articles, CHANGELOG, version bump, archive this
  section, delete `docs/roadmap/06-quizzes.md` and update its row in `docs/roadmap/README.md`.

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
