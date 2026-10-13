# homework

Assignments, submissions, review, attachments, bound textbooks. Depends on: `shared`, `identity::api`,
`textbooks::api`. Schema `homework`.

## Rules

- An **assignment** is given to one or more students; each student gets a **task** with status
  `ASSIGNED → SUBMITTED → RETURNED («На доработке») / ACCEPTED («Принято»)`; a returned task can be
  re-submitted. A **submission** is one attempt (UI: «ответ»), the whole handed-in work is «работа».
- No kinds since 0.14.1 ([ADR-0041](../adr/0041-homework-without-kinds-board-link.md), supersedes ADR-0040): every
  assignment is a Markdown text with textbooks and files, answered with a text and / or files
  (`POST /api/me/homework/tasks/{id}/submissions`). Migration `V5` dropped `kind`, `interactive_html` and the results
  of interactive pages.
- **The board of an assignment** (ADR-0041): `assignments.board_id` — the board it was put on (a UUID only,
  `homework` does not know `boards`); `PUT /api/teacher/homework/assignments/{id}/board {boardId}` (`null` forgets it)
  changes no version. `boardId` is in `AssignmentDetails`, `AssignmentSummary` and the student's `AssignmentInfo`.
- Due date; `DueSoonReminder` publishes `HomeworkDueSoon` once per unfinished task within
  `TEACHERBOX_HOMEWORK_DUE_SOON_WINDOW`.
- Attachments of assignments and submissions — `FileStorage` namespace `homework`, limits
  `TEACHERBOX_HOMEWORK_MAX_FILE_SIZE`, `MAX_FILES_PER_UPLOAD` (`FilePolicy`).
- Review queue for the teacher; AI drafts are produced by the `ai` module from texts the frontend passes — `homework`
  does not know `ai`.
- Textbooks ([ADR-0033](../adr/0033-textbooks.md)): the teacher binds a textbook to an assignment with pages
  (`1-3, 7`, checked against its page count by `textbooks::api.PageRanges`) or whole (blank); binding it again
  changes the pages. `AssignmentDetails.textbooks` / `AssignmentInfo.textbooks` (`BoundTextbookView`: kind,
  title, course, format, page count, pages) skip deleted textbooks. The student of the task downloads the bound
  pages: a PDF cut to them (`Textbooks.content`), any other file or a whole binding — the whole file
  (`Textbooks.file`); a textbook not bound to the task — 404 `homework.textbook-not-found`.
- **Deleting** (0.14.2): `DELETE /api/teacher/homework/assignments/{id}` (`AssignmentService.delete`) removes the files of
  the assignment and of its answers (`FileStorage`), the answers, the tasks and the assignment; bound textbooks go by
  cascade. No event: notifications already sent stay in the inbox, their link leads to «not found».
- A student sees only own tasks and attachments (403/404 tests).

## Contract (`homework::api`)

Events: `HomeworkAssigned`, `HomeworkSubmitted`, `HomeworkReviewed`, `HomeworkDueSoon` → `notifications`.

`AssignmentFiles.file(assignmentId, attachmentId)` (for `ai`, [ADR-0039](../adr/0039-ai-reads-homework-sources.md)): a
file of the assignment's materials — name, type, size, content; another assignment's file — 404 `file.not-found`.

## Data

`assignments`, `tasks`, `submissions`, `attachments`, `assignment_textbooks` (assignment, textbook, pages).

## REST

`/api/teacher/homework/**` (assignments — the list has the names of the students of each, `DELETE assignments/{id}`, students, attachments,
`PUT assignments/{id}/board`, `POST assignments/{id}/textbooks` `{textbookId, pages}`,
`DELETE assignments/{id}/textbooks/{textbookId}`, tasks/{id}/review, review-queue, summary);
`/api/me/homework/**` (tasks, submissions, attachments, `tasks/{taskId}/textbooks/{textbookId}`, summary).

## Frontend

`features/homework/`: `teacher/` (assignments, assignment page, editor, review queue), `student/` (my tasks, task
page), `ui/`, `home/` widgets, `homework-labels.ts`. Textbooks: `ui/textbook-list.ts` (kind icon, title,
«Учебник · course · с. 12-14» / «целиком»; the teacher's pencil and cross, the student's tap opens the pages in a new tab,
the download button saves them under `boundTextbookFilename`; 0.14.5: the teacher's tap on the title opens the whole
textbook, a PDF at its first bound page — `teacher/material-opener.ts`), `teacher/bind-textbook-dialog.ts` («Привязать учебник»: a textbook not bound yet from
`@features/textbooks/parts`, pages — none for an image; the pencil changes the pages of a bound one). Editor (`teacher/assignment-editor-page.ts`, routes `/teacher/homework/new` and `/teacher/homework/:id/edit`,
`canLeaveGuard`; «Новое задание» and the home quick action lead there): one Markdown field with a «Текст / Просмотр»
switch; students and groups (`tb-group-picker`, a multiselect: a group adds its students, taking it off removes them),
the due date — the start of the earliest scheduled lesson of the chosen students within 60 days
(`teacher/next-lesson.ts` over `ScheduleApi.lessons`) until the teacher sets it; textbooks and files only for a new
assignment (0.14.2: a saved one changes them on its page); picked files — `ui/file-picker.ts`, the same `tb-list` cards
as the saved ones, the name of a PDF or a picture opens it in a tab (0.14.5)
(`BindTextbookDialog` without an assignment emits `picked`, checked by `parsePages`). A new assignment is created
without students, gets its files and textbooks, then is given out — the notification goes with the materials in place;
a material that fails leaves the assignment saved with an error toast. Header: «Выдать» / «Сохранить» (filled) and
«Выдать и поместить на доску» / «Сохранить и поместить на доску» (tonal): it saves, then opens «На доску» for the
saved assignment (`ToBoardDialog [frame] [pictures]` from `teacher/assignment-board.ts`, the boards of its students);
`placed` → `PUT …/board`, closing the dialog leads to the assignment page. The assignment page: «На доску» (enabled
with a text, a picture file or a textbook page) also remembers the board, «Открыть доску» (`pi-arrow-up-right`) when
there is one, «Удалить…» (danger confirmation); materials — `ui/attachment-list.ts`, a `tb-list` like the textbooks
(type icon, name, size, the same red «×»; `openable` — the name opens the file through `MaterialOpener`, a PDF or a
picture in a tab, with a download button beside it — on the assignment and review pages); «Ученики» — a `tb-list` (avatar, name link to the task, «Сдано … / Не сдано»,
status), «Добавить» at the top right of the card opens `teacher/assign-more-dialog.ts` («Выдать ещё ученикам»: students
and groups side by side). The list (`teacher/assignments-page.ts`) — cards: title, «кому · до …», the progress badge
(`assignmentProgress`), «⋮» (… «Удалить…»). The review queue and the student's «Задания» are `tb-list` cards too
(avatar, student, «задание · сдано · срок»; icon, title, «до …», status). The student's `my-task-page.ts` shows
«Перейти на доску» (`MyBoardButton` from `@features/boards/parts`) when the assignment has a board of theirs. «На доску»
of an assignment (`teacher/assignment-board.ts`): the frame «<title> · dd.MM.yyyy», the pictures — png / jpeg / webp /
gif files, then the bound pages of each textbook (a whole PDF — from page 1, an image — its picture, a document —
none), at most 30. Routes `/teacher/homework/**`, `/cabinet/homework/**`.
