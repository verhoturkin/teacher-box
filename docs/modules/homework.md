# homework

Assignments, submissions, review, attachments. Depends on: `shared`, `identity::api`. Schema `homework`.

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
- A student sees only own tasks and attachments (403/404 tests).

## Contract (`homework::api`)

Events: `HomeworkAssigned`, `HomeworkSubmitted`, `HomeworkReviewed`, `HomeworkDueSoon` → `notifications`.

## Data

`assignments`, `tasks`, `submissions`, `attachments`.

## REST

`/api/teacher/homework/**` (assignments, students, attachments, tasks/{id}/review, review-queue, summary),
`/api/me/homework/**` (tasks, submissions, attachments, summary).

## Frontend

`features/homework/`: `teacher/` (assignments, assignment page, review queue), `student/` (my tasks, task
page), `ui/`, `home/` widgets, `homework-labels.ts`. Routes `/teacher/homework/**`, `/cabinet/homework/**`.
