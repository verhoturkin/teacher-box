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

## v0.15.0

The nearest lesson on the home page (teacher's «Следующее занятие», student's «Ближайшее занятие») is redesigned as a
calendar event: a time tile on the left (day, start time, duration or countdown), who and the topic next to it, the
boards, one filled button. While the lesson runs the tile says «Идёт сейчас» and how much is left; when it
ends the home page reloads the summary. No «Расписание» link in the card.

### 188. Nearest lesson as a calendar event (F)

- [x] 188.1 **F** `schedule/home/lesson-clock.ts` (phase, day caption, countdown; ticks, reports the end),
  `schedule/ui/lesson-time-tile.ts`; `schedule/home/upcoming-lesson-widget.ts` and `next-lesson-widget.ts` on them,
  without the «Расписание» link (the teacher's card without a visible title); `meetings/ui/join-lesson-button.ts`: no tooltip on the split arrow, no gap after it; `boards/manage/board-links.ts` `[chips]`; `home/teacher-home.ts` reloads on `(over)`, the student's widget emits `changed`. Docs:
  design-system §5, glossary, help articles `teacher/first-steps`, student home.
- [x] 188.2 **F** `boards/editor/board-page.ts`: «Назад» returns where the board was opened from in the portal (the
  history), «Доски» / «Мои доски» only for a board opened by a link from outside. Docs: boards module, help articles.
- [x] 188.3 **F** `home/quick-actions.ts`, `shared/ui/fab-menu.ts`: on a phone the quick actions are an M3 Expressive FAB
  menu. Docs: design-system §5, help `teacher/first-steps`.
- [x] 188.4 **F** `help/help-button.ts`, `help/help-article-view.ts`: the help as an M3 modal side sheet
  (`tb-side-sheet`, a little wider), linked articles open in the sheet with «←». Docs: design-system §8.
- [x] 188.5 **F** `homework/teacher/assignments-page.ts`, `assignment-list.ts`: «Активные» and «Выполненные» cards with a
  search by the title or a student and pages of 10; the «На проверку» toggle by the search instead of the header link.
  Docs: homework module, help `teacher/homework`.
- [x] 188.6 **F** `boards/teacher/boards-page.ts`: a search by the title or a student's (group's) name. Docs: boards
  module, help `teacher/boards`.

### 189. Release 0.15.0

- [ ] 189.1 Skill `release`: help articles, E2E spec (`version-0-15-0`, replaces `version-0-14-7`), CHANGELOG, version,
  plan archiving.

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
