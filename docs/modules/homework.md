# homework

Assignments, submissions, review, attachments, bound textbooks. Depends on: `shared`, `identity::api`,
`textbooks::api`. Schema `homework`.

## Rules

- An **assignment** is given to one or more students; each student gets a **task** with status
  `ASSIGNED → SUBMITTED → RETURNED («На доработке») / ACCEPTED («Принято»)`; a returned task can be
  re-submitted. A **submission** is one attempt (UI: «ответ»), the whole handed-in work is «работа».
- Kinds (`AssignmentKind`, fixed at creation; blank in the request — written): `WRITTEN` «Письменное» — a
  Markdown text, textbooks and files; `BOARD` «На доске» — a description only; `INTERACTIVE` «Интерактивное» — a
  description and an HTML page (`interactiveHtml`, required — `assignment.html-required`, ≤ 200 000 characters —
  `assignment.html-invalid`; other kinds don't keep it). Textbooks and files only for written homework
  (`assignment.materials-not-allowed`).
- Answers by kind: written — `POST /api/me/homework/tasks/{id}/submissions` (text and / or files); board and
  interactive — `POST …/tasks/{id}/done` «Готово» (`submission.kind-mismatch` the other way round). An interactive one
  may carry the page's `result` (`InteractiveResult`: score ≤ max score ≤ 10 000, ≤ 100 answers — question, answer,
  correct; `submission.result-invalid`), kept as JSON on the submission and shown to the teacher, never a grade.
- The page of interactive homework ([ADR-0040](../adr/0040-interactive-homework.md), `InteractivePages`): a link
  signed with an in-memory HMAC key, valid 5 minutes, for the teacher (any interactive assignment; another kind —
  `assignment.not-interactive`) and the student of the task; `GET /api/public/homework/interactive/{token}` serves
  the HTML plus the bridge script with its own CSP (`sandbox allow-scripts`, `default-src 'none'`, `frame-ancestors
  'self'`), `X-Frame-Options: SAMEORIGIN`, `no-store`; nginx sets the same headers for the path. A broken or expired
  link — 404 `homework.page-not-found`.
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
- A student sees only own tasks and attachments (403/404 tests).

## Contract (`homework::api`)

Events: `HomeworkAssigned`, `HomeworkSubmitted`, `HomeworkReviewed`, `HomeworkDueSoon` → `notifications`.

## Data

`assignments`, `tasks`, `submissions`, `attachments`, `assignment_textbooks` (assignment, textbook, pages).

## REST

`/api/teacher/homework/**` (assignments, students, attachments, `POST assignments/{id}/textbooks`
`{textbookId, pages}`, `DELETE assignments/{id}/textbooks/{textbookId}`, tasks/{id}/review, review-queue, summary),
`GET assignments/{id}/interactive-link`; `/api/public/homework/interactive/{token}`;
`/api/me/homework/**` (tasks, submissions, `tasks/{id}/done`, `tasks/{id}/interactive-link`, attachments,
`tasks/{taskId}/textbooks/{textbookId}`, summary).

## Frontend

`features/homework/`: `teacher/` (assignments, assignment page, review queue), `student/` (my tasks, task
page), `ui/`, `home/` widgets, `homework-labels.ts`. Textbooks: `ui/textbook-list.ts` (kind icon, title,
«Учебник · course · с. 12-14» / «целиком»; the teacher's pencil and cross, the student's tap opens the pages in a new tab,
the download button saves them under `boundTextbookFilename`), `teacher/bind-textbook-dialog.ts` («Привязать учебник»: a textbook not bound yet from
`@features/textbooks/parts`, pages — none for an image; the pencil changes the pages of a bound one). Routes `/teacher/homework/**`, `/cabinet/homework/**`.
