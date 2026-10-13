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

## v0.14.5

Assignment materials in the editor look and open like on the assignment page; the AI assistant also reads files
picked for a new assignment, not saved yet. Boards get their own icon; the prompt search is an M3 search bar.

ADR: [0042](adr/0042-ai-reads-picked-files.md) — picked files go with the draft request (amends ADR-0039).

### 179. Board icon and prompt search (F)

- [x] 179.1 **F** `styles.scss`: icon `pi pi-tb-board` (a presentation board with a chart, Tabler `presentation`, MIT)
  instead of `pi-th-large` everywhere a board is meant (nav, boards, «На доску»). `ai/homework-ai-panel.ts`: the
  search in «Промты» is a `p-iconfield` search bar like on «Ученики». Docs: design-system §4 (icons).

### 180. AI reads files picked for a new assignment (B, F)

- [x] 180.1 **B** `ai/web/TeacherAiController`: `POST homework-draft` also as `multipart/form-data` (part `brief` —
  the JSON request, parts `files`); `DraftSources.Upload` — the same types and limits (5 sources, 20 MB).
  ADR-0042, `docs/modules/ai.md`.
- [ ] 180.2 **F** `ai/data-access/ai-api.ts` (`homeworkDraft(brief, files)`), `SourceOption.file`;
  `homework/teacher/assignment-editor-page.ts` offers the picked PDF and pictures of a new assignment.

### 181. Materials in the editor (F)

- [ ] 181.1 **F** `homework/ui/file-picker.ts`: picked files as a card list (`tb-list`, like `tb-attachment-list`),
  the name opens the file. `ui/textbook-list.ts`: the teacher opens a textbook by its title (the whole file, a
  PDF at the first bound page); `teacher/assignment-page.ts` — a file name opens it (PDF and pictures in a tab),
  the editor — picked textbooks and files. Docs: `docs/modules/homework.md`, help articles.

### 182. Release 0.14.5

- [ ] 182.1 Skill `release`: help articles, E2E spec (`version-0-14-5`, replaces `version-0-14-4`), CHANGELOG, version, plan archiving.

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
