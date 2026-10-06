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

## v0.9.2

Goals: students' photos wherever the teacher sees students next to money, calls and today's lessons;
«Мой аккаунт» and the teacher's «Настройки» full width in the M3 Expressive style, without «Интеграции»;
no section titles on the phone.

ADR: ADR-0021 amended — no narrow page column, forms keep a readable width inside their cards.

### 120. Students' photos in billing, calls and home (B, F)

- [x] 120.1 **B** `identity.api.StudentSummary.avatar` (`UserDirectoryService.summary`); passed through
  `BillingViews.StudentBalance` / `Debtor` (`BillingQueryService.overview`, `summary`),
  `CallService.CallCard`, `ScheduleNames` → `ScheduleViews.LessonView.studentAvatar` / `ParticipantView`.
  **F** `tb-avatar [photo]` in `billing-overview-page.ts` (column «Ученик»), `finance-widget.ts`,
  `calls-page.ts`, `today-lessons-widget.ts`, `upcoming-lesson-widget.ts` (gets an avatar),
  `schedule-page.ts`, `lesson-details-dialog.ts`.

### 121. Settings without «Интеграции» (F)

- [ ] 121.1 `settings/settings-page.ts`: the «Интеграции» card (messenger and AI statuses) removed; messengers
  are in «Уведомления», the AI assistant — in its section. Help `teacher/settings`.

### 122. «Мой аккаунт» and «Настройки» full width, M3 Expressive (F)

- [ ] 122.1 `identity/account/account-page.ts`: full width; profile hero (large avatar, name, role, login /
  e-mail / phone as `tb-stats`), forms in cards with `tb-form--narrow` fields. Used by teacher, student and
  administrator.
- [ ] 122.2 `settings/settings-page.ts`: full width, sections in `tb-fold-card` (`?open=`), like the
  administrator's settings and «Уведомления»; `tb-stack--narrow` removed; design-system §4, ADR-0021.

### 123. No section titles on the phone (F)

- [ ] 123.1 `styles.scss` (`tb-page-header`): on compact windows a section page's title (and its «?») is
  hidden visually, kept for screen readers; nested pages keep «Назад» + title; the empty header takes no
  room. Design-system §5.

### 124. Release 0.9.2

- [ ] 124.1 Skill `release`: help, E2E `version-0-9-2.spec.ts`, CHANGELOG, version, archive.

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
