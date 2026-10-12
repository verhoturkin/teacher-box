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

## v0.14.2

Homework polish after 0.14.1: wider review fields, text fields that cannot be dragged out of their card, deleting an
assignment, card lists (`tb-list`) instead of tables for the student's tasks, the students of an assignment and the
review queue, materials as a card list like textbooks, «Выдать ещё ученикам» in a dialog, the editor without
materials of a saved assignment.

### 172. Homework polish (B, F)

- [x] 172.1 **B** `homework`: `DELETE /api/teacher/homework/assignments/{id}` — `AssignmentService.delete` removes the
  files of the assignment and of its answers, the answers, the tasks and the assignment (bound textbooks cascade).
- [x] 172.2 **F** `teacher/task-review-page.ts`: the review form is as wide as its card, a taller comment;
  `styles.scss`: `textarea.p-textarea` resizes only vertically and never grows wider than its field.
- [x] 172.3 **F** «Удалить…» (danger confirmation): in the «⋮» menu of `teacher/assignments-page.ts` and on
  `teacher/assignment-page.ts`.
- [x] 172.4 **F** `tb-list` cards: `student/my-homework-page.ts`, students of `teacher/assignment-page.ts`,
  `teacher/review-queue-page.ts`; `ui/attachment-list.ts` — a `tb-list` like `ui/textbook-list.ts` with the same
  «×» to remove.
- [x] 172.5 **F** `teacher/assignment-page.ts`: «Открыть доску» gets its own icon (`pi-arrow-up-right`, also in the
  list menu); «Выдать ещё ученикам» — a dialog (`teacher/assign-more-dialog.ts`) opened by «Добавить» at the top
  right of the «Ученики» card. `teacher/assignment-editor-page.ts`: no textbooks and files when editing (they are
  on the assignment page).
- [x] 172.6 **B** `notifications`: links in messengers go as buttons — «Открыть» (the portal page,
  `NotificationService.notify`), «Подключиться» (the video room, `JoinLink`: room link and lesson reminders), «Справка»
  in `/help`; a messenger that refuses link buttons gets «Открыть: …» in the text (`DeliveryDispatcher`).
- [x] 172.7 **F/B** English texts say «homework», not «assignment» (`features/*/i18n/en.ts`, help articles, server
  dictionaries).
- [x] 172.8 Docs: `docs/modules/{homework,notifications}.md`, design system, help articles.

### 173. Release 0.14.2

- [ ] 173.1 Skill `release`: E2E spec (`version-0-14-2`, replaces `version-0-14-1`), CHANGELOG, version, plan archiving.

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
