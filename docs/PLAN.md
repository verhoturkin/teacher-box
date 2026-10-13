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

## v0.15.1

Student's side as the teacher's: the nearest lesson card after the sketch, homework in «Активные» / «Выполненные» with a
search; answered requests folded; «Мой аккаунт» fields across their cards.

### 190. Student's cards (F)

- [x] 190.1 **F** `schedule/home/next-lesson-widget.ts`: the student's nearest lesson laid out as the teacher's card.
- [x] 190.2 **F** `homework/student/my-homework-page.ts`, `my-task-list.ts`: «Активные» / «Выполненные» with a search and
  pages of 10.
- [x] 190.3 **F** `schedule/student/my-schedule-page.ts`: «Мои запросы» — pending ones shown, the resolved ones under
  «Решённые: N».
- [x] 190.4 **F** `identity/account/account-page.ts`, `change-password-form.ts` (`narrow`): the account forms take the
  width of their cards. Docs: design-system, help `cabinet/*`.

### 191. Release 0.15.1

- [ ] 191.1 Skill `release`: E2E spec (`version-0-15-1`), CHANGELOG, version, plan archiving.

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
