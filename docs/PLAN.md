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

## v0.10.2

Goals: the home card «Уведомления» shows only unread notifications, each with «Отметить прочитанным», and
«Прочитать все» in its title.

### Stage 141. Unread notifications on the home page (F)

- [x] 141.1 `notifications/home/latest-notifications-widget.ts`: loads `GET /api/me/notifications?read=false`;
  a ✓ per notification and «Прочитать все» in the card title (`POST …/read-all`); a read one leaves the list
  and the next unread takes its place; empty — «Новых уведомлений нет». Help (teacher, student),
  `docs/modules/notifications.md`.

### Stage 142. Release 0.10.2

- [ ] 142.1 Skill `release`: E2E, CHANGELOG, version, archive.

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

Future:
- Student photos in the remaining lists (`StudentSummary.avatar` exists since 0.9.2): homework (assignment,
  review queue), the monthly report, schedule requests, the messengers panel of notifications.
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
