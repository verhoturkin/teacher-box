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

## v1.7.3

Goals: the administrator's settings page follows the design system; student and group cards are compact and
easier to scan, on a phone too.

### Stage 99. Admin settings page by the design system

- [x] 99.1 **B F** Sections of `SettingsCatalog` get a `section` key; `admin/settings/settings-page.ts` — sections
  fold (`tb-fold-card`, `?open=`, badge of unsaved changes), full-width stack, M3 outlined fields (label on the
  outline, variable and source under the field), Docker and accounts as a segmented `tb-list`.

### Stage 100. Compact student and group cards

- [x] 100.1 **F** `identity/students/students-page.ts` — the student card drops «Группы» and «Доски» (groups are in
  the panel below, boards in «Доски»); `tb-cards--wide` in `styles.scss` — the name on top, the fields side by side
  under it (label above the value, wrapping), actions top right on a computer and after the fields on a phone;
  `groups-panel.ts` — «Ученики» as `tb-cell-long`. Help «Ученики», design system §9, `boards.md`.
- [x] 100.2 **F** Closed cards show only the main line — a student's name and phone, a group's name and members;
  the rest and the actions open with «Подробнее» (`shared/ui/open-cards.ts`, `td.tb-card-actions` labelled text
  buttons). `students-page.ts`, `groups-panel.ts`, `styles.scss`, help «Ученики» / «Группы», E2E 1.2 and 1.6.8.
- [x] 100.3 **F** `identity/students/invite-link-dialog.ts` by the design system: the link is a full-width outlined
  field, «Закрыть» and «Копировать ссылку» (filled green) in the footer, initial focus on the title.

## Backlog

Carried over from 1.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles.

Future:
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
