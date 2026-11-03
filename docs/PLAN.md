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

## v0.45.1 — settings after the review of 0.45.0

Goals: fix what the teacher found in 0.45.0. The sketches are updated (canvas
https://claude.ai/artifact/L3wuTYeXnspJ9AGwHRD6kx, version 38: boards `Main`, `StudentAccount`,
`Data`, rule «Широкий экран без пустот» on `Changes`). The sketch takes priority; depart from it
only for a gross M3 violation and name it.

### Stage 360 — Review fixes

- [x] **360.1 F** «Мой аккаунт» on wide windows (teacher and student): the cards share the width
  evenly (auto-fit grid from 360 px, each card stretches to its column, no empty half at 1920+);
  «Уведомления» splits into two cards «Куда присылать уведомления» and «Что присылать» so the
  three columns match (`identity/account/account-panel.ts`,
  `notifications/account/notifications-section.ts`). «Подключить» of «Это устройство» stays on
  its row like the other rows (`tb-list__trail--inline`), at every width.
- [x] **360.2 F** Spacing: the children of a `.tb-section-card` keep the card's 12 px gap (the
  backups alert, list and «Все N копий» touch now, `settings/backups/backups-card.ts`); the
  alerts in dialogs keep the dialog's 16 px gap from the fields around them (restore, reset and
  the other dialogs with a `p-message`). Fix it once in the shared styles, not per card.
- [ ] **360.3 F** Google Drive copies folded like the server copies: the last three and «Все N
  копий в Диске» (`settings/backups/drive-panel.ts`, as `backups-card.ts` does).
- [ ] **360.4** Release 0.45.1 (skill `release`).

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
