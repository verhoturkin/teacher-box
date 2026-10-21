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

## Redesign 2026-10 (releases 0.21.0–0.26.0, stages 229–249)

Spec: [`redesign/README.md`](redesign/README.md) (target interface, §N below refer to it); mockups and the
analysis: [`redesign/report.html`](redesign/report.html). Every substep is one session and one commit: read
spec §0–§2 and the § it names, load the `m3-expressive` skill for UI work, update `docs/design-system.md` for what
the substep changed, help articles (ru, en) and `docs/wiki/` for what users see. Releases go in order; a later
release may start only after the previous one is merged to `main`.

## v0.26.0 — Materials, cabinet, admin, search

Boards and textbooks in one feed with previews; the student's five destinations; the admin's five; global
search as an experiment. ADR: **0049** if D3 merges Materials (new navigation of materials).

### 245. Materials (B, F) — experiment D3

- [x] 245.1 **B** Previews: board — PNG exported by the editor on save (`boards/editor`, Excalidraw
  `exportToBlob`) to `PUT /api/teacher/boards/{id}/preview`, served with the board; textbook — cover from the
  first page on upload (`textbooks`; decide the PDF / Word renderer in the substep). Storage in each module's
  `FileStorage` namespace; tests; module docs. *Decision: PDFBox (already used) renders PDF covers and an image is
  its own cover; a Word file has no cover (`hasCover` false, the feed shows the format icon) — no heavy renderer.*
- [x] 245.2 **F** Spec §10.1: `features/materials` page (or inside `boards` with `textbooks/parts` — decide by the
  frontend isolation rule) from `boards/teacher/boards-page.ts` + `textbooks/teacher/textbooks-page.ts`; feed,
  connected group, chips, one filter; routes `/teacher/materials`, redirects from `/teacher/boards`,
  `/teacher/textbooks`; `TEACHER_MENU`.
  *Decision: own feature `features/materials` composing `BoardsFeed` / `TextbooksFeed` from the `parts.ts` of their
  modules (design-system «Materials»); the rail «Создать» menu has seven items — «Доска» and «Учебник» both.*
- [x] 245.3 **F** Student: `boards/student/my-boards-page.ts` + `textbooks/student/my-textbooks-page.ts` → one
  «Материалы» page.
- [x] 245.4 **D** design-system (feed), help (boards, textbooks; ru, en), wiki.

### 246. Student cabinet (F)

- [x] 246.1 **F** `core/layout/student-layout.ts`: five destinations (spec §5), bar without «Ещё».
- [x] 246.2 **F** `features/home/student-home.ts` → two-column feed (spec §10.4); «Оплачено N занятий» from
  `GET /api/me/billing/summary` (balance ÷ price; a backend field if the price is not there).
- [x] 246.3 **F** `homework/student/my-homework-page.ts` + `my-task-page.ts` → list-detail.
- [x] 246.4 **D** design-system, cabinet help (ru, en), wiki for students.

### 247. Admin (F)

- [x] 247.1 **F** Spec §10.5: «Состояние» = `admin/status/status-page.ts` + `admin/diagnostics/diagnostics-page.ts`;
  «Журнал» = `admin/logs/log-page.ts` + `admin/events/events-page.ts` with chips; `admin-layout.ts` menu of five;
  redirects.
- [x] 247.2 **F** `admin/integrations`, `admin/backups`, `admin/settings` → list-detail like 234.
- [x] 247.3 **D** design-system, admin help (ru, en), wiki «Администрирование».

### 248. Global search (B?, F) — experiment D6

- [x] 248.1 **D** Decide the source: frontend over the teacher's loaded lists, or `GET /api/teacher/search?q=`
  over module facades (each module searches its own data). Write the decision into spec §2.
  *Decided: frontend, no endpoint (spec §2, D6); `core/search` contract — `SEARCH_SOURCES`, `GlobalSearch`,
  `searchEntries` — is ready for 248.2; the search is the teacher's only.*
- [x] 248.2 **F** Search bar in the top strip (`shell.ts`), Ctrl K, results grouped (students, groups,
  assignments, boards, textbooks); compact — the search icon in the top app bar opens a full-screen search.
- [ ] 248.3 **D** design-system, help (ru, en), wiki.

### 249. Release 0.26.0 (D)

- [ ] 249.1 **D** Skill `release`; E2E: materials feed, student bar of five, search. Move `docs/redesign/` to
  `docs/archive/redesign-2026-10/` and fold what is still useful into `docs/design-system.md`.

## Backlog

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the monthly report,
homework and board lists by name) and the options of student / group selects.

Shell after 0.21.0: on the boards page filtered by a student (`?student=`) the rail «Создать › Доска» drops the
filter, so the new board's dialog no longer prefills that student (the header «Новая доска» did on desktop).

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles. *List-detail for the review queue, «Следующая работа», filter chips and
search in long lists are planned in the redesign (stages 237, 242, 248).*

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
