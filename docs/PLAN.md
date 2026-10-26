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

Goal: the schedule calendar looks like Google Calendar in M3 roles (stage 292).

### Stage 292 — Calendar in the manner of Google Calendar (F)

- [x] 292.1 F: grid, day header, lesson cards and month cells — `*Class` options in
  `schedule/ui/schedule-calendar.ts`, `tb-cal-*` in `styles.scss`, `docs/screens.md`.
- [ ] 292.2 F: calendar height follows the screen — the minimum is the current (content) height,
  above it the grid fills the free height of the page (`expandRows`, `height: '100%'` in a
  flex-column container, `scrollTime` on the current hour); week, day and month; the phone list
  keeps the content height (ADR-0015). Entry points: `schedule/ui/schedule-calendar.ts`,
  `schedule/teacher/schedule-page.ts`, `tb-cal-*` in `styles.scss`, `docs/screens.md`.
- [x] 292.3 F: filter chips of the teacher's schedule in one row — the chips that do not fit go to
  a «Ещё N» menu (`ResizeObserver`, the selected chip always stays in the row, «Все» first);
  opt-in input of `shared/ui/filter-chips.ts`, other pages keep wrapping; the phone's screen chips
  are unchanged. Entry points: `shared/ui/filter-chips.ts`, `schedule/teacher/schedule-page.ts`,
  `docs/design-system.md`, `docs/screens.md`.
- [ ] 292.4 F: the rest — toolbar (outlined «Сегодня», icon-button arrows, larger period title),
  list view, phone layout check.

## Backlog

Feature proposals with detailed plans (lesson notes, progress report, packages, invoices, parents,
quizzes, web push, self-booking, calls, spaced repetition, quick wins) —
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
