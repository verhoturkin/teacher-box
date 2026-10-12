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

## v0.13.0

Goals: a default lesson topic per student and per group, prefilled when the teacher plans a lesson or a
series; payment receipts — the teacher attaches a receipt (image or PDF) to a payment in the portal or sends it
to the bot, which records the payment with it; students download the receipts of their payments.

ADRs: new [ADR-0038](adr/0038-files-sent-to-the-bot.md) — files sent to the bot (SPI `ChatAction.received`,
download by the messenger adapters, receipts kept by `billing`).

### Stage 160. Default lesson topic (B, F)

- [x] 160.1 B: `identity` — `default_topic` of a student and a group (migration `V*__default_topic.sql`),
  in `StudentProfile` / group commands and views, `PUT /api/teacher/students/{id}`, `/groups/{id}`; tests.
- [x] 160.2 F: field «Тема по умолчанию» in `identity/students/student-form-dialog.ts` and
  `identity/groups/group-form-dialog.ts`; `schedule/teacher/lesson-dialog.ts` and `series-dialog.ts` fill an
  empty, untouched topic with the default of the chosen student or group; help articles.

### Stage 161. Payment receipts (B, F)

- [x] 161.1 B: `billing` — table `receipts` (one per payment, files in namespace `billing`, images and PDF up
  to 10 MB), `PUT|DELETE|GET /api/teacher/billing/payments/{id}/receipt`, `GET /api/me/billing/payments/{id}/receipt`
  (own payments only), `hasReceipt` in payment views, receipts left without a payment removed after a day,
  data reset; tests incl. «another student gets 404».
- [x] 161.2 B: files sent to the bot — `shared.chat.ChatFile`, `ChatAction.received(user, file)`;
  `IncomingMessage.file` with download in `TelegramChannel` (`photo`, `document`, `getFile`), `VkChannel`
  (`photo`, `doc`), `MaxChannel` (`image`, `file`); `ChatEngine` hands a file to the first action that takes it;
  `billing/chat/RecordPaymentChatAction` takes a teacher's file as a receipt → student → amount → confirm →
  payment with the receipt.
- [x] 161.3 F: receipts in `billing/ledger/` (attach / replace / remove, download), in the payment dialog
  (optional file), in `billing/student/` (download); help articles (portal and bot).

### Stage 162. Release 0.13.0

- [ ] 162.1 Skill `release`: help, E2E `version-0-13-0.spec.ts`, CHANGELOG, version, archive.

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
