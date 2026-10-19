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

## v0.20.0

Students and groups get a colour: the teacher picks it in the student's and the group's dialog from a fixed palette
of ten M3 custom colours (roles of both themes computed by `@material/material-color-utilities`, not harmonized —
the colours must stay apart). Rows of the teacher's lists tied to a student or a group show it (the avatar, the
lesson in the calendar), and so do the chips of student and group multiselects.

### 225. Colours of students and groups (B, F)

- [x] 225.1 **B** `identity`: migration `V2__colors.sql` (`users.color`, `student_groups.color`), enum
  `domain.LabelColor`, `Profile.color` / `StudentGroup.color`; `StudentView.color`, `GroupView.color`; create and
  update requests of `/api/teacher/students/**` and `/api/teacher/groups/**` take `color` (null — none).
- [x] 225.2 **F** `core/theme/label-colors.ts` (palette, M3 custom colours → `--p-md-label-<key>{,-container,-on-container}`
  of both themes, contrast tests), `identity/data-access/label-colors.ts` (teacher's lookup by student / group id,
  refreshed on save), colour select in `student-form-dialog.ts` and `group-form-dialog.ts`.
- [x] 225.3 **F** colour in lists: `tb-avatar` `[color]`, directive `tbChipColors` for `p-multiselect`; billing,
  homework, schedule (rows and calendar events), meetings, notifications, boards, textbooks, students and groups.
- [x] 225.4 **D** help articles, wiki, `docs/modules/identity.md`, `docs/design-system.md`.

### 226. Release 0.20.0 (D)

- [ ] 226.1 **D** CHANGELOG, version 0.20.0, plan archive.

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
