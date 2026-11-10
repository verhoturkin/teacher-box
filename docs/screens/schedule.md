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
  uses the topic, the teacher's words and the titles of that day's assignments for the lesson's
  students (assignments are not bound to lessons — *ours*). Save is enabled only on a difference;
  send saves first; the card stays open. Model switch: [homework](homework.md#ai-pane).

## Requests

`request-answer-dialog.ts`: an agree / decline toggle drives one confirm button's label and colour;
the new time and «count as missed» only when agreeing; moving onto an overlap is `confirm.safe`. The
student's `student/change-request-dialog.ts` never disables confirm: a hint says what is missing.

The student's schedule is in [cabinet](cabinet.md#schedule).
