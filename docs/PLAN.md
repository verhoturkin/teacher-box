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

## Redesign 2026-10 (releases 0.21.0–0.26.0, stages 229–249)

Spec: [`redesign/README.md`](redesign/README.md) (target interface, §N below refer to it); mockups and the
analysis: [`redesign/report.html`](redesign/report.html). Every substep is one session and one commit: read
spec §0–§2 and the § it names, load the `m3-expressive` skill for UI work, update `docs/design-system.md` for what
the substep changed, help articles (ru, en) and `docs/wiki/` for what users see. Releases go in order; a later
release may start only after the previous one is merged to `main`.

## v0.21.0 — Shell

Breakpoints and panes of M3, the rail with «Создать» at its top, the page title inside the pane, the ☰ modal rail
on a phone instead of «Ещё». Sections keep their content; their layouts change in later releases.
ADR: **0048** «Панели и навигация по задачам» (refines 0021 «Одна колонка» for expanded and wider, 0027 «Ещё»).

### 229. Decisions (D)

- [x] 229.1 **D** Ask the teacher D1–D5 (spec §2), record the answers in the spec's table; adjust the spec and
  these stages to the answers. Write ADR-0048 (Russian: context — `report.html#shell`, decision — spec §1, §3, §5;
  consequences — redirects, design-system rewrite per stage); rows in `docs/adr/README.md` (0048 new, 0021 and 0027
  «refined by 0048»); a line at the top of `docs/design-system.md` pointing to `docs/redesign/README.md` as the
  target. `verify.sh docs`.

### 230. Breakpoints and panes (F)

- [x] 230.1 **F** Spec §3.1: `core/layout/mobile.ts` (`injectWindowSize` → compact / medium / expanded / large /
  extra-large at 600 / 840 / 1200 / 1600), `core/layout/shell.scss`, `side-nav.scss`, every `48em` / `75em` media
  query (`rg "48em|75em" frontend/src`), `styles.scss`. Collapsed rail below 1600 (D5). Tests: `shell.spec.ts`,
  `shell-mobile.spec.ts`, `side-nav.spec.ts` at 599 / 600 / 839 / 840 / 1199 / 1200 / 1599 / 1600.
- [x] 230.2 **F** Spec §3.2–3.3: `shared/ui/panes.ts` (`tb-panes`, `tb-pane` fixed / flexible / sheet; own scroll;
  28 dp sheets on `surface container`; margins and spacer by breakpoint) and a list-detail helper (list or detail by
  route below expanded). Specs for widths per breakpoint and focus order. Not used by sections yet, except
  `/teacher/help` as a first consumer if it fits (list of topics + article).
- [x] 230.3 **D** `docs/design-system.md` §4 «Layout and navigation»: breakpoints table, regions, panes; §4 «One
  column» → «One column inside a pane» with the ADR-0021 safeguards (spec §1).

### 231. Rail, top strip, page header (F)

- [ ] 231.1 **F** Spec §3.2: `side-nav.ts` — brand at the top (from the header of `shell.ts`), Настройки and
  Справка at the bottom (from `TEACHER_USER_LINKS` in `teacher-layout.ts` and the user menu); user menu in
  `shell.ts` keeps theme, language, «Мой аккаунт», sign out. Student and admin layouts the same.
- [ ] 231.2 **F** Top strip: bell + avatar only (`shell.ts`, `shell.scss`); `shared/ui/page-header.ts` renders
  inside the first pane; compact top app bar shows the section title and ☰ that opens the modal expanded rail
  (`side-nav.ts` modal mode, scrim, Esc, focus return) with the destinations not in the bar; «Ещё» goes
  (`NAV_ITEMS`, `moreItems` in `shell.ts`).
- [ ] 231.3 **D** design-system §4–5 (rail, top strip, header, ☰), help «Как устроен портал» articles (ru, en),
  wiki pages that show navigation screenshots or words («Ещё»).

### 232. Global «Создать» (F)

