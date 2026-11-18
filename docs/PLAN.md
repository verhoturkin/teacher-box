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

## v0.57.0

Goals: the teacher's Today on a phone shows a lesson once — the current or nearest one opens in
place in «Занятия сегодня»; the student's payments lose the all-time totals; less space between
the top bar and the content on a phone; the student card stops repeating the balance and the
messengers; an empty off-time list is one command; the Google Calendar instructions hide behind
«Подключить».

Changed specs: `docs/screens.md` «Today (teacher home)», «Student card», «Student cabinet»
(payments), «Schedule», «Settings» (Lessons); `docs/design-system.md` if a pattern changes.

Order: one substep per session, a commit each; the PR is opened once, after 440.

### 432. Today: one lesson, one row

Sketches: [«Сегодня — один урок»](https://claude.ai/artifact/LoYZXoqAaCHaAYfpi9c9NM), boards 1–4
(phone: lesson live with «Позвать» and the join button; nearest lesson with a call; nearest
lesson without a call; wide screen: lesson live).

- [x] 432.1 *simple* — sketches agreed with the user; copy the canvas into
  `docs/sketches/today/` with a row in `docs/sketches/README.md`.
- [x] 432.2 *complex* F — the big card `schedule/home/upcoming-lesson-widget.ts` leaves the
  teacher's Today (`home/teacher-home.ts`, the `tb-feed__lead` column): the current or nearest
  lesson is the expanded row of `home/today-lessons.ts` — time and its state from
  `schedule/home/lesson-clock.ts` («Идёт · ещё N мин» / «Через N мин»), the end time, avatar,
  name, title and topic, one board link — the student's or group's last opened board
  (`boards/manage/board-links.ts` gets a one-board mode; the backend list may need its order or
  a `lastOpenedAt`), and the join button (`tb-join-lesson-button`, «Начать урок» / «Войти в
  урок») only when the lesson has `joinUrl`; other rows stay one line; the label «Следующее»
  goes (`home/i18n` `todayLessons.next`, both languages). Today without lessons today but with a
  nearest one later: decide with the sketches (keep the widget only for that case, or a one-row
  list) — note the decision in `docs/screens.md`. All widths, not only the phone, unless M3
  says otherwise. `over` → `loadSchedule()` still refreshes. Tests: `today-lessons.spec.ts`,
  `teacher-home.spec.ts`. Docs: `docs/screens.md` «Today», wiki `Home`, help
  `teacher/first-steps` (ru, en) if it names the card.
- [x] 432.3 *complex* B F — «Позвать»: while the lesson runs and the student is not in the
  portal call, the expanded row shows «<Имя> ещё не в звонке» with a small text button
  «Позвать» on that line, apart from the join button (boards 1 and 4); a group — «Позвать
  остальных» for those not in the call. Presence comes from `CallServer.occupiedRooms()`
  (`GET /api/teacher/meetings/calls`); a Telemost or other external room shows no button
  (presence unknown). Backend: `POST /api/teacher/meetings/calls/{ownerId}/summon` in
  `meetings/web/CallsController.java` → a new `MeetingNoticeKind` (inbox, push and messengers,
  with the call link, ru/en texts in `MeetingNoticeTexts`), rate-limited (one per student per
  few minutes), controller test with role checks first (a student gets 403). Frontend: the
  button in `home/today-lessons.ts`, a snackbar «Ученику отправлено приглашение». Docs:
  `docs/modules/meetings.md`, `docs/screens.md` «Today», help `teacher/calls` (ru, en), wiki.

### 433. Student payments without all-time totals

- [x] 433.1 *simple* F — `billing/student/my-billing-page.ts` drops the figures «Начислено за всё
  время» and «Оплачено за всё время» (`totals.charged` / `totals.paid`, texts
  `studentLedger.charged` / `paid` in `billing/i18n` ru and en if nothing else uses them); the
  balance and the history stay. Backend fields stay (the teacher's tab may read them — check
  `student-payments-tab.ts` before deleting anything). Tests: `my-billing-page.spec.ts`. Docs:
  `docs/screens.md` student payments, wiki and help `student/billing` if they name the totals.

### 434. Phone: less space under the top bar

- [x] 434.1 *simple* F — on a phone the gap between the top bar and the first content is too
  big: find where the pane header and the page padding add up (`core/layout/shell.scss` around
  the `max-width` rules, `shared/ui/panes.ts` pane padding, `shared/ui/page-header.ts`) and
  reduce it to one M3 step (16 → 8 px or as M3 compact says) in one shared place, not per page.
  Check Today, Students, Schedule, Homework, Payments for both roles. Tests: the shell/panes
  specs if they pin the padding. Docs: `docs/design-system.md` spacing/layout section.

### 435. Student card: balance and messengers once

- [x] 435.1 *simple* F — `students/student-card.ts` `tags`: the balance tag (debt / prepaid) is
  shown only on the tabs where the balance is not visible otherwise — not on «Обзор» (the
  balance card `billing/teacher/student-balance-card.ts` shows the sum next to the last
  operations) and not on «Оплаты»; the roster row keeps its sum. Tests:
  `student-card.spec.ts`. Docs: `docs/screens.md` «Student card».
- [ ] 435.2 *simple* F — `notifications/teacher/student-channels.ts`: when no messenger is
  connected, one row («Мессенджер не подключён» or the like, `notifications/i18n`) with the
  action «Отправить ссылку на подключение» instead of three rows «Не подключён» plus the
  separate button; with at least one connected the list stays as it is. Tests:
  `student-channels.spec.ts`. Docs: `docs/screens.md` «Student card».

### 436. Schedule: empty off-time is one command

- [ ] 436.1 *simple* F — `schedule/teacher/schedule-page.ts` section «Нерабочее время»: while
  `offTimes()` is empty, no title, icon, hint and «Добавить» — one text button «Добавить
  нерабочее время» (`t.addOffTime`) opening the same dialog; with periods — the title and the
  list with dates as now. Phone screen `offTime` the same. Unused texts (`noOffTimeTitle`,
  `noOffTimeHint`) go from `schedule/i18n` ru and en. Tests: `schedule-page.spec.ts`,
  `schedule-page-mobile.spec.ts`. Docs: `docs/screens.md` «Schedule», wiki if it names the
  empty state.

### 437. Settings › Lessons: Google Calendar as a state

- [ ] 437.1 *complex* F — `schedule/teacher/google-calendar-panel.ts` (in
  `settings/settings-page.ts` case `lessons`) shows only the calendar's state: connected — the
  account and its actions as now; not connected — one line and the button «Подключить» that
  opens a dialog with the steps (Google Cloud, redirect URI) and the client fields; the last
  error stays visible in the panel. Look at `settings/backups/drive-panel.ts` (the same Google
  Cloud steps) and use one pattern for both if it is cheap; otherwise only the calendar. Tests:
  `google-calendar-panel.spec.ts`. Docs: `docs/screens.md` «Settings», wiki and help
  `teacher/calendar` (ru, en) — the steps now start with «Подключить».

### 438. Tabs: no stuck focus, M3 press

- [ ] 438.1 *simple* F — tabs (`p-tabs` with `tbTabIndicator`, `shared/ui/tab-indicator.ts`;
  styles `frontend/src/styles/_sheets.scss` around `.p-tab`, the ripple from
  `core/theme/aura-base.ts` / `app.config.ts`): on a phone a tapped tab keeps a dark focus
  layer — show the focus state only for keyboard focus (`:focus-visible`), never after a tap or
  click; everywhere the press ripple fills a square — clip it to the M3 tab state layer (the
  tab's shape per M3 primary/secondary tabs, `overflow: hidden` with the tab's radius), same
  hover/press opacities as the M3 state layers in `docs/design-system.md`. Check every tab bar
  (student card, settings, homework, schedule phone screens). Tests: `tab-indicator.spec.ts` if
  it pins the classes. Docs: `docs/design-system.md` tabs section.

### 439. View switches as outlined segmented buttons

- [ ] 439.1 *simple* F — «Доски · Учебники» in Materials (`materials/materials-page.ts`, both
  `tb-segment-group` uses) and the calendar views «Неделя · Месяц · Список»
  (`schedule/ui/schedule-calendar.ts`, `buttonGroupClass` → `tb-fc-segments`, its styles) take
  the outlined variant of `docs/design-system.md` (`tb-segment-group [outlined]`, M3 segmented
  buttons, as the homework list «Списком · По ученикам»): one 1 dp outline pill, dividers, the
  chosen segment `secondary-container` with a leading check. FullCalendar renders its own
  buttons: restyle `tb-fc-segments` to the same look, or hide its view buttons and drive
  `changeView` from a `tb-segment-group` — the cheaper one that keeps keyboard and
  `aria-pressed`. Check both roles (student materials `my-materials-page.ts` if it has the
  switch) and phone. Tests: `materials-page.spec.ts`, `schedule-calendar.spec.ts`. Docs:
  `docs/design-system.md` — move «Доски · Учебники» and the calendar views to the outlined
  examples (decided with the user on 2026-11-18).

### 440. Release 0.57.0

- [ ] 440.1 *simple* — browser check of the changed screens (phone and desktop, both roles),
  small defects fixed, the rest listed.
- [ ] 440.2 *simple* — skill `release`: help articles checked, E2E spec of the changed journeys,
  CHANGELOG, version bump, plan archived.

## Backlog

Feature proposals with detailed plans (progress report, packages, invoices, parents, quizzes,
self-booking, calls, spaced repetition) — [`roadmap/`](roadmap/README.md); move one here as a
release when the teacher picks it.

Decided against on 2026-11-15 (don't propose again without a new reason): `no-store` of homework
attachments stays (a shared computer must not keep files); one language of the dictionaries per
load; Caddy alone instead of Caddy in front of nginx; colours on the board list; times in the
portal time zone; search in the remaining long lists and list-detail for the review queue.
