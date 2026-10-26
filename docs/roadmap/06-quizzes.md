# 06. Auto-checked quizzes

Status: proposal. Size: L. ADR: yes — «Вопросы с автопроверкой в задании», amends ADR-0041 (no
kinds: a quiz is a part of an assignment, not a new kind).

## Goal

An assignment may have, next to its Markdown text, a list of questions the portal checks itself:
single choice, multiple choice, short answer, number. The student answers in the portal and sees
the result at once (or after the due date); the teacher sees the score and the wrong answers and
still reviews the work as today. AI drafts the questions from a textbook, file or video — the same
sources as the homework draft.

## Why it differs from the removed interactive pages (ADR-0040 → 0041)

Those were AI-generated HTML pages run in a sandbox: unsafe to render, impossible to check on the
server. Here questions are structured data validated by a schema and checked by the backend.

## Decisions for the teacher

1. Question types in v1: single, multiple, short text (several accepted answers, case and `ё/е`
   insensitive), number (with tolerance). Matching and ordering in v2?
2. When the student sees correct answers: at once, after submitting, after the due date, never.
3. Attempts: one, N, unlimited; which attempt counts (last / best).
4. Does the quiz score go into the task score (02 A) automatically, as a suggestion, or never?
5. Points per question or all equal?

## Design

- `homework` data (migration): `assignment_questions (id, assignment_id, position, type, text
  varchar(2000), options json, answer json, points smallint, explanation varchar(2000))`;
  `quiz_attempts (id, task_id, started_at, submitted_at, score_points, max_points)`;
  `quiz_answers (attempt_id, question_id, answer json, correct boolean, points)`.
  H2 has `JSON` type; store as `varchar` with Jackson 3 mapping if H2 `JSON` fights `JdbcClient`
  (check first). Max 50 questions per assignment.
- Domain `domain/quiz/`: sealed `Question` (Single, Multiple, ShortText, Numeric) with
  `check(Answer)` pure functions; normalization of short answers (trim, collapse spaces, case,
  `ё→е`, optional punctuation strip) — table tests.
- An assignment with questions: editing questions after a student started an attempt creates a new
  assignment version or is refused (`homework.quiz-started`) — pick refusal for v1, simpler.
- REST: teacher — questions in the create / update request (`questions[]`, replaces as `videos`
  does); student — `GET /api/me/homework/tasks/{id}/quiz` (questions without answers), `POST …/quiz/
  attempts`, `PUT …/attempts/{id}/answers/{questionId}` (autosave), `POST …/attempts/{id}/submit`
  → result per decision 2. The answer key never reaches the student before the rule allows it —
  a test asserts the JSON.
- Submitting a quiz does not submit the task: the student still presses «Сдать» (the work may
  have a text part). Option for a quiz-only assignment: «Сдать» submits both.
- `ai`: `AiFeature.QUIZ_DRAFT`, schema `{questions: [...]}` with the same sources as homework
  draft (`DraftSources`), editable system prompt, output validated by the same domain types.
- Review page (`homework/teacher/task-review-page.ts`): «Тест: 7 из 10» with wrong answers listed;
  per-question override by the teacher (accept a short answer the key missed).

## Stages

- [ ] **A.1** (B) ADR, migration, quiz domain with table tests, repository.
- [ ] **A.2** (B) Teacher REST (questions in assignment requests), validation errors, tests.
- [ ] **A.3** (B) Student attempts REST, reveal rules, attempts limit, tests incl. «answers are not
  leaked», «another student 404», overdue rules.
- [ ] **A.4** (B) AI quiz draft feature + prompts + tests against the local HTTP server / mock.
- [ ] **B.1** (F) Editor «Вопросы» card in `assignment-editor-page.ts` (like `video-section.ts`):
  add question by type, options with «верный» toggles, accepted answers chips, reorder,
  `canLeave` dirty tracking.
- [ ] **B.2** (F) Student quiz on `my-task-page.ts`: one question per screen on compact, list on
  wide; autosave; result view.
- [ ] **B.3** (F) Review page block and per-question override; assignment page stats («вопрос 3 —
  ошиблись 4 из 6»).
- [ ] **B.4** (F) AI panel «Вопросы» mode in the editor's AI pane.
- [ ] **C.1** Docs: `docs/modules/homework.md`, `docs/modules/ai.md`, wiki «Задания» / AI page,
  help ru/en, E2E `e2e/tests/homework/quiz.spec.ts`.

## Risks and out of scope

- Formulas in questions: Markdown only; KaTeX rendering is a separate decision.
- Board-based answers and audio answers — out of scope.
