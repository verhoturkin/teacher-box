# 11. Quick wins

Status: proposal. Size: S each — one substep, one session, one commit. No ADR. Most of them are the
audit proposals in the Backlog of `docs/PLAN.md` that wait for the teacher's decision; each item
below names what the teacher has to confirm.

## Q1. «Отменить» after «Пропуск» and «Проведено» (F)

- Today marking an outcome charges the lesson at once (`LessonCompleted` → billing). A wrong tap
  is fixed by correcting the mark, which publishes `LessonCompletionRevoked` — the backend already
  supports undo.
- Change: after a mark from the lesson card, Today («Нужно сделать») or the attendance dialog, show
  a snackbar «Отмечено: пропуск · Отменить» for 6 s; «Отменить» calls the existing correction
  endpoint with the previous state. No confirmation dialog before the mark.
- Entry points: `schedule/ui/` lesson actions, `schedule/teacher/attendance-dialog.ts`, the Today
  widget in `schedule/home/`; the shared snackbar/toast service in `shared/ui`.
- Tests: unit — undo restores the previous outcome and refreshes the list; E2E in
  `e2e/tests/schedule/` — mark missed, undo, balance unchanged.
- Teacher confirms: the snackbar instead of a confirmation (audit §7).

## Q2. Export of the operations journal (B, F)

- `GET /api/teacher/billing/operations.csv?month&kind&studentId` and `?from&to` for a year:
  CSV in UTF-8 with BOM and `;` separator (Excel in the Russian locale opens it right), columns
  date (instance time zone), student, kind, amount in currency units with a comma, comment,
  voided. Optional XLSX later — no new dependency now.
- A «Доход за период» variant for the self-employed: payments only, grouped by day — the numbers
  they enter into «Мой налог».
- Entry points: `billing/web/TeacherBillingController`, `BillingQueryService` (the journal query
  exists), frontend «⋮ › Скачать CSV» in the payments page header (`billing-overview-page.ts`).
- Tests: controller test (student 403, content type, BOM, escaping of `;` and quotes in names),
  unit test for the frontend download.
- Teacher confirms: columns, and whether student names go into the file (they do — it is the
  teacher's own data; the admin has no access to this endpoint).

## Q3. Duplicate an assignment (B, F)

- «Создать копию» in the assignment «⋮»: a new draft with the same text, files (copied in
  `FileStorage`, namespace `homework`), textbooks and pages, videos with transcripts — no students,
  no due date, no board. Covers «выдать то же задание другой группе через месяц» without
  templates.
- Entry points: `homework/application/AssignmentService` (`copy(assignmentId)`),
  `POST /api/teacher/homework/assignments/{id}/copy`, `homework/teacher/assignments-page.ts` row
  menu and `assignment-page.ts` header «⋮», opening the editor of the copy.
- Tests: service test that files are new keys (deleting the original keeps the copy's files),
  quiz questions copied when 06 lands.

## Q4. Prompt on leaving unsaved settings (F)

- Settings cards with a form (`features/settings/**`, the portal cards, AI system prompts, bot
  settings) get the `canLeaveGuard` the homework editor already uses; a dirty card asks
  «Отменить изменения?» on route change, and the browser `beforeunload` asks on reload.
- With 0.34.0 the dialog is the shared `Confirm` (`shared/ui/confirm.ts`) — do this after stage 285.

## Q5. File check before upload (F)

- `shared/files/` — one `checkFiles(files, policy)` used by every picker: size limit and type by
  extension and, for images and PDF, by the first bytes (`Blob.slice(0, 8)`), with the same error
  texts as the backend (`file.too-large`, `file.type-unsupported`). Limits come from the existing
  module settings endpoints (`TEACHERBOX_HOMEWORK_MAX_FILE_SIZE` etc.) — add them to the module
  `settings` views if missing.
- Entry points: `homework/ui/file-picker.ts`, receipts in `billing/teacher/payment-dialog.ts`,
  textbooks upload, avatar. The backend checks stay (the frontend check is only for speed).

## Q6. Journal filters in the URL (F)

- `billing-overview-page.ts`: month, kind and student filters as query params (`?month=2026-10&
  kind=PAYMENT&student=…`), so «Назад» and a reload keep them; the same for homework list search
  (`assignments-page.ts`) and the students roster chips (`roster.ts`).
- Tests: router-based unit tests that the page reads and writes the params.

## Order

Q1, Q2 and Q3 bring the most value; Q4 waits for 0.34.0 stage 285; Q5 and Q6 any time. Each can be
a patch release (`0.34.x`) or a stage in the next release.
