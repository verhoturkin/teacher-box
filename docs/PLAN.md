# Teacher Box plan

Active plan only, in English. Completed releases — [`archive/plans/`](archive/plans/README.md);
don't read them unless the task needs history.

## How to use

- A release is a `## vX.Y.Z` section (or `## Next release` until the number is known): goals (2–5
  lines), new/changed ADRs, then stages.
- Stages are numbered globally, continuing from the archive. Substeps: `85.1`, `85.2`, … Tags: **B**
  backend, **F** frontend, **D** docker/infra.
- A substep names its entry points — files, classes, endpoints, routes
  (`schedule/teacher/lesson-details-dialog.ts`, `ScheduleService.cancel`) — so the work starts there
  instead of a repository search.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## v0.40.0

Goals: fix what the teacher's interface review of 2026-10-28 found in daily use — a quiz bug, the
calendar, notifications, lists, tooltips, the place of the account and of the device settings, and
full-screen dialogs on a phone. No new ADR.

### 327. Quick fixes

- [x] 327.1 **B** Crediting an unanswered quiz question: `QuizService.override` throws
  `homework.quiz-answer-not-found` (404, «Не найдено…») when the best attempt has no answer row for
  the question; save a new `QuizAnswer` with an empty answer instead and recount the score. Test in
  the quiz integration tests: override of an unanswered question → 204 and the score grows.
- [x] 327.2 **F** Small frontend fixes: (a) `schedule/ui/schedule-calendar.ts` `toEvent` sets
  `startEditable` instead of `editable`, so a lesson can be moved but never resized from its bottom
  edge; (b) the second «?» in homework: drop `tb-help-button` from the detail panes
  `assignment-page.ts` and `task-review-page.ts` (the list pane keeps it); (c) the scrollbar of
  `core/notifications/notifications-sheet.ts` sits at the sheet's edge, not beside the cards;
  (d) on compact the sheet's tabs «Входящие · Отправленные» share the width equally with centred
  labels, as on a computer (`tb-tabs` keeps label width on a phone only where tabs may scroll).
- [x] 327.3 **F** Android navigation bar in the colour of the bottom bar: edge-to-edge
  (`viewport-fit=cover` in `index.html`), the bottom bar (`core/layout/shell.scss`) extends under
  the gesture bar with `env(safe-area-inset-bottom)` padding; check that the FAB, the review
  floating toolbar, snackbars and bottom sheets stay above the gesture area. `system-bars.ts` keeps
  `theme-color` for the status bar. Update design-system «System bars».
- [x] 327.4 **B** Push without the letter circle: Chrome on Android draws a letter avatar of the
  origin when a notification has no `icon`. `notifications/application/PushChannel.payload` adds
  `icon` — a transparent 1×1 PNG served by the frontend (`frontend/public/`) — and `badge` — a
  monochrome app icon; absolute links via `Portal.link`. Test of the payload.

### 328. Leaner lists

- [x] 328.1 **F** Remove filter chips: «Ученик или группа» in Materials (`materials-page.ts`, with
  the member select and `?student=` / `?group=`; old addresses just open the tab) and «Должники» /
  «Без мессенджера» in the students list (`identity/students/roster.ts`; old `?filter=` values fall
  back to «Все»). The debtors stay reachable on a phone: the payments page shows «Должники» under
  the figures on compact (`billing-overview-page.ts`, now hidden there). Update screens.md.
