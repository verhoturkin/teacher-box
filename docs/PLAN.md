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

## v0.9.1

Goals: polish of the teacher's settings on the phone (backup rows with a «⋮» menu, full-screen reset dialog),
a favicon, a round logo in the top bar; students get their own avatar and the name they want to see in their
cabinet (the teacher keeps the name they set); a GitHub README in the M3 style.

### Stage 116. Settings on the phone

- [x] 116.1 **F** `features/settings/settings-page.ts`, `backups/backups-card.ts`: backup rows — a `tb-list`
  (icon, date + kind/size, «⋮» popup `p-menu` with «Восстановить», «Скачать», «Удалить»), one line on the phone;
  integration rows and the other cards checked against the design system at 375 px. *Also: integration statuses
  under the names (the names were cut), cards on the phone 16 px at the sides (titles line up with list cards),
  the logo row — «Загрузить» + bin icon in one line.*
- [x] 116.2 **F** `features/settings/reset-card.ts`: the reset dialog (2 fields) is full screen on the phone
  (no `tb-dialog--short`, design system §8).

### Stage 117. Favicon and the round logo

- [x] 117.1 **F** `frontend/public/favicon.svg` (+ `favicon.ico` fallback, `apple-touch-icon.png`), `index.html`;
  the portal logo, when set, replaces all of them (`Portal.showIcon`).
- [x] 117.2 **F** `core/portal/portal-logo.ts`: the top bar logo (and its preview in settings) is cropped to a
  circle (`round`, `object-fit: cover`).

### Stage 118. Student avatar and own name

- [x] 118.1 **B** `identity`: migration V5 (`own_name`, `avatar_key`, `avatar_type`); `PUT /api/me/profile`
  (student's own name, empty — the teacher's), `PUT|DELETE /api/me/avatar` (PNG/JPEG/WebP ≤ 1 MB, students
  only), `GET /api/public/avatars/{key}` (secret link); `AccountView.displayName` is the own name for the
  student, `StudentView` keeps the teacher's name and gets `avatar`; the full reset removes the files (platform).
- [x] 118.2 **F** `shared/ui/avatar.ts` (photo or initials); «Мой аккаунт» of the student — photo (cropped to a
  square and scaled to 256 px in the browser, `shared/files/square-photo.ts`) and name; the top bar user menu and
  the students list show the photo. *Other lists with initials (billing, homework, schedule) keep the initials:
  their modules get names via facades without the photo — Backlog.*

### Stage 119. README

- [ ] 119.1 README for GitHub in the M3 style: hero with the logo and badges, feature cards, screenshots-free
  sections with icons, install in one command first.

### Stage 120. Release 0.9.1

- [ ] 120.1 Skill `release`: help, E2E `version-0-9-1.spec.ts`, CHANGELOG, version, plan archive.

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
- Student photos in the other lists (billing, homework, schedule, calls): add the photo address to
  `StudentSummary` and pass it through the modules' views.
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
