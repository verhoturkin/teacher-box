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

## Next release

Goal: compact rows in the list panes of «Ученики» and «Задания» — a long title, a list of names
or a big group no longer makes one row a third of the list. No ADR. Decisions of the teacher
(2026-10-27): clamp the lines and shorten the supporting text; a group row shows the member count
instead of the names; the group's name in assignment rows is a separate stage.

### Stage 303 — Compact rows in the list panes (F)

- [x] 303.1 F: `tb-list--clamp` — the title at most 2 lines, the supporting text at most 2 lines,
  cut with an ellipsis (**M3** list item: one to three lines, longer text truncated); used by the
  list panes of `identity/students/students-page.ts` and
  `homework/teacher/assignments-page.ts` (all their lists). The style next to `.tb-list__title`
  in `styles.scss`; `docs/design-system.md` §10, `docs/screens.md`.
- [x] 303.2 F: shorter supporting text. Assignment rows (`assignments-page.ts` `details`): one or
  two names, from three — the first one and «и ещё N»; the due date `dd.MM HH:mm` in the current
  year, `dd.MM.yyyy HH:mm` otherwise. A group row (`students-page.ts` `groupLine`): «N участников ·
  <nearest lesson>» (the group card's `groupCard.members`), «Пока никого» without members. Tests
  in the pages' specs; no help article describes the rows.

### Stage 304 — The group's name in assignment rows (B, F)

- [ ] 304.1 B: `AssignmentSummary` gets the groups the assignment was given to whole (a group
  whose current members are all among its students, or the group chosen in the picker if the
  assignment keeps it — check `homework` persistence first; names via `identity::api`). Entry
  points: `homework/api` summary DTO, the assignment list query, `docs/modules/homework.md`.
- [ ] 304.2 F: an assignment row shows «Группа 7Б» (and «и ещё N» for other students) instead of
  member names. `homework/data-access/homework.models.ts`, `assignments-page.ts` `details`.

## Backlog

Feature proposals with detailed plans (lesson notes, progress report, packages, invoices, parents,
quizzes, web push, self-booking, calls, spaced repetition) —
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