- [x] 328.2 **F** «Скачать CSV» moves from the «⋮» of the payments header into the monthly report
  (`monthly-report-page.ts`, a tonal button in its header; the whole month's journal); the payments
  header loses «⋮». Update screens.md and the help article.

### 329. Tooltips

- [ ] 329.1 **F** M3 plain tooltip everywhere (`pTooltip`, ~45 uses): no arrow, shown below the
  element and flipped above when there is no room, never to the side; inverse-surface, Body Small,
  4 dp corners, min height 24 dp. One global default (preset `tooltip` in
  `core/theme/teacher-box-preset.ts`, `styles.scss`, a shared default for `tooltipPosition`), not an
  edit per use. Update design-system.

### 330. Account and settings

- [ ] 330.1 **F** The avatar menu leaves the top bar (only the bell stays). «Аккаунт» (avatar +
  name) becomes the last item of the rail's bottom group and of the ☰ drawer for every role and
  opens «Мой аккаунт». Theme and language move into «Мой аккаунт» (teacher: settings category
  `account`; student: `/cabinet/account`; admin: its settings) together with «Выйти».
  `core/layout/shell.ts`, `side-nav.ts`, `identity/account/account-page.ts`. Update design-system
  «Top bar» / «User button», screens.md «Frame by role», help articles, wiki.
- [ ] 330.2 **F** «Уведомления на устройствах» moves from «Мой аккаунт» into the category
  «Мессенджеры», renamed «Уведомления и мессенджеры» (`settings/settings-categories.ts`; the old
  address redirects). Student: the same block stays in their account. Update screens.md, help, wiki.

### 331. Full-screen dialogs and release

- [ ] 331.1 **F** Full-screen dialog (`tb-dialog kind="form"` on compact, `shared/ui/dialog`):
  28 dp top corners and the top inset of the notifications sheet (*ours*), the confirming button in
  the header is filled (*ours*; M3 has a text button). Update design-system «Full-screen dialog».
- [ ] 331.2 Release 0.40.0 (skill `release`).

## v0.41.0

Goals: the student card and the homework list scale to hundreds of items; a lesson has a title and
a separate topic, and its summary lives in the lesson card. New ADR for the title / topic split.

### 332. Student card

- [ ] 332.1 **F** «Ближайшие занятия» (`schedule/teacher/student-lessons-card.ts`) as an M3 list:
  a 40 px icon circle (the nearest one primary), «Сегодня, 15:00–16:00» and «title · topic»; the
  custom date tile goes.
- [ ] 332.2 **B F** «Предстоящие» (`student-lessons-tab.ts`): a series is one row («Каждый вт и чт,
  15:00 · 60 мин», since, end, «ещё N»), one-off lessons and exceptions (moved, cancelled) are their
  own rows; «Показать все даты» unfolds the full list.

### 333. Homework list

- [ ] 333.1 **F** `homework/teacher/assignments-page.ts`: assignments grouped by deadline («Срок на
  этой неделе», «Позже», «Без срока», «Просрочено» folded), a «Кому» select (student or group, in
  the address); «Готовые» loads 20 at a time.

### 334. Lesson title and topic

- [ ] 334.1 **B** `schedule`: the column `topic` becomes `title` (default from the student or the
  group: calendar, ICS, Google, bot, events to billing), a new nullable `topic` (what the lesson
  covers); a saved «Тема следующего занятия» goes into the topic of the next planned lesson of the
  same student or group when empty. ADR, `docs/modules/schedule.md`.
- [ ] 334.2 **F** Lesson form and card: «Название» and «Тема»; the topic in the card, the home hero,
  the student's views.

### 335. Summary in the lesson card

- [ ] 335.1 **F** The lesson card holds «Что прошли» (prefilled with the topic, visible to the
  students, AI «Черновик» kept) and «Тема следующего занятия», with «Сохранить» and «Отправить
  ученику»; the dialog «Итоги урока» goes; private notes are no longer written, old ones stay
  read-only in «История».
- [ ] 335.2 Release 0.41.0 (skill `release`).

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the
monthly report, homework and board lists by name) and the options of student / group selects.

`shared/ui/fold-card.ts` (`tb-fold-card`) is used by no page since 247.2: remove it or find it a use.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):

- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation
or "Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times
in the portal time zone; picking a reschedule time from free slots; file check before upload;
journal filters in the URL; prompt on leaving unsaved settings; invitation and first-run fixes;
list-detail for the review queue; filter chips instead of toggles. _List-detail for the review
queue, «Следующая работа», filter chips and search in long lists are planned in the redesign (stages
237, 242, 248)._

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
