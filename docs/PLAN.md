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

## v0.14.1

Fixes after 0.14.0: homework has no kinds again (written only), the AI writes no HTML; «Выдать и поместить на доску»
and the board of an assignment («Перейти на доску» for the student); textbook pages reach the board; one Markdown
field with a «Текст / Просмотр» switch; groups as a multiselect like students; the list of assignments as cards.

New ADR: **ADR-0041** — homework without kinds, the board of an assignment (supersedes ADR-0040).

### 170. Homework without kinds, the board of an assignment (B, F)

- [x] 170.1 **B** `homework`: kinds, the interactive page (`InteractivePages`, its controller, links, preview, nginx
  headers) and «Готово» removed (code back to 0.13.1 plus `AssignmentFiles`); migration `V5` drops `kind`,
  `interactive_html`, `submissions.result`, adds `board_id`; `PUT /api/teacher/homework/assignments/{id}/board`;
  `boardId` in `AssignmentDetails` / `AssignmentSummary` / `AssignmentInfo`; `AssignmentSummary.students` (names).
- [x] 170.2 **B** `ai`: no `HomeworkKind` — prompts without kind (migration `V3`), draft `{prompt, title?, sources?}`
  with prompts `homework-draft.*.v3`, no HTML and no `look`.
- [x] 170.3 **F** Editor (`teacher/assignment-editor-page.ts`): no kind, one text field with «Текст / Просмотр», no
  «На доску» by the text, «Выдать» in the portal colour, «Выдать и поместить на доску» (saves, then `ToBoardDialog`
  with the frame and the pictures — textbook pages included; `placed` → `PUT …/board`). `tb-group-picker` — a
  multiselect (`picked` / `dropped`) in the editor, on the assignment page and in the broadcast dialog.
- [x] 170.4 **F** Assignment page: «На доску» with textbook pages and no text, remembers the board, «Открыть доску»;
  «Выдать ещё ученикам» — students and groups side by side. List of assignments — cards with the progress badge and
  «⋮». Student task — «Перейти на доску» (`@features/boards/parts` `MyBoardButton`).
- [x] 170.5 **F** AI panel and prompt library without kinds and HTML pages (`page-look.ts` removed).
- [x] 170.6 Docs: ADR-0041, `docs/modules/{homework,ai,boards,identity}.md`, design system, glossary, help articles.

### 171. Release 0.14.1

- [ ] 171.1 Skill `release`: E2E spec (`version-0-14-1`, replaces `version-0-14-0`), CHANGELOG, version, plan archiving.

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
