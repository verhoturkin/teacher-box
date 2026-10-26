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

## v0.34.0

Goals: one dialog model for every module and window size (M3 basic / full-screen dialog, modal
bottom sheet), chosen by content, not by screen; most dialog boilerplate moves to `shared/ui`;
M3 filled text fields everywhere; the teacher's lesson card rebuilt; connected button groups only
for toggles. Background — `docs/archive/audit/dialogs-2026-10.md` (inventory of 28 dialogs,
7 drawers, 12 confirmation hosts). New ADR-0050.

Decisions taken with the teacher (2026-10-25/26), binding for every stage:

- Three kinds: `alert` (confirmations, one choice, ≤ 1 field) — basic dialog at every width;
  `form` (≥ 2 fields, wizards, pickers) — M3 full-screen dialog on compact (header 56 dp
  «✕ · headline · action»), basic dialog from medium; `sheet` (an object and its actions) — modal
  bottom sheet on compact, basic dialog from medium. Side sheets (help, bell, AI, review) stay.
- At most two footer actions (confirm + dismiss); extra and dangerous ones go to «⋮» in the
  header. No «✕» in `alert` / `form` from medium (Cancel, Esc); `sheet` keeps «✕» from medium.
  Scrim closes `alert` and `sheet`, never `form`.
- Initial focus: `form` — first field; `alert` / `sheet` — the headline.
- A dirty `form` asks «Отменить изменения?» on close (Esc = Cancel). A dialog over a dialog only
  as that basic dialog over a full-screen `form` on compact; elsewhere an inline confirm step.
- Server error of a `form` — above the form; failed actions in a `sheet` — error snackbar.
- `request-answer`: a single-select «Одобрить | Отклонить» toggle + one submit button.
- Fields: M3 filled text field everywhere (search bar excepted).
- Lesson card: per audit §5.2 — headline is who, one `tb-list` of facts, «Итог» toggle
  («Проведено | Пропуск», connected group, single-select, selection optional), cancel lesson is a
  separate `form`, delete via `Confirm` with series scope.
- Button groups: `tb-button-group--connected` only for toggles; `tb-button-group` = M3 standard
  group (12 dp gap, Compose `ButtonGroupSmall.BetweenSpace`) for actions.

### Stage 284 — Dialog model decision (docs)

- [x] **284.1** ADR-0050 «Единая модель диалогов» (Russian; row in `docs/adr/README.md`; ADR-0015,
  0024, 0026 marked as amended where they conflict); rewrite `docs/design-system.md` §8 (dialogs,
  sheets), §7 (button groups), §10 (fields: filled everywhere); move `docs/dialogs-audit.md` to
  `docs/archive/audit/dialogs-2026-10.md`.

### Stage 285 — Shared dialog UI (F)

- [x] **285.1** `Confirm` service (`shared/ui/confirm.ts`): `danger()` / `safe()` → `Promise<boolean>`,
  built on the existing `dangerConfirmation` / `safeConfirmation`; one `ConfirmationService` in
  `app.config.ts` and one `<p-confirmdialog>` in `app.ts`; remove the 9 local providers and the 12
  hosts (`students-page`, `student-payments-tab`, `schedule-page`, `assignment-page`,
  `assignment-editor-page`, `video-section`, `boards-feed`, `board-page`, `textbooks-feed`,
  `bots-panel`, `backups-card`, `prompt-library-card`, `system-prompts-card`).
- [x] **285.2** `shared/ui/dialog/`: `<tb-dialog>` (kinds `alert | form | sheet`, `width`
  `normal | wide`, `[(visible)]`, `headline`, header-actions slot, footer from inputs, focus and
  focus return taken over from `ModalDrawer`, dirty-form discard, `[closable]`), `dialogSubmit()`
  (pending, error, reset on open, request, done), `<tb-dialog-confirm-step>`; unit tests; pilot:
  `identity/students/student-form-dialog.ts`, `identity/groups/group-form-dialog.ts`,
  `identity/students/invite-link-dialog.ts`.

### Stage 286 — Filled fields everywhere (F)

- [x] **286.1** `.tb-field` is the M3 filled field by default (`shared/ui/filled-field.scss` →
  global), extended to `p-select`, `p-multiselect`, `p-datepicker`, `p-inputnumber`,
  `p-password`, `p-autocomplete`, textarea; PrimeNG `inputVariant` if PrimeNG 21 has it; remove
  `tb-field--filled` and the outlined label cutouts; contrast check on dialog, card and page in
  both themes.

### Stage 287 — Dialogs on the shared UI (F)

- [x] **287.1** identity, billing, boards, textbooks, ai, settings, admin, notifications channels:
  `payment-dialog`, `board-dialog`, `board-backups-dialog`, `to-board-dialog` (3 modes → radio
  list + one action), `textbook-dialog`, `prompt-library-card`, `system-prompts-card` («Сбросить» →
  «⋮»), `reset-card`, `restore-dialog`, `admin/settings/settings-page`, `channels-panel`.
- [x] **287.2** homework, notifications, meetings: `assign-more-dialog`, `bind-textbook-dialog`,
  `caption-language-dialog`, `broadcast-dialog`, `bot-wizard-dialog`, `call-prejoin`,
  `call-stats-dialog`; `review-sheet` and the editor's AI drawer stay side/bottom sheets.

### Stage 288 — Schedule: lesson card and button groups (F)

- [x] **288.1** Button groups: `tb-button-group--connected` (toggles: `p-selectbutton`,
  `tb-fc-segments`) and standard `tb-button-group` (actions, 12 dp gap):
  `schedule/ui/lesson-actions.ts`, `schedule/ui/schedule-agenda.ts`.
- [x] **288.2** Lesson card: shared content component in `schedule/ui/` for teacher and student;
  `schedule/teacher/lesson-details-dialog.ts` → `<tb-dialog kind="sheet">`, «Итог» toggle, cancel
  lesson as its own `form` dialog, delete and restore-overlap via `Confirm`; student
  `schedule/student/my-schedule-page.ts` and `home/todo-queue.ts` sheets on `tb-dialog`.
- [x] **288.3** The other schedule dialogs: `lesson-dialog`, `off-time-dialog`,
  `request-answer-dialog` (toggle + one action), `change-request-dialog`, `attendance-dialog`;
  delete the old `.p-dialog:not(.p-confirmdialog, .tb-dialog--short)` phone rules and
  `tb-dialog--short` from `styles.scss`.
- [x] **288.4** Design system restructured (docs): `docs/design-system.md` keeps only the rules,
  in four parts (foundations, frame and pages, components, across the portal; 1210 → about 700
  lines, one M3 / *ours* mark, no version tags, duplicates merged); screen compositions move to the
  new `docs/screens.md`; section references in ADRs, AGENTS.md and code updated.

### Stage 289 — Release 0.34.0

- [ ] **289.1** Skill `release`: help articles (ru, en), wiki pages, E2E suites, CHANGELOG,
  version, plan archive, PR and tag `v0.34.0`.

## Backlog

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
