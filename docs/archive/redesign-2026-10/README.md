# Redesign 2026-10 — target interface

The spec of the interface redesign that `docs/PLAN.md` releases 0.21.0–0.26.0 (stages 229–249) implement. It
states **where the interface is going**; `docs/design-system.md` stays the source of the **current** rules and is
rewritten stage by stage as each part lands.

- **Mockups and the full analysis** (Russian): [`report.html`](report.html) — open it in a browser; every mockup
  has a «1:1» button. Anchors: `#shell`, `#dupes`, `#nav`, `#today`, `#schedule`, `#students`, `#homework`,
  `#materials`, `#billing`, `#settings`, `#cabinet`, `#admin`, `#spec`, `#roadmap`. Published copy:
  https://claude.ai/artifact/KMiVg3NLggK5A87rggd8sS (private to the owner).
- Mockups are 1920×1080 (extra-large) and 390×844 (compact). Data in them are examples.

## 0. How to use this in a session

1. Take the next unticked substep in `docs/PLAN.md`; it names the section of this file (§N) to read.
2. Read §1 (principles), §2 (decisions), the section the substep names, and the matching part of `report.html`
   (grep the anchor; don't read the whole 170 KB file).
3. Load the `m3-expressive` skill before touching templates or styles (AGENTS.md §6.3). Values marked
   **M3** in §11 come from its references; anything else is marked *our decision* in the design system.
4. Each substep ends as usual: tests, `./scripts/verify.sh`, `docs/design-system.md` / `docs/modules/<m>.md` /
   wiki / help updated **for what the substep changed**, `[x]` in the plan. Don't rewrite design-system
   sections ahead of the code.
5. A substep that finds this spec wrong or incomplete fixes the spec in the same commit and says so in the commit
   message.

## 1. Principles

1. **Panes instead of one column.** From expanded (≥ 840 dp) up, sections use M3 canonical layouts:
   list-detail, supporting pane, feed. Compact and medium keep one pane.
2. **One home per function.** Every function has exactly one place (§4). A second entry point is allowed only as a
   link to that place, never as a second implementation.
3. **Sections are tasks, not modules.** Navigation names what the teacher does (Today, Schedule, Students,
   Homework, Materials, Payments), not backend modules (Calls, Notifications, AI).
4. **Configure once → Settings.** Integrations and defaults live in Settings; a section never shows a
   «not configured» empty page.
5. **One FAB per screen.** The global «Создать» in the rail; on a phone the section's own create action, the
   menu only on Today.
6. **Keep what works:** the nearest-lesson hero (the one hero moment), segmented lists, button weights (one filled
   per screen), snackbar, the help side sheet, spring motion, the student colours (0.20.x).

### Why one column was introduced, and how panes avoid it (ADR-0021)

ADR-0021 removed multi-column layouts because narrow columns broke words mid-word, row buttons jumped between
rows and the order of blocks changed with the width. Panes keep those fixes:

- A pane is never narrower than **360 dp**; below expanded there is one pane. Lists keep the subgrid of
  `tb-list`, so buttons line up within a pane.
- Inside a pane the rules of ADR-0021 stay: cards one under another, ordered by importance, no card grids —
  **except** the feed layouts named in this spec (Today, Materials, the student's home, admin status), where the
  column order is fixed and the reading order is the column order on every width.
- Running text (task statements, answers, help) is limited to 66 ch.

## 2. Decisions and open questions

| # | Question | Default in this spec | Status |
|---|---|---|---|
| D1 | Give up «one column» (ADR-0021) for expanded and wider | Yes, via ADR-0048 | **yes** — teacher, 2026-10-19 (ADR-0048) |
| D2 | Teacher's bottom bar on a phone | Сегодня · Расписание · Задания · Ученики · Оплаты; Материалы in the ☰ modal rail | **default** — teacher, 2026-10-19: Доски leave the bar |
| D3 | Merge Boards and Textbooks into «Материалы» | Yes, experiment in 0.26.0; fallback — one boards list with chips | **experiment** — teacher, 2026-10-19 |
| D4 | Backups in the teacher's Settings when the portal has an administrator | Keep both, one component | **keep both** — teacher, 2026-10-19 |
| D5 | Expanded rail (280) from large (1200) or from extra-large (1600) | From 1600; collapsed rail 96 below | our decision (ADR-0048), revisit at 230 |
| D6 | Global search (Ctrl K) | Experiment, last release | **frontend source** — decided at 248.1 (below) |

**D6 — source of the global search (decided at 248.1): the frontend, no new endpoint.**

- *Data size.* One tutor: tens of students and groups, hundreds of assignments and boards, a few textbooks —
  a few hundred short rows in total, so a substring filter in the browser takes a millisecond.
- *Every list already exists* as a teacher's endpoint (`IdentityApi.listStudents/listGroups`,
  `HomeworkApi.assignments`, `BoardsApi.list`, `TextbooksApi.list`) with the fields the search needs (title, names,
  e-mail/login, students of an assignment, course). No new read path, no change in any module.
- *A backend search would need an aggregator.* `GET /api/teacher/search` has to call five modules; in the
  allowed-dependency table (AGENTS.md §4.2) no module may depend on `homework`, `boards`, `textbooks` and
  `identity` together, and `platform` must not know business modules. It would take a new module or a change of
  the table (an ADR) plus five facade methods, five SQL `LIKE`s and tests — all for data that fits in memory.
- *Latency:* typing never waits for the network — the lists are read once when the search opens and kept for
  60 s (`SEARCH_TTL`), then the next opening reads them again; a failed list shows as «не удалось
  загрузить» for its group only, the others still answer.
- *Roles.* The search is the teacher's only: `TEACHER` gets the bar and Ctrl K. A `STUDENT` has none (each of
  their lists is short and has its own filter, so the top strip of the cabinet shows no search); `ADMIN` has none
  (no student data, ADR-0010; the admin's lists are filtered in place).
- *Contract (`core/search/search.ts`, used by 248.2).* `core/` imports no feature, so the application provides
  `SEARCH_SOURCES` (a lazy factory of `SearchSource { group, load(): Observable<SearchEntry[]> }`, built in
  `app.config.ts` like `NEW_MESSAGE_DIALOG`, from the `parts` of the features). `GlobalSearch` holds the `query`,
  `loading`, `failed` and `results` signals; `refresh()` reads the sources, `invalidate()` forces a new read.
  Matching (`searchEntries`): case-insensitive, «ё» = «е», every word of the query must be found in the title,
  subtitle or hidden keywords; the title start ranks first, then a word start, a substring, other fields; at most 5
  entries per group (the rest as «Ещё N»), groups in the order students, groups, assignments, boards, textbooks.
- *Testability:* the matcher is a pure function and the service takes fake sources — unit tests only, no backend
  or E2E change. If the data ever outgrows the browser, a backend search can replace the sources behind the same
  contract without touching the UI.

Answers recorded at 229.1 (2026-10-19): the teacher took every default, so §3–§10 and stages 230–249 stand
as written.

## 3. Shell (report `#shell`)

### 3.1 Breakpoints

| Window (M3) | Width | Navigation | Panes | «Создать» |
|---|---|---|---|---|
| Compact | < 600 | navigation bar, 5 destinations; ☰ in the top bar opens the modal expanded rail | 1 | section FAB / FAB menu on Today, right above the bar |
| Medium | 600–839 | collapsed rail 96 | 1 (2 × 50 % only for Settings) | FAB at the top of the rail |
| Expanded | 840–1199 | collapsed rail 96 | 2: fixed 360 + flexible | FAB at the top of the rail |
| Large | 1200–1599 | collapsed rail 96 (D5) | 2: fixed 412 + flexible | FAB |
| Extra-large | ≥ 1600 | expanded rail 280; collapsed on nested pages (homework review) | 2–3: 412 + flexible + side sheet ≤ 400 | small extended FAB «Создать» |

Today the portal has 48em and 75em (`core/layout/mobile.ts`, `shell.scss`, `side-nav.scss`); replace them with
600 / 840 / 1200 / 1600 px (37.5em / 52.5em / 75em / 100em) everywhere, CSS and `injectWindowSize`.

### 3.2 Regions

- Background of the window = navigation region = `surface container`; panes = `surface` (**M3** region roles).
- *Our decision:* panes are sheets with 28 dp corners (extra large) on that background; margin 24 dp at the
  trailing edge and bottom, 24 dp between panes (**M3** spacer), 16 dp margins on compact (**M3**).
- **Top strip** (80 px, *ours*) over the panes: global search (from 248; a placeholder is not shown before),
  bell, account avatar. No portal name — it moves to the top of the rail.
- **Rail**: brand (logo + portal name, not a button) · «Создать» · destinations · spacer · Настройки · Справка.
  Active item: indicator hugging icon + label (**M3E** expanded rail), `secondary container`.
- **Page title** lives in the header of the first pane (`tb-page-header` inside the pane), not in a separate
  band. On compact the top app bar shows the section title (today it is hidden on section pages — 0.9.2; this
  reverses it because the bell and ☰ need the bar anyway).
- **User menu**: theme, language, «Мой аккаунт» (→ Settings › Account), sign out. Help and settings leave it.

### 3.3 Panes component

New `shared/ui/panes.ts` (selectors `tb-panes`, `tb-pane`):
- `tb-pane` kinds: `fixed` (360 / 412 by breakpoint), `flexible`, `sheet` (≤ 400, `surface container low`).
- Each pane scrolls on its own (**M3** multiple panes); focus order = visual order.
- List-detail helper: on compact/medium only the list or the detail is shown, driven by the route
  (`/teacher/students` vs `/teacher/students/:id`); from expanded both. Back from the detail on compact = the
  list.
- Motion: pane enter/exit on `--tb-spring-default-spatial`; *ours:* no stagger.

## 4. One home per function (report `#dupes`)

| Function | Today | Target home | Stage |
|---|---|---|---|
| Mark past lessons | home attention card + schedule card | Today › «Нужно сделать»; red outline on the event in the calendar | 239, 240 |
| Create lesson / payment / student / assignment / board / message | home quick actions + each section's header + phone FAB menu | rail «Создать» (FAB menu ≤ 6), section FAB on phone | 232 |
| List of students | Students, Billing balances, Calls rooms, Notifications › students | Students only (balance, room, messenger as row data and chips) | 237, 243 |
| Student's data | edit dialog + `/teacher/billing/students/:id` + other sections | student card (tabs) | 237 |
| Notifications | bell + nav item + home card | bell → side sheet | 235 |
| Messengers | Notifications (3 folds) + Settings › failed deliveries + first-run | Settings › Мессенджеры; status in the student card | 234 |
| Messages to students | Notifications › «Сообщения ученикам» | «Создать» › Сообщение, «Написать» in the student / group card; history in the bell's «Отправленные» | 235, 237 |
| Calendars and calls | Schedule › phone calendar + Settings › calendar & calls + Calls section + room in the student dialog | Settings › «Расписание и календарь», › «Звонки»; room in the student's profile | 234, 237 |
| Price per lesson | Billing card + billing row | Settings › Оплаты (default); student's profile | 234, 237 |
| AI | nav section + editor panel | Settings › ИИ-помощник (usage, system prompts); prompt library in the editor | 234 |
| Review of homework | hidden `/teacher/homework/review` + assignment page + task page | Homework › segment «На проверку», review in the detail pane | 242 |
| Search | separate search in Homework (2 cards), Boards (2 cards), Students | one filter field per list; global search (248) | 237, 242, 245, 248 |
| Help | «?» + user menu + `/help` | «?» opens the sheet; «Справка» at the bottom of the rail | 231 |
| Account | page + user menu | Settings › Мой аккаунт; theme/language stay in the user menu | 231, 234 |
| Backups | teacher Settings › Data + admin Backups | one component for both roles (D4) | 234 |

## 5. Navigation (report `#nav`)

- **Teacher rail:** Сегодня (`today`) · Расписание · Ученики · Задания · Материалы · Оплаты; bottom: Настройки,
  Справка. Removed: Звонки, Доски (→ Материалы), Учебники (→ Материалы), Уведомления, ИИ-помощник.
- **Teacher bar (compact):** see D2.
- **Student:** Главная · Расписание · Задания · Материалы · Оплаты — five, no «Ещё» (ADR-0027 «Ещё» goes).
- **Admin:** Состояние (+ Диагностика) · Журнал (+ События) · Интеграции · Резервные копии · Настройки.
- Old routes redirect (bot messages and e-mails hold absolute links via `Portal.link`): `/teacher/calls`,
  `/teacher/ai`, `/teacher/notifications`, `/teacher/boards`, `/teacher/textbooks`, `/teacher/billing/students/:id`,
  `/teacher/homework/review`, `/teacher/account` and the student's and admin's equivalents. Grep the backend for
  `Portal.link(` before removing a route.

## 6. Today (report `#today`)

**Extra-large / large:** one flexible pane, header = the date + a summary line («4 занятия · 2 работы на
проверку · 1 запрос»). Feed of three columns (1.25 : 1 : 0.8), two on large (third under the second):

1. Hero of the nearest lesson (unchanged component `upcoming-lesson-widget.ts`) + «Занятия сегодня» list
   (time, avatar, name, topic; status tag; the next one selected).
2. **«Нужно сделать»** — one queue, each row with its action in place:
   unmarked lesson (`Проведено | Пропуск` group), work to review (`Проверить`), change request (`Ответить`),
   debt (`Напомнить`), unfinished first-run steps (a dashed card with progress; disappears when done).
   Sources: `GET /api/teacher/schedule/unmarked`, `/schedule/requests`, `/homework/review-queue`,
   `/billing/overview`, the first-run progress already loaded by `teacher-home.ts`.
3. Month (received, plan, debt, advances — `finance-widget.ts`) and week figures (lessons, absences, assignments
   given, handed in on time — needs `schedule` and `homework` summary fields, see stage 239).

Removed: `quick-actions.ts`, `latest-notifications-widget` on the home page, the separate
`first-run-checklist` and `attention-card` (merged into the queue).

**Compact:** hero → queue (rows with a chevron; two or more actions open a bottom sheet) → month figures.
FAB «+» opens the FAB menu «Создать».

## 7. Schedule (report `#schedule`)

**Expanded and wider — supporting pane layout:** calendar = flexible pane; fixed pane (360/412) on the right,
`surface container low`: mini-month, «Запросы» (with «Ответить»), tabs «Регулярные | Нерабочее время» (lists
with «⋮»), «+ Регулярное занятие».
- Toolbar of the calendar pane: period title, time-zone assist chip (only when the device zone ≠ portal zone;
  replaces the text line), «Сегодня», ‹ ›, connected group «Неделя | Месяц | Список».
- Filter chips by student / group under the toolbar (the student colours).
- In the grid: unmarked past lesson — 2 px `error` outline; requested change — dashed `outline`; off-time —
  hatched; days off — hatched column. The «Отметьте прошедшие занятия» card goes.
- «Календарь на телефоне» (`calendar-feed-panel.ts`) moves to Settings (stage 234).

**Compact:** agenda by default: week strip (day chips, dot = has lessons) + lessons of the chosen day; unmarked
lesson shows the `Проведено | Пропуск` group under its row; «⋮» in the top bar: Неделя, Месяц, Регулярные
занятия, Нерабочее время (each its own screen). Extended FAB «Занятие».

## 8. Students (report `#students`)

**List-detail.** Routes `/teacher/students`, `/teacher/students/:id`, `/teacher/groups/:id`.

- **List pane** (fixed): title + «8 учеников · 2 группы»; filter field; chips «Все · Группы · Должники N · Без
  мессенджера N · Отключённые» (replace the «Показывать отключённых» / «Показывать архив» toggles); rows —
  avatar in the student's colour, name, supporting «next lesson · balance»; trail — debt amount in `error`, or
  «Приглашён» tag. Groups are rows of the same list (group icon).
- **Card** (flexible): header — 72 px avatar, name (Headline small), «class · since», tags (messenger, balance);
  actions — tonal «Написать», tonal «Оплата», filled «Занятие», «⋮» (deactivate, invite link, delete).
  Tabs: **Обзор** (next lessons, attendance figures, homework, boards and textbooks, balance with the last
  operations, connection: messenger status and room link), **Занятия** (all lessons, past and future),
  **Задания** (tasks with status), **Оплаты** (the ledger — `billing/ledger/ledger-list.ts`), **Профиль**
  (inline fields of `student-form-dialog.ts`: name, contacts, note, default topic, colour, price, room
  `tb-room-panel`, invite).
- Group card: same header; tabs Обзор, Занятия, Задания, Участники, Профиль (price, colour, room).
- Creating a student stays a short dialog (name + contact) from «Создать», then opens the card.
- **Compact:** list and card are two screens; the bottom bar stays (Ученики active); three tonal action buttons
  full width; scrollable tabs.

Data: the card composes other features through `@features/<m>/parts` (frontend rule §4.2.6). Missing backend
reads (stage 237.1): lessons of one student or group over any period, tasks of one student, the messenger status
of one student. Each is a teacher endpoint of the owning module with a role test («student gets 403»).

## 9. Homework (report `#homework`)

- **List pane:** connected group «На проверку N · Активные N · Готовые»; drafts («Не выдано») under the filter
  button; one filter field; in «На проверку» rows are works (avatar, name, «assignment · handed in N ago»,
  «Просрочено» tag), under them «Ждут сдачи» assignments.
- **Detail:** the work — title, «student · due · on time · attempt», collapsible task statement, the answer
  (66 ch), attachments as thumbnails, «Открыть на доске».
- **Extra-large third pane** (standard side sheet, 400): «Проверка» — AI draft (tertiary tag «Черновик ИИ»,
  «Вставить»), comment field, quick chips, «На доработку» (tonal) / «Принять» (filled); «Дальше: <student>»;
  after a decision the next work of the queue opens. The rail collapses to 96 on this screen.
- Assignment page (`/teacher/homework/:id`) becomes the detail of an assignment row (students and their
  progress); the editor stays a full-screen route.
- `/teacher/homework/review` and `/teacher/homework/tasks/:taskId` redirect into the list-detail.
- **Compact:** the work full screen, bottom bar hidden (nested page with «←»), **floating toolbar** (**M3**,
  64 dp, 16 dp margins): AI, comment (opens a bottom sheet), «На доработку», «Принять».

## 10. Materials, Payments, Settings, Cabinet, Admin

### 10.1 Materials (report `#materials`, experiment D3)
One flexible pane, feed of cards with previews (6 columns extra-large, 4 large, 3 expanded, 2 compact).
Connected group «Доски N · Учебники N»; chips «Все · На портале · Внешние · Ученик или группа», sort; one filter
field. Board card: preview, title, «кому · изменена», «⋮» (Резервные копии, Изменить, Удалить). External board:
service tag («Холст», «Miro»), icon instead of a preview. Textbook card: cover = first page. Previews need the
backend (stage 245.1). Routes `/teacher/materials?tab=boards|textbooks`.

### 10.2 Payments (report `#billing`)
Flexible pane: month title with ‹ ›, «Отчёт за месяц» (tonal, the current `monthly-report-page.ts` as a
dialog or nested route); four figures (Поступило, Начислено, Долг — `error container`, Авансы); «Операции» —
chips «Все · Оплаты · Занятия · Пропуски · Ученик», the journal of the month. Supporting pane: debtors with
«Напомнить», advances running out, weekly bars. Balances list and «Цена для новых учеников» leave the page
(→ Students chips, Settings). Compact: horizontal strip of figures, chips, journal, extended FAB «Оплата».

### 10.3 Settings and the bell (report `#settings`)
List-detail; categories (route `/teacher/settings/:category`): Мой аккаунт (`account-page.ts`), Портал
(`portal-settings-card.ts`), Расписание и календарь (time zone, `google-calendar-panel.ts`,
`calendar-feed-panel.ts`), Звонки (`meetings-settings-panel.ts`), Мессенджеры (`bots-panel.ts`,
`channels-panel.ts`, `bot-abilities-panel.ts`, `preferences-panel.ts`, failed deliveries from `settings-page.ts`,
students without a messenger from `student-messengers-panel.ts` with «Напомнить»), Оплаты
(`default-price-card.ts`), ИИ-помощник (`ai-usage-page.ts` parts, `system-prompts-card.ts`), Данные
(`backups-card.ts`, `drive-panel.ts`, `reset-card.ts`). A category with a problem shows a badge («2»). Medium:
two 50 % panes; compact: list → screen. The `tb-fold-card` layout of Settings goes.
**Bell:** non-modal side sheet 400 (extra-large: the third pane; smaller: modal `tb-side-sheet` as the help);
tabs «Входящие N» (`inbox-panel.ts`) and «Отправленные» (`broadcasts-panel.ts`), «Прочитать все». Compact: full
screen.

### 10.4 Student cabinet (report `#cabinet`)
Five destinations (§5). Home: feed of two columns — hero (Перенести / Не приду; «Войти в урок» from 10 min
before), «Сдать» (tasks due and returned ones), «Проверено недавно»; right: «Оплачено N занятий» (Display small,
balance ÷ price), lesson materials. Homework: list-detail (list, task + answer form). Materials: as §10.1 without
editing. Compact: same order, no FAB.
The student's «Уведомления» page goes with the nav item (stage 235): the inbox moves to the bell sheet, messenger
linking (`channels-panel.ts`) and preferences (`preferences-panel.ts`) to the student's «Мой аккаунт» page
(user menu).

### 10.5 Admin (report `#admin`)
Состояние = feed of tiles (services, disk, event queue, last backup) + «Собрать диагностику» in the header
(`status-page.ts` + `diagnostics-page.ts`). Журнал = list-detail of logs and events with chips «Логи · События ·
Ошибки» (`log-page.ts` + `events-page.ts`). Интеграции, Резервные копии, Настройки — list-detail like the
teacher's Settings.

## 11. Values (report `#spec`)

| Element | Value | Source |
|---|---|---|
| Breakpoints | 600 / 840 / 1200 / 1600 dp | **M3** |
| Panes | ≤ 3; 3rd only a standard side sheet on extra-large | **M3** |
| Margins / spacer | 16 dp compact, 24 dp otherwise / 24 dp | **M3** |
| Fixed pane | 360 dp expanded, 412 dp large and extra-large | **M3** |
| Side sheet | ≤ 400 dp | **M3** |
| Rail | collapsed 96 dp; expanded 220–360 dp (we keep 280); 3–7 destinations; FAB on top, elevation 0 | **M3** |
| Navigation bar | 3–5 destinations; FAB right above it, never over it | **M3** |
| FAB / small extended FAB | 56 dp, 16 dp corners | **M3** |
| FAB menu | 2–6 related items, close button 56 dp | **M3** |
| Toolbar | 64 dp, floating with 16 dp margins; docked never together with a navigation bar | **M3** |
| Corners | 4 · 8 · 12 · 16 · 20 · 28 · 32 · 48 · full; cards 12 | **M3** |
| Type | Display S 36/44 · Headline S 24/32 · Title L 22/28 · Title M 16/24 · Body L 16/24 · Label L 14/20 | **M3** |
| Region colours | navigation `surface container`, body `surface`, same at every width | **M3** |
| Line length | 40–60 characters | **M3** |
| Pane sheets with 28 dp corners on `surface container` | — | *ours* |
| Top strip 80 px with search, bell, avatar | search 56 dp = **M3** docked search bar | *ours* |
| Today queue, student card, Materials, week figures | — | *ours* |
| Teacher's bottom bar contents | D2 | *ours* |
| Pane motion | **M3** default spatial spring; no stagger | *ours* (M3 has no choreography) |
