# Schedule (teacher)

`features/schedule/teacher/schedule-page.ts`: the calendar (`ui/schedule-calendar.ts`, FullCalendar,
week / month) is the main pane; the supporting pane holds the mini-month (`ui/mini-month.ts`),
requests and off time. Owner filter chips stay on one row; the rest go to a «more N» menu.

- **Mini-month:** the **M3** docked date picker without an input (*ours*) — a click only moves the
  calendar.
- **Grid in the manner of Google Calendar** (*ours*, M3 has none): classes through the `*Class`
  options of `ScheduleCalendar` (`viewClass` frames the grid, not the toolbar), styles `tb-cal-*` in
  `styles.scss`. `fillHeight` stretches rows and month weeks to the pane, never below their content:
  a low screen scrolls the pane; a phone is unchanged. Day headers are not buttons, so today has no
  circle.
- **Lesson states** (`styles.scss`): status containers; a marked lesson of a coloured student adds a
  stripe of the colour; `tb-lesson--unmarked` and `tb-lesson--request` are outlines; busy and off
  time are hatched, and touching periods merge into one block with both captions.
- **Drag to move** waits for confirm on the dropped card; only confirm saves.
- **Lesson form** (`lesson-dialog.ts`): weekly repeat 1–4 with an optional end; edits ask «only this
  / this and following». Bulk actions first list affected and protected occurrences (completed,
  charged and individually changed lessons are kept).
- **Compact** (`ui/schedule-agenda.ts`): agenda / week / month; off time is a screen of its own from
  «⋮». The agenda is a week strip over the day; unmarked lessons get held / missed under the row and
  a jump chip with their count. Week and month recreate the calendar to apply the view.

## Lesson card

`schedule/ui/lesson-card.ts` — one component for teacher and student in a `tb-dialog kind="sheet"`
(teacher: `lesson-details-dialog.ts`). The student sees the same facts with join and requests, no
edit, «⋮» or marks.

- **Outcome** of a past one-student lesson: an **M3** connected single-select group with optional
  selection — empty until marked. A press saves at once (disabled while saving), pressing the
  selected one clears it, an error restores it. The mark is confirmed by an undoable snackbar
  (`data-access/lesson-mark-undo.ts`), never a dialog.
- A student's request on a group lesson is a tertiary-container row (**M3**: tertiary for small
  items needing attention).
- **Footer — one state, one action:** none for a future or one-student past lesson; attendance for a
  past group lesson; restore for a cancelled one (an overlap asks `confirm.safe`).
- **«⋮»:** cancel (`lesson-cancel-dialog.ts`) and delete (`lesson-delete-dialog.ts`:
  `confirm.danger` for one lesson, an `alert` with the scope for a series); the card closes first.
  Clearing a mark is here only for group lessons.
