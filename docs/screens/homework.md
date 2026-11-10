# Homework (teacher)

`features/homework/teacher/`, one route: the list (`/teacher/homework`, `AssignmentsPage`), the
assignment (`/:assignmentId`, `AssignmentPage`), the work (`/tasks/:taskId`, `TaskReviewPage`) and
the editor (`/new`, `/:assignmentId/edit`, `AssignmentEditorPage`). Each is a full page with back;
no list pane beside a detail. Boards: `docs/sketches/homework/` (titles in `canvas.json`). The
student's side is in [cabinet](cabinet.md#homework).

## Transitions (board 34)

- Back leads where the page was opened from (`AssignmentsPage.origin`): the work to the list or the
  assignment that opened it, the assignment to the list. View, search and filters survive.
- Every review button starts a queue (`startReview`): from the list strip, the journal or «review
  all» — every waiting work; from an assignment — its works. A decision opens the next work; with
  none left the page returns to the origin.
- The header button and the rail's create menu (`?create=assignment`, replaced in the history) open
  `/teacher/homework/new`, the one creation form.

## List (boards 1, 5, 17)

- **Views** list / by student (`?view=journal`); only the list page has the switch. Search `?q=`,
  recipient `?who=student:<id>|group:<id>`; on a phone the filters are one sideways-scrolling chip
  row.
- **Review strip** while a work waits (follows search and recipient): up to three cards, then
  «review all», oldest first.
- **Table** (`p-table` `tb-cards`, from expanded): «active» is grouped by due date (overdue, this
  week up to next Monday, later, none); drafts and finished are one run. The progress bar hides
  below 60em so a tablet fits. Status: `assignmentProgress`. «Copy» makes a draft with the text and
  materials and opens its editor. Medium and phone: a segmented list under the same groups.
- **Journal** (`journal-view.ts`, boards 2, 20, 35): a week's status grid ([design-system
  §2](../design-system.md)), a sticky student column, a column per assignment due that week. A cell
  opens the work with its review form, «issue more» for the student, or the assignment. Medium and
  phone: icon and grade only (label in `aria-label`), no total column.

## Assignment page (boards 4, 7, 18)

- **Expanded and medium:** students (flex 999 1 560px) and the aside (1 1 340px, ≤ 420px) wrap when
  the students would get narrower than 560px; tiles are two columns, one below a 36rem students'
  column (container query). «Remind» is for not handed in or on rework. No «overdue» tag anywhere,
  teacher or student: the status line says it. The aside shows the task read-only — materials change
  only in the editor.
- **Large and up:** the task takes the main column (72ch, stops at 48 rem; the students follow it so
  free space stays at the end) and the students a narrow column (320–380 px, *ours*) grouped by
  status, empty groups hidden.
- **Compact:** tabs students / task / mistakes, the main button stuck to the bottom.

## Review page (boards 14–16)

- The form (`review-form.ts` in `review-sheet.ts`): from large a side sheet beside the work and the
  rail collapses (`RailState`); below large it sits under the answer. A grade set before is a chip
  of its own; with a quiz «N of M» is chosen until the teacher picks another. *Ours:* rework stays
  tonal, not the board's error container — red means destruction only ([design-system
  §8](../design-system.md)).
- Compact: an **M3** floating toolbar (sizes *ours*); comment, draft, phrases and grade live in a
  bottom sheet; the bottom bar hides (`RailState.bottomBarHidden`).
- Quiz review (`quiz-review.ts`): wrong answers of the best attempt can be counted, right ones
  un-counted.

## Assignment editor (boards 11, 19, 21, 28–32, 39, 40)

Tabs task / test (`?tab=quiz`, default left out, `Location.replaceState`); a phone (< 600) adds
`?tab=settings`, wider settings fall back into the test tab.

- **Task tab:** from a 52 rem form (container query) three columns — `tb-section-nav`
  ([design-system §10](../design-system.md)) with an «add» group for a video (up to five) and a
  board; the middle (one Markdown field whose first line is the title, videos, board, a test summary
  that only links to the test tab); the aside (recipients, due date, materials). Without the
  sections column (below expanded or beside the AI) video and board become material chips; a phone
  has neither. The test is never a material. A new assignment shows only recipients, text, due date
  and material chips; other sections appear once they have content. Parts: `ui/recipients-field.ts`,
  `ui/due-chips.ts`, `ui/material-chips.ts`.
- **Videos** (`video-section.ts`): a tile's settings dialog saves every change at once; done and Esc
  only close.
- **Recipients:** a draft edits `draftStudentIds`; an issued assignment has read-only chips and
  «issue more» (`assign-more-dialog.ts`).
- **Test tab** (`question-section.ts`, `question-editor.ts`, `quiz-settings.ts`): outline, open
  question, side column. Error marks appear only after issuing was tried. A type change keeps text,
  points and explanation, carries options between the choice types and ordering, and asks before
  anything else. «About N–M min» is ¾–1 min a question (*ours*). The student preview runs
  `quiz-player.ts` and saves nothing. *Not built:* the board's «shuffle options» (no backend
  setting).
- **Test states** (board 30): issuing with broken questions links each one (opens it, focus in its
  text); a quiz a student has started (a finished attempt on load, or `homework.quiz-started` on
  save) is read-only with «copy for edits», which opens the copy on the test tab.
- **Phone** (boards 21, 31, 32): the outline only; a question opens as a full-screen `form` dialog;
  closing returns focus to its row.
- **Autosave:** a draft saves 1.5 s after the last change once it has a title; questions are not
  checked. The first save writes `/teacher/homework/<id>/edit` without a reload. An empty new
  assignment creates nothing; leaving a draft never asks; an issued one asks before dropping
  changes. Issuing checks the questions first (problems → test tab; `homework.quiz-incomplete` names
  them) and returns to the opening page. Back uses `previousNavigation.finalUrl` without `?create=`;
  opened by a link — the assignment or the list.

## AI pane

`features/ai/homework-ai-panel.ts`; what it drafts follows the tab. The AI never changes text
without insert / replace, and its state survives closing. *Ours:* a fixed pane from expanded (board
13), a modal drawer on medium (19), a bottom sheet on a phone (22); main content precedes it in
reading order.

- **Model switch** (`ai/ai-model-pick.ts`, ADR-0057): in the AI pane, the review form and the lesson
  summary; hidden with one model or none. The choice is per device (`AiModelChoice`); picking the
  default stores nothing, so a changed default is followed; a removed model is forgotten (after a
  409 `ai.model.unknown` the draft is asked of the default). *Ours:* the phone label is cut at 7 rem
  — no shortening rule works for every provider's names.
- **Student context** (`ai/student-context.ts`): chips of the recipients' AI tags with a value, sent
  as `context` with homework, quiz and review drafts; «×» drops a tag from this editor's requests
  only. Different values give a warning chip to pick one or all; a free-text tag offers «all» only
  while the joined text fits 120 characters. The request overrides the tags.
