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

## v0.11.1

Server texts in the user's language (backlog, ADR-0035 «Последствия»): the server learns the language each user
chose and writes inbox notifications, bot messages and calendar feeds in it; the administrator's settings
catalog and integration checks follow the language of the page. New ADR-0036.

### Stage 152. The user's language on the server (B, F)

- [x] 152.1 `shared.i18n.Language` (`RU`, `EN`; `of(code)`, `current()` — the request's `Accept-Language`,
  `spring.web.locale: ru`); `identity.users.language` (V6), `PUT /api/me/language`, `language` in
  `GET /api/me`, `UserDirectory.language(id)`. Frontend: `Accept-Language` on every `/api` request
  (`core/i18n/language.interceptor.ts`), the choice saved to the account (`chooseLanguage`, after sign-in when the
  device has its own choice). ADR-0036.

### Stage 153. Inbox notifications in the recipient's language (B)

- [x] 153.1 `notifications/application/NotificationTexts` per language (dates, money, durations, weekdays);
  texts of `Schedule/Homework/Billing/Meeting/StudentNotifications`, the reminder to connect a messenger and
  the test message — in the recipient's language.

### Stage 154. Bot messages in the user's language (B)

- [ ] 154.1 `ChatUser.language`, `ChatAction.title(Language)`, `ChatKit` / `ChatText` by language
  («Да»/«Yes», pages, dates; typed words of both languages understood); `ChatEngine`, `ChannelService` replies
  (unknown chats — the teacher's language), bot commands.
- [ ] 154.2 Actions of `billing`, `schedule`, `meetings`, `boards` (`*/chat/*ChatAction`) in the user's language.

### Stage 155. Administrator texts and calendars (B)

- [ ] 155.1 `SettingsCatalog` titles, hints and sections, `SettingKind` problems and integration checks in the
  language of the request.
- [ ] 155.2 Calendar feeds (`FeedService`, `IcsWriter`) in the language of the feed's owner; Google Calendar
  events (`GoogleCalendarService`) in the teacher's language.

### Stage 156. Release 0.11.1

- [ ] 156.1 Skill `release`: help, E2E `version-0-11-1.spec.ts`, CHANGELOG, version, archive.

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