- [ ] 232.1 **F** Spec §4 row «Create»: `core/layout/create-menu.ts` — small extended FAB at the top of the
  expanded rail, FAB in the collapsed rail, `shared/ui/fab-menu.ts` popup (≤ 6: Занятие, Задание, Оплата, Ученик,
  Доска, Сообщение; the current section's item first). An item navigates to its section with `?create=<kind>`; the
  section page opens its existing dialog / route and drops the parameter: `schedule-page.ts` (`lesson-dialog`),
  `/teacher/homework/new`, `billing-overview-page.ts` (`payment-dialog`), `students-page.ts`
  (`student-form-dialog`), `boards-page.ts` (`board-dialog`), `notifications-page.ts` (`broadcast-dialog`).
- [ ] 232.2 **F** Remove `features/home/quick-actions.ts` and the header create buttons (`tb-page-fab`) from
  expanded and wider; on compact a section keeps its extended FAB, Today keeps the FAB menu. Tests: one FAB per
  screen at each breakpoint.
- [ ] 232.3 **D** design-system §5 «Main action», help (ru, en), wiki.

### 233. Release 0.21.0 (D)

- [ ] 233.1 **D** Skill `release`; E2E `version-0-21-0.spec.ts`: rail «Создать» → lesson dialog; ☰ on a phone;
  pane layout at 1920 and 390.

## v0.22.0 — Settings and the bell

Integrations leave the sections: Settings become list-detail with eight categories; Calls and AI leave the
navigation; notifications live in the bell's side sheet. ADR: none (0048).

### 234. Settings list-detail (F)

- [ ] 234.1 **F** Spec §10.3: `features/settings/settings-page.ts` → list-detail on `tb-panes`, routes
  `/teacher/settings/:category` (`app.routes.ts`; `?open=` of the fold cards redirects), categories Мой аккаунт
  (`identity/account/account-page.ts`; `/teacher/account` redirects), Портал, Данные. Medium: 50 / 50.
- [ ] 234.2 **F** «Расписание и календарь» (time zone, `schedule/teacher/google-calendar-panel.ts`,
  `schedule/ui/calendar-feed-panel.ts` — removed from `schedule-page.ts`) and «Звонки»
  (`meetings/settings/meetings-settings-panel.ts`). Calls section goes: `meetings/calls/calls-page.ts`, its route →
  redirect to the category, menu item out of `TEACHER_MENU`.
- [ ] 234.3 **F** «Мессенджеры»: `bots-panel.ts`, `channels-panel.ts`, `bot-abilities-panel.ts`,
  `preferences-panel.ts`, `student-messengers-panel.ts` (summary + «Напомнить»), failed deliveries (from
  `settings-page.ts`); badge with the failed count on the category. `notifications-page.ts` keeps only the inbox and
  broadcasts until 235.
- [ ] 234.4 **F** «Оплаты» (`billing/teacher/default-price-card.ts`, removed from `billing-overview-page.ts`) and
  «ИИ-помощник» (`ai/ai-usage-page.ts` → category, `system-prompts-card.ts`; `prompt-library-card.ts` stays
  reachable from the editor's «Промты» menu); `/teacher/ai` redirects, menu item out. Backups: one component for
  the teacher and the admin per D4.
- [ ] 234.5 **D** design-system (settings = list-detail; `tb-fold-card` only where still used), help articles
  (settings, messengers, calendar, calls, AI; ru, en), wiki pages of the same topics (they name the paths).

### 235. Notifications in the bell (F)

- [ ] 235.1 **F** Spec §10.3 «Bell»: `core/notifications/notification-bell.ts` opens a side sheet (pattern of
  `help/help-button.ts`; non-modal third pane on extra-large) with tabs «Входящие» (`notifications/inbox/inbox-panel.ts`)
  and «Отправленные» (`teacher/broadcasts-panel.ts`); compact — full screen. `/teacher/notifications` and
  `/cabinet/notifications` redirect to the home page with the sheet open (check `Portal.link(` targets in the
  backend).
- [ ] 235.2 **F** Remove «Уведомления» from `TEACHER_MENU` and `STUDENT_MENU`, `notifications/home/latest-notifications-widget.ts`
  from both home pages, `notifications-page.ts`; the student's messenger linking and preferences move to the
  student's «Мой аккаунт» (`account-page.ts`, spec §10.4).
- [ ] 235.3 **F** «Создать › Сообщение» opens `broadcast-dialog.ts` directly (replaces the 232.1 route).
- [ ] 235.4 **D** design-system, help (ru, en), wiki (notifications, bots).

### 236. Release 0.22.0 (D)

- [ ] 236.1 **D** Skill `release`; E2E: settings categories, bell sheet, old routes redirect.

## v0.23.0 — Student card

Students become list-detail; the card holds lessons, homework, payments, connection and the profile of one
student or group. ADR: none.

### 237. Student card (B, F)

- [ ] 237.1 **B** Spec §8 «Data»: teacher reads for one student / group — `schedule` lessons by student or group
  over a period (`TeacherScheduleController` `GET /lessons` + `studentId` / `groupId`, group lessons included),
  `homework` tasks of one student (`TeacherHomeworkController`), the messenger status of one student
  (`notifications`, the source of `student-messengers-panel.ts`). Controller tests with roles (student → 403),
  `docs/modules/{schedule,homework,notifications}.md`.
- [ ] 237.2 **F** List pane: `identity/students/students-page.ts` + `groups/groups-panel.ts` → one list on
  `tb-panes`; chips «Все · Группы · Должники · Без мессенджера · Отключённые» (balances from
  `GET /api/teacher/billing/overview`); row supporting line; routes `/teacher/students/:id`, `/teacher/groups/:id`.
- [ ] 237.3 **F** Card header (avatar 72, tags, «Написать» → `broadcast-dialog` for one, «Оплата» →
  `payment-dialog` preset, «Занятие» → `lesson-dialog` preset, «⋮») and the Обзор tab, composed from
  `@features/{schedule,homework,billing,meetings,notifications}/parts`.
- [ ] 237.4 **F** Tabs Занятия, Задания, Оплаты (`billing/ledger/ledger-list.ts`); `billing/teacher/student-ledger-page.ts`
  goes, `/teacher/billing/students/:id` redirects to `/teacher/students/:id?tab=payments`.
- [ ] 237.5 **F** Профиль tab: inline fields of `student-form-dialog.ts` (name, contacts, note, default topic,
  colour, price, `meetings/rooms/room-panel.ts`, invite link); the dialog stays only for creating (name +
  contact), then opens the card.
- [ ] 237.6 **F** Group card (Обзор, Занятия, Задания, Участники, Профиль) from `group-form-dialog.ts`.
- [ ] 237.7 **D** design-system (list-detail, card anatomy), `docs/modules/identity.md`, help (students, groups,
  payments of a student; ru, en), wiki.

### 238. Release 0.23.0 (D)

- [ ] 238.1 **D** Skill `release`; E2E: open a student, edit the profile inline, record a payment from the card.

## v0.24.0 — Today and Schedule

One queue of what waits for the teacher; the schedule's calendar takes the space, the rest goes to a supporting
pane; an agenda on a phone. ADR: none.

### 239. Today (B, F)

- [ ] 239.1 **B** Week figures for spec §6 column 3: lessons and absences of the current week in
  `GET /api/teacher/schedule/summary`, assignments given and handed in on time in `GET /api/teacher/homework/summary`
  (skip fields that already exist). Tests, module docs.
- [ ] 239.2 **F** `features/home/todo-queue.ts` — «Нужно сделать» from `attention-card.ts` +
  `first-run-checklist.ts` (sources in spec §6), actions in place; both old components go.
- [ ] 239.3 **F** `features/home/teacher-home.ts` → feed in three / two / one columns; «Занятия сегодня» list under
  the hero; month (`billing/home/finance-widget.ts`) and week figures; header with the summary line; nav label
  «Сегодня».
- [ ] 239.4 **F** Compact: queue rows with a chevron, bottom sheet for two or more actions (`tbModalDrawer`).
- [ ] 239.5 **D** design-system (Today), help «Первые шаги» (ru, en), wiki.

### 240. Schedule (F)

- [ ] 240.1 **F** Spec §7: `schedule/teacher/schedule-page.ts` → supporting pane (mini-month, requests, tabs
  Регулярные / Нерабочее время, «+ Регулярное занятие»); toolbar with the time-zone chip and filter chips.
- [ ] 240.2 **F** `schedule/ui/schedule-calendar.ts`: unmarked outline (`GET /schedule/unmarked`), requested change
  dashed, off-time hatched; marking from the event's dialog; the «Отметьте прошедшие занятия» card goes.
- [ ] 240.3 **F** Compact agenda: week strip, day list, unmarked group under the row, «⋮» screens Неделя / Месяц /
  Регулярные / Нерабочее время (`schedule-page-mobile.spec.ts`).
- [ ] 240.4 **D** design-system (calendar), help «Расписание» (ru, en), wiki «Расписание».

### 241. Release 0.24.0 (D)

- [ ] 241.1 **D** Skill `release`; E2E: queue marks a lesson; calendar outline disappears.

## v0.25.0 — Homework and Payments

Review in one place with the next work at hand; Payments about the month and the movement of money.
ADR: none.

### 242. Homework (F)

- [ ] 242.1 **F** Spec §9: list pane from `homework/teacher/assignments-page.ts` + `review-queue-page.ts`
  (connected group, drafts under the filter, one filter field); `/teacher/homework/review` redirects.
- [ ] 242.2 **F** Detail: `task-review-page.ts` (work) and `assignment-page.ts` (assignment with students) as
  detail panes; `/teacher/homework/tasks/:taskId` and `/:assignmentId` keep working as deep links.
- [ ] 242.3 **F** Extra-large: review side sheet (AI draft from `ai/homework-ai-panel.ts`, comment, chips,
  decision), «Дальше» opens the next work; collapsed rail on this route.
- [ ] 242.4 **F** Compact: floating toolbar (spec §9), comment in a bottom sheet, bottom bar hidden.
- [ ] 242.5 **D** design-system (three panes, floating toolbar), help (homework review; ru, en), wiki.

### 243. Payments (B, F)

- [ ] 243.1 **B** `GET /api/teacher/billing/operations?month=&kind=&studentId=` (payments, charges, absences of a
  month) and weekly totals in `GET /api/teacher/billing/summary`. Tests, `docs/modules/billing.md`.
- [ ] 243.2 **F** Spec §10.2: `billing/teacher/billing-overview-page.ts` → month header, four figures, journal with
  chips, supporting pane (debtors, advances running out, weekly bars); `monthly-report-page.ts` reachable from
  «Отчёт за месяц»; the balances list goes (Students › «Должники»).
- [ ] 243.3 **F** Compact: strip of figures, chips, journal, extended FAB «Оплата».
- [ ] 243.4 **D** design-system, help «Оплаты» (ru, en), wiki.

### 244. Release 0.25.0 (D)

- [ ] 244.1 **D** Skill `release`; E2E: accept a work and land on the next; journal filters.

## v0.26.0 — Materials, cabinet, admin, search

Boards and textbooks in one feed with previews; the student's five destinations; the admin's five; global
search as an experiment. ADR: **0049** if D3 merges Materials (new navigation of materials).

### 245. Materials (B, F) — experiment D3

- [ ] 245.1 **B** Previews: board — PNG exported by the editor on save (`boards/editor`, Excalidraw
  `exportToBlob`) to `PUT /api/teacher/boards/{id}/preview`, served with the board; textbook — cover from the
  first page on upload (`textbooks`; decide the PDF / Word renderer in the substep). Storage in each module's
  `FileStorage` namespace; tests; module docs.
- [ ] 245.2 **F** Spec §10.1: `features/materials` page (or inside `boards` with `textbooks/parts` — decide by the
  frontend isolation rule) from `boards/teacher/boards-page.ts` + `textbooks/teacher/textbooks-page.ts`; feed,
  connected group, chips, one filter; routes `/teacher/materials`, redirects from `/teacher/boards`,
  `/teacher/textbooks`; `TEACHER_MENU`.
- [ ] 245.3 **F** Student: `boards/student/my-boards-page.ts` + `textbooks/student/my-textbooks-page.ts` → one
  «Материалы» page.
- [ ] 245.4 **D** design-system (feed), help (boards, textbooks; ru, en), wiki.

### 246. Student cabinet (F)

- [ ] 246.1 **F** `core/layout/student-layout.ts`: five destinations (spec §5), bar without «Ещё».
- [ ] 246.2 **F** `features/home/student-home.ts` → two-column feed (spec §10.4); «Оплачено N занятий» from
  `GET /api/me/billing/summary` (balance ÷ price; a backend field if the price is not there).
- [ ] 246.3 **F** `homework/student/my-homework-page.ts` + `my-task-page.ts` → list-detail.
- [ ] 246.4 **D** design-system, cabinet help (ru, en), wiki for students.

### 247. Admin (F)

- [ ] 247.1 **F** Spec §10.5: «Состояние» = `admin/status/status-page.ts` + `admin/diagnostics/diagnostics-page.ts`;
  «Журнал» = `admin/logs/log-page.ts` + `admin/events/events-page.ts` with chips; `admin-layout.ts` menu of five;
  redirects.
- [ ] 247.2 **F** `admin/integrations`, `admin/backups`, `admin/settings` → list-detail like 234.
- [ ] 247.3 **D** design-system, admin help (ru, en), wiki «Администрирование».

### 248. Global search (B?, F) — experiment D6

- [ ] 248.1 **D** Decide the source: frontend over the teacher's loaded lists, or `GET /api/teacher/search?q=`
  over module facades (each module searches its own data). Write the decision into spec §2.
- [ ] 248.2 **F** Search bar in the top strip (`shell.ts`), Ctrl K, results grouped (students, groups,
  assignments, boards, textbooks); compact — the search icon in the top app bar opens a full-screen search.
- [ ] 248.3 **D** design-system, help (ru, en), wiki.

### 249. Release 0.26.0 (D)

- [ ] 249.1 **D** Skill `release`; E2E: materials feed, student bar of five, search. Move `docs/redesign/` to
  `docs/archive/redesign-2026-10/` and fold what is still useful into `docs/design-system.md`.

## Backlog

Colours of students and groups after 0.20.0: rows without an avatar (the student table of the monthly report,
homework and board lists by name) and the options of student / group selects.

Carried over from 0.6.13 (design audit 2026-09-29, `archive/audit/`):
- Shared `tb-steps` and `tb-copy-field` components.
- `cssLayer` instead of `::ng-deep` / `!important`.
- CI check for unused design tokens.
- Remaining layout nits from DA-081 / DA-082.

Audit proposals that change functionality — wait for the teacher's decision (audit §7): confirmation or
"Undo" toast for «Пропуск»; search in long lists; «Следующая работа» in the review queue; times in the
portal time zone; picking a reschedule time from free slots; file check before upload; journal filters in
the URL; prompt on leaving unsaved settings; invitation and first-run fixes; list-detail for the review
queue; filter chips instead of toggles. *List-detail for the review queue, «Следующая работа», filter chips and
search in long lists are planned in the redesign (stages 237, 242, 248).*

Calls after 0.8.0: call history; teacher moderation (mute / remove a participant); chat in the call;
«ученик ждёт» notification (LiveKit webhooks); opening the student's board from the call; Document
Picture-in-Picture; noise suppression; recording.
