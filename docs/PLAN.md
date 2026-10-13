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

## v0.15.3

Feedback after 0.15.2: calmer home pages, notifications without lead icons and read by a swipe on a phone, the
teacher's schedule actions with labels and menus, boards split into the portal's and external ones.

### 194. Home pages and notifications (F)

- [x] 194.1 **F** `home/student-home.ts`: no «Видеозвонки» and «Мои доски» cards (`meetings/home/my-calls-card.ts`,
  `boards/student/my-boards-card.ts` go); `schedule/home/next-lesson-widget.ts` shows the boards of the lesson as
  chips, as the teacher's card (`boards/student/my-board-links.ts`).
- [x] 194.2 **F** `home/teacher-home.ts`: no «Сегодня» (`schedule/home/today-lessons-widget.ts` goes).
- [x] 194.3 **F** `notifications/home/latest-notifications-widget.ts`, `inbox/notification-list.ts`: no lead icons;
  a swipe sideways on a phone marks a notification read (`shared/ui/swipe.ts`). Docs: design-system §9.

### 195. Schedule and boards (F)

- [x] 195.1 **F** `schedule/teacher/schedule-page.ts` «Отметьте прошедшие занятия»: buttons with labels; on a phone
  the row opens a bottom sheet with them, as the student's upcoming lessons.
- [x] 195.2 **F** `schedule/teacher/schedule-page.ts`: the actions of recurring lessons and days off in «⋮».
- [x] 195.3 **F** `boards/teacher/boards-page.ts`, `boards/student/my-boards-page.ts`: two cards «Доски на портале»
  and «Внешние доски»; a tap anywhere on a board's row opens it. Docs: design-system §9.

### 196. Release 0.15.3

- [ ] 196.1 Skill `release`: E2E spec (`version-0-15-3`), CHANGELOG, version, plan archiving.

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
