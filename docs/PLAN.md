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

## v0.20.1

The colour of a student or a group tints the background of their rows in the teacher's lists instead of the
avatar: the row is built from the same surface roles as any row, taken from the Fidelity scheme of the colour;
the avatar and the lead keep the theme colours. Interface changes are made with the `m3-expressive` skill.

### 227. Coloured rows (F)

- [x] 227.1 **F** `core/theme/label-colors.ts` surface roles of every colour, `styles.scss` rows
  `[data-tb-label]`, `TeacherColors.studentLabel / groupLabel / ownerLabel`, `tb-avatar` without `[color]`, the nearest-lesson card without a colour, the calendar painted only for the teacher (`showStudent`); lists
  of students, groups, billing, homework, schedule, meetings, messengers; help articles, wiki `Features`,
  `docs/design-system.md`.

### 228. Release 0.20.1 (D)

- [ ] 228.1 **D** CHANGELOG, version 0.20.1, plan archive.

## Backlog

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the monthly report,
homework and board lists by name) and the options of student / group selects.

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