- **Summary** (`lesson-summary-section.ts`): only for a started, not cancelled lesson (an individual
  lesson marked missed has none), edited in place. «What we covered» is prefilled with the topic and
  visible to the lesson's students; «next topic» fills the next lesson's empty topic. The AI draft
  uses the topic, the teacher's words and the titles of the lesson's linked assignments
  (`assignmentIds`, in the order linked). Save is enabled only on a difference;
  send saves first; the card stays open. Model switch: [homework](homework.md#ai-pane).

## Lesson plan

`schedule/ui/lesson-plan-section.ts` (teacher) and `ui/my-lesson-plan.ts` (student, parent) end
the lesson card, above the summary (roadmap 11 «Lesson card», 461.4). The direction `schedule` →
`textbooks` (ADR-0058) gives the card `LessonPlansApi`, `CoursesApi` and `VideoList`; the editor
of `textbooks` does not import `schedule`: the route (`app.routes.ts`, `linkToLesson`) passes it
`ScheduleApi.linkPlan`.

- **Teacher, no plan** (not on a cancelled lesson — it takes no new plan): the title «План урока»
  (title medium), a muted hint and two buttons — «Составить» (secondary, the stronger of the two)
  opens `/teacher/materials/plans/new?lessonId=…&studentId=…|groupId=…`: a working plan, the
  course of the student or the group prefilled, the first save links it
  (`PUT …/lessons/{id}/plan`), back and «Готово» lead to `/teacher/schedule`; «Из банка»
  (outlined) turns the row into an inline picker — a filtered `p-select` of the bank items by
  title with the course under each, «Отмена» and «Взять» (`POST …/plans/{id}/use`, then the link;
  a copy the link refuses is deleted, the error is a snackbar). *Ours*: inline instead of a dialog
  — a window does not open over the sheet (ADR-0026).
- **Teacher, a plan**: the header keeps «Открыть» (text, → the editor with `?lessonId=`) and «⋮»
  «Убрать из урока» (`confirm.danger`; unlink, then delete the working copy, the bank original
  stays); the list — the title, each textbook with «Учебник · с. 12-14», each video by name. A
  dangling plan id shows the compact load error with «Повторить»; «⋮» still takes it off.
- **Student and parent**: only with a plan — the title, the Markdown text, «Учебники» (the homework
  `TextbookList`: open the bound pages, download) and «Видео» (`VideoList` with the player,
  transcripts only when shown). Addresses follow `API_SCOPE`; the plan is read once per lesson.

## Lesson homework

`schedule/ui/lesson-homework-section.ts` (teacher only) follows the plan in the lesson card
(roadmap 11 «Lesson card», 462.2); the direction `schedule` → `homework` gives it `HomeworkApi`
and `assignmentProgress`. The homework editor does not import `schedule`: the route passes it
`lessonOf` and `linkToLesson` ([homework](homework.md), «Assignment editor»).

- **List:** «Домашнее задание» (title medium); each linked assignment (`assignmentIds`, read from
  `GET …/homework/assignments` once the lesson has one) — `assignment` icon, the title as a link (a
  draft → its editor, an issued one → its page), the progress tag of the homework list («Не
  выдано», «Выдано», «На проверке: N», «Принято»), «⋮» «Отвязать» (`DELETE
  …/lessons/{id}/homework/{assignmentId}`; the assignment stays). A dangling id reads «Задание
  удалено» and can still be unlinked.
- **Actions** (not on a cancelled lesson — it keeps what it has): «Задать» (secondary, the
  stronger) → `/teacher/homework/new?lessonId=…`; «Привязать» (outlined) turns the row into an
  inline picker — a filtered, grouped `p-select`: «Недавние задания участников» (working
  assignments of the last 30 days with a lesson student, not linked to any lesson of ±90 days)
  and «Из банка» (by title), «Отмена» and «Привязать». A bank item is used for the lesson's
  students (`POST …/assignments/{id}/use`), then linked; a draft the link refuses is deleted. The
  snackbar of a used item has «Открыть» (its editor). *Ours:* drafts are not offered among the
  recent ones — a summary carries no draft students; inline instead of a dialog, as the plan.

## Requests

`request-answer-dialog.ts`: an agree / decline toggle drives one confirm button's label and colour;
the new time and «count as missed» only when agreeing; moving onto an overlap is `confirm.safe`. The
student's `student/change-request-dialog.ts` never disables confirm: a hint says what is missing.
A request a parent sent for the child (ADR-0069, 454.2) is marked «от родителя (Анна)» after the
child's name in the teacher's request list and card and under the name in `request-answer-dialog.ts`
(`parentRequest` / `fromParent` in `schedule-labels.ts`; the student's own request has no mark).
In the family cabinet the dialog speaks of the child, not of «я» (the child is the one in the
address), the group lesson's «Не приду» reads «Не придёт», and the calendar link in the feed panel
is the parent's own (all the children's lessons). *Checked against the code 0.58.0: the
parent-origin marks were missing here; added.*

The student's schedule is in [cabinet](cabinet.md#schedule).
