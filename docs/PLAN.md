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

## v0.43.0 — Homework from the second sketch set

The 0.42.0 screens follow the first sketches; the teacher has since drawn the rest of the section
and the transitions between screens. Split the editor into «Задание · Тест» tabs with a real quiz
builder and autosave, show videos as tiles, let the student take a test full screen and see the
result on the task itself, and apply the navigation rules. Sketches (40 artboards) —
https://claude.ai/artifact/X2SdNjSvCbgsnwwccToard: read an artboard with the Artifact tool
(`action: "read"`, `path: "project/<Name>.dc.html"`; `project/canvas.json` maps names to
numbers). Board 33 `Elements` holds the unified elements, board 34 `Flow` the transition rules.

Rules for every stage: a sketch that disagrees with `docs/design-system.md` wins when Material 3
allows it (check with the `m3-expressive` skill), and the design system is updated in the same
commit; when a sketch makes a rule, variant or *ours* exception of the design system unnecessary,
remove it from `docs/design-system.md` instead of keeping both. Texts the sketches show are the
Russian wording; English is written separately (AGENTS.md §6.1).

### 344. Design system from the sketches

- [ ] **344.1 F** Board 33 `Elements` against `docs/design-system.md` and `styles.scss`: chips
  (filter, input, assist) 32 dp with an `outline-variant` border; one tag size (24 dp, 12/600) on
  every width; avatars only 24 (chip), 32 (dense journal) and 40 (list lead); radio 20, stepper
  40; the section card as in the sketches (white with an `outline-variant` border — an M3 outlined
  card) instead of `surface-container-low`; one phone bottom action bar (`tb-bottom-actions`:
  `surface-container-low`, top corners 28, 12/16 dp, 40 dp buttons) used by the compact assignment
  page and the student answer panel. Drop design-system rules the sketches no longer need.

### 345. Transitions

- [ ] **345.1 F** Board 34 `Flow` rules in `assignments-page.ts`, `assignment-create-dialog.ts`,
  `assignment-page.ts`, `task-review-page.ts`, `review-sheet.ts`: «Назад» returns to the screen it
  came from (list, journal, assignment), keeping the list filters; «Выдать» and «Сохранить
  черновик» in the quick dialog stay on the list with the snackbar «Задание выдано · Открыть»;
  closing the dialog with typed text asks «Сохранить черновик?» (Сохранить · Не сохранять ·
  Отмена); every «Проверить» opens the review queue from the chosen work (from the strip — all
  waiting works, from an assignment — its works); the end of the queue returns to the origin with
  «Все работы проверены». Implement only what differs from today; update `docs/screens.md`.

### 346. Editor tabs and autosave

- [ ] **346.1 B** A draft keeps incomplete questions: question rules (`homework/domain/quiz`,
  `AssignmentQuiz`, `AssignmentService`) are checked on «Выдать», not on saving a draft; issuing a
  draft with broken questions answers 422 with the question number and the existing error code
  per question. Controller tests for both; ADR if the stored shape changes.
- [ ] **346.2 F** `assignment-editor-page.ts` (sketches 11, 13, 28, 19, 21): tabs «Задание» and
  «Тест · N вопросов» (`?tab=quiz`); «Задание» shows the test as a summary card (first questions,
  «N вопросов · M баллов · K попытки», «Открыть тест»); «Как проходит тест» lives on «Тест»; the AI
  pane on «Тест» drafts questions, on «Задание» text. A draft saves itself (debounced, «сохранено ·
  HH:mm» in the header, no «Сохранить черновик», no leave prompt); an issued assignment keeps
  «Сохранить». «Назад» returns to the origin. Phone (21): tabs «Задание · Вопросы · Настройки».

### 347. Quiz builder

