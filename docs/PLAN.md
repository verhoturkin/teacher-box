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
- Every new substep carries a complexity mark — *simple* (mechanical edit, docs, config) or
  *complex* (architecture, big refactor, subtle bug) — so the user or an orchestrating agent picks
  the model: smaller for simple, larger for complex. Several complex substeps do not share a
  session.
- Each substep ends with a green `./scripts/verify.sh` and a commit that also ticks its `[x]`.
- Partly done? Tick it and note in italics what was dropped and where it went (Backlog or next
  release).
- **Archiving** (skill `release`): in the release commit move the whole section to
  `archive/plans/vX.Y.Z.md`, add a row to `archive/plans/README.md`, move unfinished items to
  Backlog. This file keeps only unreleased work and the Backlog.

## v0.56.0

Goals: the teacher's Today splits the queue into lessons to mark and work to review, debtors leave
it; the student's schedule on a phone uses tonal cards like the rest of the portal and the
student's home loses the lesson materials; a notification in the portal holds no address — a tap
opens the page it is about, the address stays in messengers; one modal pattern for the date and
the time pickers, and the time picker closes without a jerk.

Changed ADR: 0067 (the date picker becomes modal everywhere — a row in its «Изменения» or a new
ADR if the decision turns over). Changed specs: `docs/screens.md` «Today», «Student cabinet»,
«Notifications»; `docs/design-system.md` §9 pickers; `docs/modules/notifications.md`.

Order: one substep per session, a commit each; the PR is opened once, after 431.

### 427. Teacher's Today: two queues, no debtors

- [x] 427.1 *complex* F — `features/home/todo-queue.ts` (one card with `kind` lesson / request /
  review / debt) becomes two cards in the queue column of `features/home/teacher-home.ts`:
  «Отметить занятия» (unmarked lessons with «Проведено | Пропуск» in place, change requests of
  the schedule under them — they are schedule work too; ours) and «Проверить работы» (the review
  queue). Each card has its own count and its own empty state; a card with nothing to do hides
  (no two «Всё сделано» at once: one compact empty state when both are empty). The first-run
  steps stay under them. Debt rows are removed: `debtors` / `currency` inputs, the `debt` kind,
  `tb-queue__icon--debt`, their texts in `home/i18n`; the finance widget keeps the total debt and
  the debtor count (`billing/home/finance-widget.ts`, fix its comment). Phone: the same two cards
  in one column, rows stay one line. Tests: `todo-queue.spec.ts`, `teacher-home.spec.ts`. Docs:
  `docs/screens.md` «Today (teacher home)», wiki `Home`/first steps page, help article
  `teacher/first-steps` (ru, en).

### 428. Student: tonal schedule cards, home without materials

- [ ] 428.1 *simple* F — the student's schedule on a phone shows white cards: the list items take
  `--p-md-surface-container-lowest` (`schedule/student/my-schedule-page.ts`, styles near
  `--tb-list-item`); make them tonal like the teacher's schedule and the rest of the portal (the
  same `--tb-list-item` / lesson-card surface as `schedule/teacher`), light and dark; check the
  agenda and the day views. Test or a screenshot check at 390 px.
- [ ] 428.2 *simple* F — remove the lesson materials from the student's home
  (`features/home/student-home.ts`: the `tb-feed__materials` section, `MATERIALS`,
  `materialsTotal`, its styles and texts in `home/i18n`; the materials stay in the lesson and in
  «Материалы»). Tests: `student-home.spec.ts`. Docs: `docs/screens.md` «Student cabinet», wiki,
  student help article of the home page (ru, en).

### 429. Notifications: no addresses in the portal, a tap opens the page

- [ ] 429.1 *complex* B F — the inbox keeps the text without the address, messengers keep it.
  Today a notice with a room (`meetings/notices/MeetingNotices.java` MEETING_LINK,
  `schedule/notices/ScheduleNotices.java` SCHEDULE_REMINDER and the other `join(body)` with
  `t.meetingLink(room)`) puts the address into `NoticeText.body` (inbox) and the text without it
  into `roomBody` (messengers, with a «Подключиться» button). Turn it over: `body` is the text
  without the address for the inbox; the messenger text carries the address (and keeps the
  buttons) — rename `roomBody` to what it now means (e.g. `chatBody`) in
  `shared/notice/NoticeText.java`, `NoticeRequested`,
  `notifications/application/NotificationService` and its producers. Every notice that refers to something has a portal `link` (check MEETING_LINK
  and reminders: the lesson / the schedule). Old inbox rows that already hold an address stay as
  they are (no migration; YAGNI) — *or* strip URLs in a Flyway migration of `notifications` if the
  teacher wants a clean inbox (decide in the session, note it). Tests: notices tests of meetings
  and schedule, `NotificationServiceTest` (inbox body has no `https://`, the messenger text has
  it).
- [ ] 429.2 *simple* F — the whole notification row opens its `link` (not only the title button):
  `notifications/inbox/notification-list.ts`, `inbox-panel.ts`, the bell sheet; it marks it read
  and closes the sheet; a row without a link is not interactive. Drop the «long address breaks
  anywhere» styles. Tests: `inbox-panel.spec.ts`. Docs: `docs/screens.md` «Notifications»,
  `docs/modules/notifications.md`, wiki `Notifications`, help articles (ru, en).

### 430. Date and time pickers: one modal pattern

- [ ] 430.1 *complex* F — the date picker opens as a modal centred dialog like the time picker,
  on every size (M3 modal date picker: headline, supporting text, «Отмена» / «ОК»; typed entry
  in the field stays), instead of the docked dropdown on a desktop and the full-screen one on a
  phone: `shared/ui/date-field.ts` (and `date-time-field.ts` which uses it), the same dialog
  shell, scrim and enter/leave motion as `shared/ui/time-picker.ts`. Gallery sample
  `features/gallery/fields/`. Tests: `date-field.spec.ts`, `date-time-field.spec.ts`; E2E helper
  `e2e/tests/support/date-time.ts` follows. Docs: `docs/design-system.md` §9, ADR-0067 update,
  wiki `Schedule` if it describes the picker.
- [ ] 430.2 *simple* F — the time picker's closing animation jerks
  (`shared/ui/time-picker.ts`): find the cause (leave animation vs. the dialog removed before it
  ends, a layout change of the dial, a spring on a non-transform property) and close on the M3
  exit motion (`--tb-spring-*` effects / emphasized accelerate) with only `opacity` /
  `transform`; the same exit for the date picker of 430.1. Check on a phone width in the
  browser. Test of the leave state if testable.

### 431. Release 0.56.0

- [ ] 431.1 *simple* — skill `release`: help articles checked, E2E spec of the changed journeys,
  CHANGELOG, version bump, plan archive; then push and one draft PR for the whole release.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
