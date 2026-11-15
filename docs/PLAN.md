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
- Every new substep carries a complexity mark — *simple* (mechanical edit, docs, config) or
  *complex* (architecture, big refactor, subtle bug) — so the user or an orchestrating agent picks
  the model: smaller for simple, larger for complex. Several complex substeps do not share a
  session.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## v0.50.0

Goals: pay the technical and design debt left in the backlog. Two homework helpers move to
`shared/`, architecture tests cover every module, the setup wizard and link fields get shared
components, PrimeNG styles are overridden through CSS layers instead of `::ng-deep` /
`!important`, CI catches unused design tokens, and the remaining layout nits of the 2026-09-29
design audit are fixed.

Source: backlog review of 2026-11-15. ADRs: a new one for 400.1 (CSS layers replace
`::ng-deep`); 399.1 amends ADR-0059 only if the gallery rules change.

### 398. Shared helpers and architecture tests

- [ ] 398.1 **F** *simple* — move `EditorAutosave` (`homework/teacher/editor/editor-autosave.ts`)
  and `WhomFilter` (`homework/teacher/list/whom-filter.ts`) to `shared/` (candidates from 387.5),
  with their specs; update imports in `assignment-editor-page.ts`, `assignments-page.ts`; keep
  `frontend/scripts/import-cycles.mjs` and the feature directions (ADR-0058) green.
- [ ] 398.2 **B** *simple* — `ArchitectureTests.BUSINESS_MODULES` derives the module list like
  `SchemaIsolationTests.modulesWithMigrations()` (or from `ApplicationModules`), so `textbooks`
  and any future module are covered; assert the list contains `textbooks`.

### 399. Shared `tb-steps` and `tb-copy-field`

- [ ] 399.1 **F** *complex* — `shared/ui/steps.ts` (`tb-steps`): the step indicator of the setup
  wizard (`settings/setup/setup-page.ts`, `settings/setup/steps/`) and any other stepper markup
  becomes one component; sample in `features/gallery/`. `m3-expressive` skill.
- [ ] 399.2 **F** *simple* — `shared/ui/copy-field.ts` (`tb-copy-field`): a read-only field with a
  «Копировать» button centred on the field (DA-081). Replace the copies in
  `schedule/ui/calendar-feed-panel.ts`, `students/invite-link-dialog.ts`,
  `notifications/channels/link-code-view.ts`, `meetings/rooms/room-link.ts`,
  `schedule/teacher/google-calendar-panel.ts` where they are a field + copy button; sample in the
  gallery. `m3-expressive` skill.

### 400. Styles: CSS layers and token check

- [ ] 400.1 **F** *complex* — enable PrimeNG `cssLayer` in `providePrimeNG` (`app.config.ts`) with
  a layer order in `styles.scss`, then remove the 38 `::ng-deep` and 20 `!important` where the
  layer order makes them unnecessary; screenshots of the gallery before and after must match. New
  ADR; update `docs/design-system.md` and `frontend/AGENTS.md`.
- [ ] 400.2 **F** *simple* — `frontend/scripts/tokens.mjs`: fails on a `--tb-*` custom property
  that is declared but never read (styles, components, `teacher-box-preset.ts`); run it from
  `npm run lint` / `scripts/verify.sh frontend`; remove the unused tokens it finds.

### 401. Layout nits of the design audit

- [ ] 401.1 **F** *simple* — DA-081 (`rg --no-ignore -n "DA-081" docs/archive/audit`): recheck
  the 15 items against the current code, fix the ones still there (each 1–3 lines), note in this
  substep which were already gone. `m3-expressive` skill.
- [ ] 401.2 **F** *complex* — DA-082: `.tb-button-group` styles move out of
  `.tb-lesson-actions--stacked` into the class itself (`styles.scss`); decision pairs («Проведено |
  Пропуск», «Отклонить | Согласовать», «Принять | Вернуть на доработку») become connected button
  groups; no `size` on `p-selectbutton`, E2E checks `.p-togglebutton-sm`; the ⚠ icon is set in
  `dangerConfirmation` for every danger confirmation. Gallery samples; `docs/design-system.md`.

### 402. Release 0.50.0

- [ ] 402.1 *simple* — skill `release`.

## v0.51.0

Goals: smaller student and schedule features from the audit and the backlog. A student records a
voice answer, student and group selects show their colours, a lesson is moved to a free time
picked from the teacher's busy times, and the invitation page stops being a dead end.

Source: backlog review of 2026-11-15; design audit DA-049, DA-050.

### 403. Voice answers

