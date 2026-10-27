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

## v0.36.0

Goal: quick wins from [`roadmap/11-quick-wins.md`](roadmap/11-quick-wins.md) — undo of a lesson
mark, CSV of the operations journal, copy of an assignment, prompt on leaving unsaved settings,
file check before upload, journal filters in the URL. No ADR. Decisions of the teacher
(2026-10-27): one release; snackbar 6 s instead of a confirmation; CSV of the journal only (no
«Доход за период», no year range); the copy as in the roadmap.

### Stage 296 — «Отменить» after a lesson mark (F)

- [x] 296.1 F: after «Пропуск» / «Проведено» from the lesson card, Today («Нужно сделать») or the
  attendance dialog — no confirmation, a snackbar «Отмечено: пропуск · Отменить» for 6 s;
  «Отменить» calls the existing correction endpoint with the previous state (backend publishes
  `LessonCompletionRevoked`) and refreshes the list. Entry points: `schedule/ui/` lesson actions,
  `schedule/teacher/attendance-dialog.ts`, the Today widget in `schedule/home/`, the shared
  toast/snackbar in `shared/ui`. Tests: unit (undo restores the outcome, refresh); E2E in
  `e2e/tests/schedule/` — mark missed, undo, balance unchanged.

### Stage 297 — CSV of the operations journal (B, F)

- [x] 297.1 B: `GET /api/teacher/billing/operations.csv?month&kind&studentId` — UTF-8 with BOM,
  `;` separator; columns: date (instance time zone), student, kind, amount in currency units with
  a comma, comment, voided. Entry points: `billing/web/TeacherBillingController`,
  `BillingQueryService` (journal query). Tests: controller (student 403, admin 403, content type,
  BOM, escaping of `;` and quotes).
- [ ] 297.2 F: «⋮ › Скачать CSV» in the payments page header (`billing-overview-page.ts`) with the
  current filters; unit test of the download.

### Stage 298 — Copy of an assignment (B, F)

- [ ] 298.1 B: `AssignmentService.copy(assignmentId)` and
  `POST /api/teacher/homework/assignments/{id}/copy` — a new draft «<title> (копия)» with the text,
  files (new keys in `FileStorage` namespace `homework`), textbooks and pages, videos with
  transcripts; no students, no due date, no board. Tests: service (deleting the original keeps the
  copy's files), controller roles.
- [ ] 298.2 F: «Создать копию» in the row «⋮» of `homework/teacher/assignments-page.ts` and the
  header «⋮» of `assignment-page.ts`, opening the editor of the copy.

### Stage 299 — Prompt on leaving unsaved settings (F)

- [ ] 299.1 F: settings cards with a form (`features/settings/**`, portal cards, AI system prompts,
  bot settings) use `core/routing/can-leave.guard.ts` with the shared `Confirm`
  (`shared/ui/confirm.ts`) — «Отменить изменения?» on route change, `beforeunload` on reload.

### Stage 300 — File check before upload (F)

- [ ] 300.1 F: `shared/files/` `checkFiles(files, policy)` — size limit and type by extension and,
  for images and PDF, by the first bytes; texts as the backend (`file.too-large`,
  `file.type-unsupported`); limits from the module settings endpoints (add if missing). Used by
  `homework/ui/file-picker.ts`, receipts in `billing/teacher/payment-dialog.ts`, textbooks upload,
  avatar. Backend checks stay.

### Stage 301 — Filters in the URL (F)

- [ ] 301.1 F: query params for the journal filters of `billing-overview-page.ts`
  (`?month=&kind=&student=`), the search of `assignments-page.ts` and the chips of the students
  `roster.ts`; «Назад» and reload keep them. Tests: router-based unit tests.

### Stage 302 — Release 0.36.0

- [ ] 302.1 Help articles (teacher, student; every language) and the wiki pages touched, E2E
  scenarios in the functional suites, `CHANGELOG.md` and application versions 0.36.0, archive
  stages 296–302, shorten `roadmap/11-quick-wins.md`, run local verification, publish the
  annotated `v0.36.0` tag.

## Backlog

Feature proposals with detailed plans (lesson notes, progress report, packages, invoices, parents,
quizzes, web push, self-booking, calls, spaced repetition, quick wins) —
[`roadmap/`](roadmap/README.md); move one here as a release when the teacher picks it.

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
