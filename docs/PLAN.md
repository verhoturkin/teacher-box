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

## v0.43.0 — conformance to the sketches (before the push)

The 0.43.0 stages were checked by tests only; the teacher's review found screens that do not match
the sketches (broken test summary and materials in the editor, overflowing cards, a page that
scrolls as a whole, a review page unlike sketch 14, a deadline lost on «Во весь экран»). Each
substep compares its screens with the sketches **in the browser** and fixes every difference.
Sketches — https://claude.ai/artifact/X2SdNjSvCbgsnwwccToard (Artifact tool, `action: "read"`,
`path: "project/<Name>.dc.html"`; `project/canvas.json` maps names to numbers; board 33
`Elements`, board 34 `Flow`). The rules of the archived v0.43.0 plan still apply: the sketch wins
when Material 3 allows it, and the design system is updated and simplified in the same commit.

Method for every substep: run an own backend and frontend on free ports with a disposable data
directory (as the `backend-81xx` / `frontend-42xx` entries of `.claude/launch.json`); fill it with
fictional data that stresses the layout — long titles and texts, overdue and returned works, a
quiz of every type, videos, textbooks, files; open every screen of the substep at the sketch's
width (1440, 768, 390) next to its artboard and list each difference (columns, element type and
order, sizes, texts, states, overflow, what scrolls); fix them all; repeat until none is left.
The commit message or the report lists the sketches checked and anything left on purpose.

### 352. Conformance review

- [x] **352.1 F** Editor «Задание» tab and the quick dialog (sketches 3, 6, 11, 12, 13, 19, 21,
  22, 36, 39, 40): three columns as in 11 (sections, the text and the test, the aside with
  «Кому · Срок» and «Материалы»); materials as compact rows with assist chips, the video tiles
  and one labelled link field; the test summary as one-line rows (number, type icon, text,
  points) — today they stack in a centred column. «Во весь экран» keeps «К следующему занятию»
  as the chosen deadline instead of turning it into a date.
- [x] **352.2 F** Teacher list, journal, assignment and review (sketches 1, 2, 4, 5, 7, 14, 15,
  16, 17, 18, 20, 35): the «Просрочено» tag goes everywhere (teacher and student) — the
  supporting line says it; long titles and texts never leave their card or tile (review strip,
  tiles, rows); the review page and its sheet as in 14, 15, 16.
  *Left on purpose: «На доработку» stays tonal (the sketches' error container is an M3 error role);
  no avatar in the review header (the page header has no lead slot); the tablet's test block is not
  folded (the wrong answers keep «Засчитать» in sight); the journal's hint card is sketch notes.*
- [x] **352.3 F** Quiz builder, type editors and states (sketches 28, 29, 30, 31, 32).
  *Left on purpose: the type stays a tonal menu button (the sketch's outlined one with a trailing
  arrow needs a custom button); accepted answers stay outlined input chips; «Ученик увидит в
  случайном порядке» is still not built (no backend setting).*
- [x] **352.4 F** Student (sketches 8, 9, 10, 23, 24, 25, 26, 27, 37, 38): only the pane scrolls,
  never the whole page; the test on a large screen is inside the frame as in 23 (rail, the
  question and the numbers column), full screen only on a phone (26); the task page has the right
  column as in 8 and none as in 24; long titles wrap inside the tiles.
  *Long titles end with «…» on one line, as in the sketches. Left on purpose: the reviewed task
  keeps the assignment folded under «Задание» (the sketches drop it); the test stays a card, not
  the phone's compact row (10); the answer keeps labelled assist chips, not icon buttons (10, 27);
  status tags keep the shared names («На доработке», not «Доработать»); no chevron in the tablet
  list (37); the phone test's header names the test, the step stays on the right (26).*
- [x] **352.6 F** One creation form: the quick dialog goes. «Новое задание» (header button, FAB,
  rail FAB) opens the editor `/teacher/homework/new` on the «Задание» tab. A new assignment shows
  only «Кому», the text, «Срок» and the material assist chips (empty sections hidden); the AI
  button opens the editor's AI pane. A draft is created on the first typed character and then
  saves itself; leaving an empty new assignment creates nothing. «Выдать» returns to where the
  editor was opened (list or assignment) with the snackbar «Задание выдано · Открыть». Remove
  `assignment-create-dialog.ts`, its spec, `AssignmentDraftHandover` if nothing else uses it, the
  dialog-only texts and the design-system / screens rules only the dialog needed. «Выдать ещё» of
  an assignment and in the journal stays its own small dialog.
  *Also removed: the dialog-only modes — `tb-dialog` widths `xwide` / `split` and
  `[draftPrompt]`, the confirm step's third button, the video tiles' `quick` and the chips'
  `tablet`. The AI pane was not checked in the browser (no AI on the test instance; unit and E2E
  tests cover it).*
- [ ] **352.5** Release refresh: CHANGELOG 0.43.0, help articles and wiki for what 352.1–352.4
  changed, the archive `docs/archive/plans/v0.43.0.md` gets this section; `./scripts/verify.sh`.
  Local only.

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
