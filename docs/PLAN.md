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

## v0.11.0

Goals: the interface in English as well as Russian, the language chosen in the user menu under the theme and
ready for more languages; students' photos in every list of students; fixes of a text task on a board, «Мои
доски» in the bot and a lesson planned from the month view.

ADR: [0035](adr/0035-interface-languages.md) — interface languages.

### Stage 147. Fixes (B, F)

- [x] 147.1 «На доску» → «Текстом» on an Excalidraw board put nothing: the text was inserted at once, before
  Excalidraw loaded the drawing, and the loaded drawing replaced it (a picture or pages came later and
  stayed). `boards/editor/material-insert.ts` `sceneLoaded` waits for the editor's first change without
  `isLoading`.
- [x] 147.2 «Мои доски» in the bot: the reply carries link buttons to the portal, and Telegram refuses the
  whole message when the portal's address is local (an IP, `localhost`, no domain) — the student got
  nothing. `MessengerPolling` sends a reply refused for its link buttons again with the links in the text
  (`OutgoingMessage.linksInText`).
- [x] 147.3 A day picked in the month view planned a lesson of 1440 minutes from midnight:
  `schedule/ui/schedule-calendar.ts` passes `allDay`, `schedule-page.ts` `onSlot` takes the default
  duration and 10:00 of that day.

### Stage 148. Students' photos in the remaining lists (B, F)

- [x] 148.1 `StudentSummary.avatar` in `HomeworkViews.TaskSummary` / `ReviewQueueItem`,
  `BillingViews.JournalLesson` / `JournalPayment` (the monthly report), `NotificationViews.StudentChannels`;
  `tb-avatar` instead of the initials in `homework/teacher/assignment-page.ts`, `review-queue-page.ts`,
  `billing/teacher/monthly-report-page.ts`, `notifications/teacher/student-messengers-panel.ts` (schedule
  requests already had it).

### Stage 149. Interface languages (F)

- [ ] 149.1 `core/i18n/language.ts`: the registry of languages (`ru`, `en`), the device setting `tb.language`,
  `translations({ ru, en })` — a dictionary of the current language whose shape the compiler checks against
  the Russian one; locale of Angular, `Intl`, PrimeNG, FullCalendar and Excalidraw by the language;
  switching reloads the page. ADR-0035.
- [ ] 149.2 The language in the user menu under the theme (`core/layout/shell.ts`), on the sign-in and
  invitation pages.

### Stage 150. English interface (F)

- [ ] 150.1 Core and shared: shell, navigation, routes' titles, errors (`core/http/error-messages.ts`),
  PrimeNG texts, `shared/ui`, plurals by the language (`shared/text/plural.ts`), money and dates.
- [ ] 150.2 Features: identity, settings, home, billing, homework, schedule, notifications, meetings, boards,
  textbooks, ai, admin — each with `i18n/ru.ts` + `i18n/en.ts`.
- [ ] 150.3 Help articles in English (`features/help/articles/en/`).
- [ ] 150.4 `docs/glossary.md` — English words of the terms; `docs/design-system.md` — texts through the
  dictionaries.

### Stage 151. Release 0.11.0

- [ ] 151.1 Skill `release`: help, E2E `version-0-11-0.spec.ts`, CHANGELOG, version, archive.

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
- Two-way Google Calendar sync.
- Board templates / duplicating.
- Lesson packages/subscriptions, online payment.
- Telegram login, 2FA for teacher and administrator.
- WhatsApp and e-mail channels.
- AI hints for students with quotas.
