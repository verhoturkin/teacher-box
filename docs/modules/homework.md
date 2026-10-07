# homework

Assignments, submissions, review, attachments, bound textbooks. Depends on: `shared`, `identity::api`,
`textbooks::api`. Schema `homework`.

## Rules

- An **assignment** is given to one or more students; each student gets a **task** with status
  `ASSIGNED → SUBMITTED → RETURNED («На доработке») / ACCEPTED («Принято»)`; a returned task can be
  re-submitted. A **submission** is one attempt (UI: «ответ»), the whole handed-in work is «работа».
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
`/api/me/homework/**` (tasks, submissions, attachments, `tasks/{taskId}/textbooks/{textbookId}`, summary).

## Frontend

`features/homework/`: `teacher/` (assignments, assignment page, review queue), `student/` (my tasks, task
page), `ui/`, `home/` widgets, `homework-labels.ts`. Routes `/teacher/homework/**`, `/cabinet/homework/**`.
