# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md); don't read them
unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5 lines),
  new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, …
  Tags: **B** backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes (`schedule/teacher/lesson-details-dialog.ts`,
  `ScheduleService.cancel`) — so the work starts there instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to Backlog. This file
  keeps only unreleased work and the Backlog.

## v0.10.0

Goals: phone fixes (round photo on the user button, no blue tap highlight); a new «Учебники» section — the
teacher's textbooks, workbooks and other materials (images, PDF, DOC/DOCX) shared with students and groups;
textbooks bound to assignments by pages; pages of a textbook put on a board as pictures inside a frame.

ADR: [ADR-0033](adr/0033-textbooks.md) — module `textbooks`, PDF pages rendered on the server (PDFBox),
`homework` → `textbooks::api`.

### Stage 131. Phone fixes (F)

- [x] 131.1 `core/layout/shell.ts` / `shell.scss`: the user button in the top bar stays a circle with a photo
  on a phone (the avatar fills a round button, no padding stretching it).
- [x] 131.2 `styles.scss`: `-webkit-tap-highlight-color: transparent` for the whole document — pressed elements
  show their own M3 state layer, not the browser's blue fill.

### Stage 132. Module `textbooks` (B)

- [x] 132.1 ADR-0033, `docs/modules/textbooks.md`, root `AGENTS.md` (module table, isolation table). Module
  `ru.teacherbox.textbooks` (deps `shared`, `identity::api`), schema `textbooks` (`textbooks`,
  `textbook_members`), `TextbooksDataReset`, `TextbooksProperties` (`TEACHERBOX_TEXTBOOKS_MAX_FILE_SIZE`,
  default 100 MB). Kinds `TEXTBOOK` / `WORKBOOK` / `OTHER`; fields title, course, page count (PDF — from the
  file via PDFBox, an image — 1, DOC/DOCX — entered by the teacher), one file (png/jpeg/webp/gif, PDF, DOC,
  DOCX checked by content), members — students and groups like boards.
- [x] 132.2 REST `TeacherTextbooksController` `/api/teacher/textbooks`: list, create (multipart: file + fields),
  change (with `version`), replace the file, delete, download, page image `GET /{id}/pages/{n}` (PNG,
  PDF rendered by PDFBox, an image as is); `MyTextbooksController` `/api/me/textbooks` (student: own and
  groups' textbooks, download). Tests incl. «another student gets 404».
- [x] 132.3 `textbooks::api`: `Textbooks` facade (`find(ids)` summaries, `content(id, pages)` — a PDF cut to the
  pages, other files whole) for `homework`.

### Stage 133. «Учебники» section (F)

- [x] 133.1 `features/textbooks/`: data access, labels, `teacher/textbooks-page.ts` (`/teacher/textbooks`, menu
  item after «Задания»): one card per row — kind icon, title, course, kind, pages, members; add, change,
  replace the file, download, delete. `textbook-dialog.ts` (kind, title, course, pages for DOC/DOCX, file,
  students, groups).
- [x] 133.2 `student/my-textbooks-page.ts` (`/cabinet/textbooks`, after «Задания»): the student's textbooks,
  download. Help articles (teacher, student), glossary.

### Stage 134. Textbooks in assignments (B, F)

- [x] 134.1 **B** `homework`: table `assignment_textbooks` (assignment, textbook, pages), `AssignmentService`
  `bindTextbook` / `unbindTextbook` (`POST|DELETE /api/teacher/homework/assignments/{id}/textbooks`), pages
  checked against the page count (`PageRanges`); `AssignmentDetails.textbooks`, `AssignmentInfo.textbooks`;
  the student downloads the bound pages `GET /api/me/homework/tasks/{taskId}/textbooks/{textbookId}`.
- [x] 134.2 **F** assignment page/dialog: «Учебники» block — bind (textbook picker + pages), unbind; the
  student's task page lists the textbooks with pages and a download.

### Stage 135. Textbook pages on a board (F)

- [ ] 135.1 `boards/to-board`: a material of pages (`mode: 'pages'`, image URLs); `editor/material-insert.ts`
  makes a frame named after the textbook and pages, with the pages as pictures in a row inside it; only
  Excalidraw boards take pages.
- [ ] 135.2 «На доску» from the textbooks page and from the assignment's textbooks: choosing the pages of a
  multi-page file (the bound pages preselected); not for DOC/DOCX.

### Stage 136. Release 0.10.0

- [ ] 136.1 Skill `release`: help, E2E `version-0-10-0.spec.ts`, CHANGELOG, version, archive.

*Note:* the commits of stages 131 and 132 say «stage 126» and «stage 127»: they were numbered before
release 0.9.3 (stages 126–130) was merged.

## Backlog

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.

Future:
- Student photos in the remaining lists (`StudentSummary.avatar` exists since 0.9.2): homework (assignment,
  review queue), the monthly report, schedule requests, the messengers panel of notifications.
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
