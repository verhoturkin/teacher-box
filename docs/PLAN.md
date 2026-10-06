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

## v0.9.3

Goals: Google Sans instead of Roboto; billing and boards as one-line lists like «Ученики» (no tables), also
on the phone; read notifications move to a «Прочитанные» section folded by default.

ADR: ADR-0017 amended — the font is Google Sans.

### Stage 126. Google Sans (F)

- [x] 126.1 `styles.scss` `--tb-font`: `@fontsource-variable/google-sans` (OFL-1.1, weights 400–700, no CDN)
  instead of `@fontsource-variable/roboto`; `knip.json`; design-system §3, ADR-0017, README.

### Stage 127. Billing as lists (F)

- [ ] 127.1 `billing/teacher/billing-overview-page.ts`: students' balances — a `tb-list` like «Ученики»
  (avatar; name link + «цена · занятий · последнее»; trail — balance and the wallet button, one line on the
  phone) instead of the `p-table`.
- [ ] 127.2 `billing/ledger/ledger-table.ts` (teacher's `student-ledger-page.ts`, student's
  `my-billing-page.ts`): lessons and payments — a `tb-list` (icon; operation + status tag; «date · details»;
  trail — amount and «×» for the teacher), 20 rows and «Показать ещё» instead of the paginator.

### Stage 128. Boards as a list (F)

- [ ] 128.1 `boards/teacher/boards-page.ts`: a `tb-list` like «Ученики» (kind icon; title link + «кому ·
  изменена»; trail — kind tag and «⋮» menu: «Резервные копии», «Изменить», «Удалить…»).

### Stage 129. Read notifications folded (B, F)

- [ ] 129.1 **B** `GET /api/me/notifications?read=true|false` (`MyNotificationsController.list`,
  `NotificationService.page`, `InboxRepository.findPage/count`): optional filter, `total` counts the filtered
  ones. **F** `notifications/inbox/inbox-panel.ts`: unread on top; «Прочитанные» — `tb-fold-card` folded by
  default, loaded when opened, with its own «Показать ещё»; a notification marked read (or «Прочитать все»)
  moves there.

### Stage 130. Release 0.9.3

- [ ] 130.1 Skill `release`: help, E2E `version-0-9-3.spec.ts`, CHANGELOG, version, archive.

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
