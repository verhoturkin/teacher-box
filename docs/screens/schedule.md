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
- **Order by time** (ADR-0071 decision 13, 466.2): before the lesson starts the plan and the
  homework follow the facts (plan first); once it has started the card reads outcome → summary →
  homework → plan. The summary is projected into the card (`<ng-content>`), so the sheet keeps one
  body. Both are one-line rows of a segmented list (`ui/lesson-prep.scss`, shared by the three
  sections), or a dashed assist chip «+ План» / «+ ДЗ» (`tb-assist-chip [menu]`) when empty —
  chips stand side by side, rows take the whole width. No section headings.
- **Summary** (`lesson-summary-section.ts`): only for a started, not cancelled lesson (an individual
  lesson marked missed has none), edited in place. «What we covered» is prefilled with the topic and
  visible to the lesson's students; «next topic» fills the next lesson's empty topic. The AI draft
  uses the topic, the teacher's words and the titles of the lesson's linked assignments
  (`assignmentIds`, in the order linked). Save is enabled only on a difference;
  send saves first; the card stays open. Model switch: [homework](homework.md#ai-pane).
- **«Прошли по плану»** (466.3): with a plan on the lesson the field is not prefilled and is hidden
  behind a line «✓ Прошли по плану» (`check_circle` in `primary`, `body-l`; the 18 px icon is our
  decision) with a hint and a text button «Не всё по плану», which opens an empty field «Что
  прошло не по плану»; saved deviations open it at once. Send works with an empty field. The AI
  draft needs the teacher's words, sends the plan title and writes only the deviations; an empty
  draft leaves the line and says «всё прошло по плану».
- **Reading it** (`ui/lesson-covered.ts`, `tb-lesson-covered`): the teacher's history tab, the
  period lessons card, the student's (and parent's) history and lesson sheet show «Прошли по
  плану» for a held lesson with a plan, then «Не по плану» + the deviations; without a plan —
  «Что прошли» + the summary.

## Lesson plan

`schedule/ui/lesson-plan-section.ts` (teacher) and `ui/my-lesson-plan.ts` (student, parent) in the
lesson card (ADR-0071, 461.4; one-line rows 466.2). The direction `schedule` →
`textbooks` (ADR-0058) gives the card `LessonPlansApi`, `CoursesApi` and `VideoList`; the editor
of `textbooks` does not import `schedule`: the route (`app.routes.ts`, `linkToLesson`) passes it
`ScheduleApi.linkPlan`.

- **Teacher, no plan** (not on a cancelled lesson — it takes no new plan): the dashed chip «+ План»
  (named «Добавить план», `aria-haspopup="menu"`) with a menu: «Составить» opens
  `/teacher/materials/plans/new?lessonId=…&studentId=…|groupId=…`: a working plan, the course of
  the student or the group prefilled, the first save links it (`PUT …/lessons/{id}/plan`), back
  and «Готово» lead to `/teacher/schedule`; «С ИИ» (only when `AiApi.enabled$`; 464.2) opens the
  same editor with `ai=1` (the assistant is open on arrival, [materials](materials.md)); «Из
  шаблонов» turns the chip into an inline picker — a filtered `p-select` of the templates by title
  with the course under each, «Отмена» and «Взять» (`POST …/plans/{id}/use`, then the link; a copy
  the link refuses is deleted, the error is a snackbar). *Ours*: inline instead of a dialog — a
  window does not open over the sheet (ADR-0026).
- **Teacher, a plan**: one row — `list_alt`, the title button «План: <title>» («План: …» while it
  loads or failed), the trailing `expand_more` that turns over when open (**M3** list expand; fast
  spatial spring), «⋮» «Открыть в редакторе» (→ the editor with `?lessonId=`) and «Убрать из урока»
  (`confirm.danger`; unlink, then delete the working copy, the template stays). Opened, a second
  tile of the same list holds the Markdown text, each textbook «Spotlight 5 · Учебник · с. 12-14»
  and each video by name. A dangling plan id shows the compact load error with «Повторить» when
  opened; «⋮» still takes it off. Folded by default.
- **Student and parent**: only with a plan — the same row without «⋮»; opened, under it on the
  card: the Markdown text, «Учебники» (the homework `TextbookList`: open the bound pages,
  download) and «Видео» (`VideoList` with the player, transcripts only when shown). Addresses
  follow `API_SCOPE`; the plan is read once per lesson (the row needs its title).

## Lesson homework

`schedule/ui/lesson-homework-section.ts` (teacher only) in the lesson card (ADR-0071,
462.2; one-line row 466.2); the direction `schedule` → `homework` gives it `HomeworkApi`
and `assignmentProgress`. The homework editor does not import `schedule`: the route passes it
`lessonOf` and `linkToLesson` ([homework](homework.md), «Assignment editor»).

- **No homework** (not on a cancelled lesson): the dashed chip «+ ДЗ» («Добавить домашнее
  задание») with a menu «Задать» / «Привязать» (below).
- **Row:** `assignment`, «ДЗ: 2 задания · 1 на проверке» (the count of `assignmentIds`; the works
  to review — the sum of `submitted`, once `GET …/homework/assignments` has answered), the
  chevron. Opened, the same list goes on with each linked assignment — the title as a link
  covering the row (a draft → its editor, an issued one → its page), the progress tag of the
  homework list («Не выдано», «Выдано», «На проверке: N», «Принято»), «⋮» «Отвязать» (`DELETE
  …/lessons/{id}/homework/{assignmentId}`; the assignment stays); a dangling id reads «Задание
  удалено» and can still be unlinked — and a last tile with «Задать» and «Привязать» (text
  buttons; not on a cancelled lesson — it keeps what it has).
- **Actions:** «Задать» → `/teacher/homework/new?lessonId=…`; «Привязать» shows an inline picker
  (in the opened row, or in place of the chip) — a filtered, grouped `p-select`: «Недавние задания
  участников» (working assignments of the last 30 days with a lesson student, not linked to any
  lesson of ±90 days) and «Из шаблонов» (by title), «Отмена» and «Привязать». A template is used
  for the lesson's students (`POST …/assignments/{id}/use`), then linked; a draft the link refuses
  is deleted. The snackbar of a used item has «Открыть» (its editor). *Ours:* drafts are not
  offered among the recent ones — a summary carries no draft students; inline instead of a
  dialog, as the plan.

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