- [ ] 403.1 **B** *simple* — `homework/domain/FilePolicy` accepts `audio/webm` (and `audio/ogg`,
  `audio/mp4` for Safari) with a size limit; tests.
- [ ] 403.2 **F** *complex* — «Записать голос» in the answer panel of
  `homework/student/my-task-page.ts`: `MediaRecorder` records, shows the duration, stop / redo,
  uploads the record as an attachment; `ACCEPTED_FILES` (`homework/ui/file-picker.ts`); an audio
  player for audio attachments for the student and the teacher's review. Microphone denied → a
  hint. `m3-expressive` skill; help article and `docs/wiki/` page in both languages.

### 404. Colours in student and group selects

- [ ] 404.1 **F** *simple* — options and the selected value of student / group `p-select`s
  (homework recipients, lesson dialog, billing, boards) show `tb-avatar` in the label colour
  (`colors.studentLabel`, as in `monthly-report-page.ts`); one shared item template if they repeat.
  `m3-expressive` skill.

### 405. Reschedule from free times

- [ ] 405.1 **B** *complex* — `schedule/application/SlotFinder` (pure: busy intervals of
  `TeacherAvailability` — lessons, Google busy times, off-times — and a lesson duration → free
  start times of a day by a step); student `GET /api/me/schedule/free-times?date&lessonId` and the
  teacher's twin in `TeacherScheduleController`; role tests incl. another student's lesson → 404.
  Written so roadmap/08 can reuse it with working windows later.
- [ ] 405.2 **F** *simple* — the reschedule dialogs (`schedule/student/change-request-dialog.ts`,
  `schedule/teacher/request-answer-dialog.ts`, the teacher's move in `lesson-details-dialog.ts`)
  offer the free times of the chosen day as chips; a manual time stays possible. `m3-expressive`
  skill; help and wiki in both languages; `docs/modules/schedule.md`.

### 406. Invitation and first run

- [ ] 406.1 **F** *simple* — DA-049 (`identity/invite/invite-page.ts`): an invalid or used link
  offers «Войти» (a signed-in student — «В кабинет»), shows the portal name and an h1; a signed-in
  teacher sees a banner «Вы вошли как учитель. Эту ссылку откроет ученик» and a disabled form; the
  login is checked in the browser (`^[A-Za-z0-9._-]{3,50}$`) with a text under the field; a toast
  after the account is created. Help and wiki in both languages.
- [ ] 406.2 **F** *simple* — DA-050: recheck the first-run items (FAB «Занятие» / «Оплата» with no
  students, the default price, the wizard's form rules, «С чего начать» losing done steps) against
  the current code; fix what remains, note what was already gone.

### 407. Release 0.51.0

- [ ] 407.1 *simple* — skill `release`.

## v0.52.0

Goals: the teacher runs the call. Mute or remove a participant, chat inside the call, open the
student's board from the call, and keep the call in a Picture-in-Picture window over other tabs.
Call history, «ученик ждёт» and recording stay in
[`roadmap/09`](roadmap/09-calls-waiting-recording.md).

ADRs: a new one if 409.2 needs a frontend dependency of `meetings` on `boards` (ADR-0058).

### 408. Moderation

- [ ] 408.1 **B** *complex* — teacher endpoints in `meetings/web/CallsController` to mute a
  participant's microphone and remove a participant (`CallServer.removeParticipant`, a new
  `mute` via LiveKit `MutePublishedTrack`); only the teacher; tests incl. a student → 403.
- [ ] 408.2 **F** *simple* — a menu on a participant's tile (`meetings/call/call-tile.ts`):
  «Выключить микрофон», «Удалить из звонка» with a confirmation; the removed student sees why.
  `m3-expressive` skill; help and wiki in both languages.

### 409. Chat and board in the call

- [ ] 409.1 **F** *complex* — chat in the call over the LiveKit data channel
  (`meetings/call/livekit-engine.ts`, `call-engine.ts`, a panel in `call-window.ts`): text
  messages, unread badge on the button, not stored after the call. `m3-expressive` skill; help and
  wiki.
- [ ] 409.2 **F** *simple* — «Доска ученика» in the call controls (`call-controls.ts`) opens the
  student's board in a new tab or beside the call, through a route, not an import of `boards`
  code. Help and wiki.

### 410. Document Picture-in-Picture

- [ ] 410.1 **F** *complex* — `documentPictureInPicture` (Chromium only, feature-detected): the call
  moves to a floating window with the tiles and the main controls; back to the tab on close;
  the button is hidden where the API is missing. `m3-expressive` skill; help and wiki.

### 411. Release 0.52.0

- [ ] 411.1 *simple* — skill `release`.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