- [ ] **347.1 F** The «Тест» tab (sketches 28, 29) replaces `question-section.ts`: the outline
  (300 dp: drag handle — CDK drag-drop, number, type icon, error icon, points; «Вопрос» menu with
  the six types and hints, «С ИИ»), the open question (type select that keeps the options where it
  can, copy / up / down / delete, Markdown text, options with drag and «верный», «Добавить
  вариант», Enter adds the next option, points stepper 1–100, the explanation folded, «‹ Вопрос 2 ·
  Вопрос 4 ›») and the side column «Как проходит тест» (reveal radios, attempts «1 · 2 · 3 · Без
  огр.», «Засчитывается лучшая попытка») and «Итого» (questions, points, «Примерно займёт N–M
  мин», links to questions with errors). The six type editors as in sketch 29.
- [ ] **347.2 F** States (sketch 30): the empty test («Добавить вопрос» · «Составить с ИИ»);
  «Выдать» with broken questions — «Задание не выдано: N вопроса нужно поправить» with links, rows
  marked; a test a student has started — the tertiary note, «Создать копию для правок» (the copy
  opens on «Тест») and read-only rows.
- [ ] **347.3 F** Compact (sketches 21, 31, 32): «Вопросы» is the outline; a row opens one
  question full screen («Вопрос 3 из 8», type and points, tap-to-mark options, folded
  explanation, the bottom bar «‹ 2 · сохранено · Вопрос 4 ›»); «Вопрос» opens a bottom sheet of the
  six types and «Составить с ИИ». Medium (19) — one column.

### 348. Videos as tiles

- [ ] **348.1 F** `video-section.ts`, `caption-language-dialog.ts`, the quick dialog (sketches 3,
  39, 40): a video is a tile (preview, title — from YouTube when known, else «Видео N», source,
  tags «Расшифровка» / «Без расшифровки» and «видит ученик», «Настроить»), tiles reorder by drag,
  one «Вставьте ссылку на видео» field under them; «Настроить» opens a side sheet (phone: a page):
  player, «Название», the transcript as timed lines, «Субтитры YouTube» with a menu of tracks
  instead of the dialog, «Из файла», «Править текст», «Показывать расшифровку ученику», «Убрать
  видео», ‹ › between videos. The quick dialog has the link field and tiles only.

### 349. Student

- [ ] **349.1 F** `quiz-section.ts` → a full-screen test (sketches 23, 26): the question with
  large options, «Назад · Дальше», the question numbers 1…N (answered / current), «Выйти из теста
  — ответы сохранятся», «Завершить тест» asking only when questions are skipped; the task page
  keeps «Начать тест» and the result.
- [ ] **349.2 F** `my-task-page.ts`, `my-homework-page.ts` (sketches 24, 25, 27, 37, 38): the
  result is the task in its «Принято» / «На доработку» state beside the list — the grade card,
  the teacher's comment, the test mistakes, «Мой ответ» folded, «Следующее задание»; on rework the
  first attempt and a second one prefilled from it, «Сдать снова». Medium: list and task as two
  pages with the rail (37 → 25).
- [ ] **349.3 F** «Как увидит ученик» in the quiz builder opens the full-screen test (349.1) with
  the questions of the editor, answers not saved.

### 350. List, journal and dialog on medium

- [ ] **350.1 F** Sketches 17, 35, 36: the list on medium is a segmented list of tiles (icon,
  title, «кому · срок», the bar with «3 из 4», the tag) with the review strip as two cards; the
  journal cells show the grade («✓ 5»); the quick dialog on medium has «Фото», and «Написать с ИИ»
  and «Тест с вопросами» open the editor with the AI pane.

### 351. Release

- [ ] **351.1** Skill `release`: help articles in both languages, wiki pages, E2E scenarios in
  the homework suite, CHANGELOG, version 0.43.0, plan archive. Local only — push, PR and tag after
  the user's go-ahead.

## Repository maintenance

### Stage 336 — GitHub releases and README screenshots

- [x] **336.1** Publish missing GitHub releases for existing version tags using their
  `CHANGELOG.md` entries; refresh the nine `docs/assets/readme/*.png` screenshots from a
  disposable instance of v0.41.0 with fictional students and verify the README image links.

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
