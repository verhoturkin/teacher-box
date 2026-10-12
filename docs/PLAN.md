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

## v0.14.0

Homework and AI generation. Three kinds of homework — written, on a board, interactive (HTML with built-in checks);
a full-page assignment editor (variant B of the redesign: editor on the left, AI panel on the right, students /
due date / textbooks / files as chips); a due date that defaults to the next lesson; a prompt library; AI drafts from
textbook pages and assignment files; AI-generated interactive HTML.

New ADRs:
- **ADR-0039** — `ai` reads sources: `ai` may depend on `textbooks::api` (`Textbooks.content`) and `homework::api`
  (a new read-only `AssignmentFiles.content(assignmentId, attachmentId)`); the frontend sends IDs, not files. PDF
  pages go to the provider as a document (Anthropic) or page pictures (OpenAI-compatible / Gemini); size limits.
- **ADR-0040** — interactive homework: HTML is stored as is and never rendered in the portal's own document; it is
  served by a separate endpoint with its own CSP (`sandbox allow-scripts`, no `allow-same-origin`, `default-src
  'none'`, inline script/style, `img-src data:`, `frame-ancestors 'self'`) by a short-lived signed link, shown in
  an `<iframe sandbox="allow-scripts">`; the page reports its result with `postMessage`
  (`{type: 'teacherbox:result', score?, maxScore?, answers?}`), the portal checks `event.source` and the shape.

### 165. Homework kinds (B, F)

- [x] 165.1 **B** `homework`: `AssignmentKind` `WRITTEN` / `BOARD` / `INTERACTIVE` (migration V3: column `kind`,
  existing rows `WRITTEN`; `interactive_html` ≤ 200 000 characters). `kind` in the create request (blank — written),
  `AssignmentDetails` / `AssignmentSummary` / `AssignmentInfo`; kind is fixed after creation. `BOARD` and
  `INTERACTIVE` take no textbooks and no attachments (`assignment.materials-not-allowed`), `INTERACTIVE` needs HTML
  (`assignment.html-required`). *Frontend models get `kind` in 165.4.*
- [x] 165.2 **B** Submissions by kind: `WRITTEN` — text / files as now; `BOARD` — «Готово» without text and files;
  `INTERACTIVE` — «Готово» with an optional `result` (`InteractiveResult`: score, max score, answers) stored as JSON
  on the submission. `StudentHomeworkService.markDone`, `POST /api/me/homework/tasks/{id}/done`; 403/404 tests.
- [x] 165.3 **B, D** ADR-0040: `GET /api/me/homework/tasks/{id}/interactive-link` and
  `/api/teacher/homework/assignments/{id}/interactive-link` → signed link (5 min) to
  `GET /api/public/homework/interactive/{token}` served with its own CSP; nginx keeps that CSP for this path
  (`docker/nginx/default.conf.template`, `security-headers.conf`). Tests for the token (expired, other task) and headers.
- [ ] 165.4 **F** Student task page (`student/my-task-page.ts`) by kind: written — as now; board — description,
  «Открыть доску» (own boards from `@features/boards/parts`), «Готово»; interactive — `ui/interactive-frame.ts`
  (sandboxed iframe, `postMessage` listener, height from the page), «Готово» sends the last result. Teacher's
  `task-review-page.ts` shows the interactive result (score, answers) and the kind. Labels in `homework-labels.ts`.
- [ ] 165.5 **F** «На доску» for written homework (`@features/boards/to-board`): a frame named «<title> · <date>»,
  inside it the task text first, then attachments (pictures, PDF pages) and textbook pages left to right
  (`editor/material-insert.ts`, `to-board/board-insert.ts`). Specs for the order and the frame name.
- [ ] 165.6 **B, F** Docs: `docs/modules/homework.md`, ADR-0040 + row in `docs/adr/README.md`, glossary
  («Письменное», «На доске», «Интерактивное», «Готово»).

### 166. Assignment editor page — redesign variant B (F)

- [ ] 166.1 **F** Routes `/teacher/homework/new` and `/teacher/homework/:id/edit` replace `assignment-dialog.ts`
  (callers: `assignments-page.ts`, `assignment-page.ts`, home widgets; «Новое задание» navigates). Header: back,
  title, kind segmented control (create only), «Выдать» / «Сохранить». Leave-with-unsaved-changes prompt.
- [ ] 166.2 **F** Left column by kind: title; written — Markdown editor with side-by-side preview at ≥ 1200 px,
  «На доску»; board — description only; interactive — HTML editor (monospace textarea) + live preview in
  `ui/interactive-frame.ts`. Below: chips — students (+ group), due date, textbooks (`bind-textbook-dialog.ts`),
  files — only those the kind allows.
- [ ] 166.3 **F** Due date default: on choosing students, if the teacher has not set the date, it becomes the start
  of the earliest next lesson of the chosen students (`ScheduleApi` from `@features/schedule/parts`; add
  `GET /api/teacher/schedule/next-lessons?studentIds=` **B** in `schedule` if missing), hint «до занятия <date>»;
  no lesson — empty.
- [ ] 166.4 **F** Mobile layout (one column, AI panel as a bottom sheet), design-system section for the editor page,
  help articles (`features/help/articles/teacher.{ru,en}.ts`). Old `assignment-dialog.ts` and its spec removed.

### 167. AI panel and prompt library (B, F)

- [ ] 167.1 **B** `ai`: `prompts` table (title ≤ 100, text ≤ 4000, kind `WRITTEN` / `BOARD` / `INTERACTIVE` or
  any, version); CRUD `/api/teacher/ai/prompts`; in the full reset; ADMIN — 403. Tests.
- [ ] 167.2 **B** One draft endpoint `POST /api/teacher/ai/homework-draft` `{kind, prompt, title?, sources[]}`
  (replaces topic / level / count — prompt version v2; the old v1 fields dropped with the old dialog). Kind
  `INTERACTIVE` appends the fixed system requirement (`homework-interactive.system.v1.txt`, short: only a single
  HTML document, no external resources, portal look via CSS variables passed in the prompt, report the result with
  `postMessage`); output validated: one document, no `<script src>`, no external URLs.
- [ ] 167.3 **F** `features/ai/homework-ai-panel.ts` (replaces `homework-draft-dialog.ts`): prompt library
  dropdown + quick chips, sources (bound textbooks / files of the assignment), prompt field, «Сгенерировать»,
  «Сохранить промт», draft preview with «Вставить» / «Заменить»; HTML drafts preview in the sandboxed frame.
  Library management (rename, delete) on `/teacher/ai`.

### 168. AI from textbook pages and files (B)

- [ ] 168.1 **B** ADR-0039; `package-info.java` of `ai` allows `textbooks::api`, `homework::api`; table in
  `AGENTS.md` §4.2. `homework::api.AssignmentFiles.content(assignmentId, attachmentId)`.
- [ ] 168.2 **B** Sources in `AiAssistant`: textbook pages via `Textbooks.content` (PDF cut; ≤ 20 pages, ≤ 20 MB,
  `ai.source-too-large`), images and PDFs of the assignment; `LlmRequest` gets attachments; Anthropic adapter — `document`
  / `image` blocks, OpenAI-compatible — page pictures (`PdfPages.picture` via a new `Textbooks.pagePicture`) as
  `image_url`. Tests with the local HTTP server / `MockRestServiceServer`. `docs/modules/ai.md`.

### 169. Release 0.14.0

- [ ] 169.1 Skill `release`: help articles, E2E spec (create each kind, interactive result reaches the teacher,
  AI panel hidden when AI is off), CHANGELOG, version, plan archiving.

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
