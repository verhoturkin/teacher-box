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

## Homework redesign (release after the next one)

Teachers find homework hard to create and to follow: the editor shows every field at once and the
list is a narrow 360 dp pane on a wide screen. Make the list use the full width, add a weekly
students × assignments view, create an assignment in one short dialog with materials added on
demand, and let the student answer on the task page itself. Sketches (12 artboards: desktop,
full editor, AI draft, phone, student) — https://claude.ai/artifact/X2SdNjSvCbgsnwwccToard.

### 339. Assignment list on the full width

- [x] **339.1 F** `homework/teacher/assignments-page.ts`: from expanded the list is one flexible
  pane, the assignment opens as its own page (no third pane). A «Ждут проверки · N» strip of
  cards (avatar, student, assignment, «сдано …», «Проверить», «Проверить все подряд» → the review
  queue); search, «Кому» and «Активные · Черновики · Готовые» in one toolbar; a table grouped by
  `deadline-groups.ts` — «Задание» (material icons: textbook, files, questions, video, board),
  «Кому», «Срок», «Сдали» (progress bar + «3 из 4»), status tag (`assignmentProgress`), «⋮».
  Compact: chips for the filters, the review strip scrolls sideways, cards instead of rows,
  extended FAB «Новое». Update `docs/screens.md` (Homework), help articles, wiki.
- [x] **339.2 B/F** «Списком · По ученикам» switch: a week grid, rows — students (of the «Кому»
  group), columns — assignments due that week, cells — status («Принято · 5», «проверить», «на
  доработке», «ждём», «не выдано»); ‹ › weeks. Cell → review sheet / «Выдать ещё» / assignment.
  Backend: `GET /api/teacher/homework/journal?from&to&who` in `HomeworkSummaryService` +
  controller test with roles. Compact: the grid scrolls sideways with the student column fixed.

### 340. Quick assignment creation

- [x] **340.1 F** `homework/teacher/assignment-create-dialog.ts` (new) from «Новое задание»:
  «Кому» chips, one Markdown field whose first line becomes the title, the AI button inside the
  field (opens `tb-homework-ai-panel`), deadline chips «К следующему занятию · <date>»
  (`next-lesson.ts`), «Через неделю», «Без срока», «Дата…»; «Материалы» appear only when added
  through assist chips «Файл · Учебник · Видео · Тест с вопросами · Доска»; «Сохранить черновик»
  and the split button «Выдать» (menu: «Выдать и разместить на доске»); «Во весь экран» opens
  `assignment-editor-page.ts`. Compact: a full-screen dialog, «Выдать» in its top bar, «Фото»
  among the materials.
- [x] **340.2 F** `assignment-editor-page.ts` follows the same order and hides empty sections
  (textbooks, files, videos, questions) behind the same assist chips; the separate title field
  goes. Check that `AssignmentService` accepts the derived title; update `docs/screens.md`
  (Assignment editor), help, wiki.

### 341. Open assignment

- [x] **341.1 B/F** `homework/teacher/assignment-page.ts`: students as tiles in two columns
  (avatar, name, status, the first lines of the answer, quiz score, attachments, action
  «Проверить / Открыть / Напомнить»), summary tags above them; an aside with the text folded to
  three lines, materials and «Ошибки по вопросам». Header: «Изменить», filled «Проверить N работ»
  (review sheet with «Дальше»), «⋮». Compact: tabs «Ученики · Задание · Ошибки» and a fixed bottom
  button. Backend: the answer preview in the assignment view (`HomeworkViews`).

### 342. Student homework

- [x] **342.1 F** `my-homework-page.ts`: groups «Вернули на доработку» (with the teacher's
  comment), «Сделать» (with «остался N дн.»), «Сдано» («На проверке», «Принято» + grade); compact
  starts with an «Ближайшее» card.
- [ ] **342.2 B/F** `my-task-page.ts`: «Мой ответ» right under the task — text, «Фото тетради»,
  «Файл», «Записать голос», «Сдать»; materials and the quiz card beside it (below on compact,
  where the answer panel is docked at the bottom). The answer draft survives leaving the page
  (decide: server draft or local storage). Voice recording — if attachments cannot take audio
  from the browser yet, move it to Backlog.

### 343. Release

- [ ] **343.1** Skill `release`: help articles in both languages, wiki pages, scenarios in the
  homework E2E suite (quick create, list, student answer), CHANGELOG.

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
