# Screens

How each screen of Teacher Box is composed. The rules every screen follows — tokens, colour,
navigation, panes, buttons, fields, lists, dialogs — are in [`design-system.md`](design-system.md)
(§ numbers below point there); module behaviour is in `docs/modules/<m>.md`. Marks as in the design
system: **M3** — published by Material 3, *ours* — a portal decision. A change to a screen updates
this page in the same commit.

## Frame by role

| Role | Destinations (rail and bottom bar) | Rail bottom group | Notes |
|---|---|---|---|
| Teacher | «Сегодня» (home), «Расписание», «Ученики», «Задания», «Материалы», «Оплаты» | «Настройки», «Справка» | bar: Главная · Расписание · Задания · Ученики · Оплаты; «Создать» (§6) |
| Student | «Главная», «Расписание», «Задания», «Материалы», «Оплаты» | «Справка» | all five in the bar; inbox in the bell; account in «Мой аккаунт» |
| Admin | «Состояние», «Журнал», «Интеграции», «Копии», «Настройки» | «Справка» | all five in the bar |

- Bar order: `TEACHER_BOTTOM_NAV` / `STUDENT_BOTTOM_NAV` / `ADMIN_BOTTOM_NAV`, filled up from the
  menu. The student's «Задания» carries the **M3** large badge with the open tasks (`OpenTasks`,
  re-read after each navigation; by the label in the expanded rail, on the icon elsewhere; a
  screen-reader line «Заданий к сдаче: N»).
- There is no Notifications, Calls or AI section (ADR-0048): the inbox is the bell's sheet,
  integrations are teacher Settings.

## Notifications (the bell)

- The bell (`core/notifications`) opens and closes `tb-notifications-sheet` (`aria-expanded`); its
  badge (`p-overlaybadge`, danger) is the unread count, hidden at zero.
- Extra-large: the **non-modal** standard side sheet, the third pane (25 rem, surface, 28 dp
  corners, 24 dp margins, starting below the top strip — *ours*); it takes focus on open, «×» or Esc
  closes it and gives focus back; it stays open across pages. Below: the modal `tb-side-sheet
  tb-side-sheet--narrow` (400 dp; on compact full width, 28 dp top corners, 8 px top inset, 16 dp
  margins, no shadow, transparent scrim — *ours*), closed by a notification that leads elsewhere.
- Anatomy: header (headline «Уведомления», «Прочитать все» `done_all`, «×»), the teacher's tabs
  «Входящие N» (badge ≤ 4 characters, **M3**) and «Отправленные» (the student has the inbox only),
  the tab's content — the only part that scrolls (*ours*).
- «Входящие»: unread items (`tb-list--no-lead`, titles emphasized, no dots; a tick on a computer; a
  swipe on a phone marks read, no tick there), «Показать ещё», then the folded «Прочитанные».
  «Отправленные»: a line of explanation with «Написать ученикам» (opens the new-message dialog) and
  the sent messages (title, text, time · recipients).
- Addresses: `?notifications=inbox|sent` opens the sheet on any page and is dropped (`replaceUrl`);
  `/teacher/notifications` → `/teacher?notifications=inbox`, `/cabinet/notifications` →
  `/cabinet?notifications=inbox`. The frame gets the content through `NOTIFICATIONS_SHEET_CONTENT`
  (`app.config.ts`), so `core/` imports no feature.

## Today (teacher home)

`features/home/teacher-home.ts`: one flexible pane; the title is the date («Понедельник, 19
октября»; the nav label is «Сегодня»); the header's muted summary line (lessons today · works to
review · requests; empty parts left out; hidden on compact). A feed of three stacks with a fixed
order that is also the reading order: lead (hero + «Занятия сегодня»), queue («Нужно сделать»),
figures (the month block + «Неделя»). Columns: extra-large 3 (1.25 : 1 : 0.8), large 2 (figures
under the queue, the lead spans both rows), otherwise 1; an empty stack is hidden.

- **«Нужно сделать»** (`todo-queue.ts`) — one `tb-list` with an error badge with the count (**M3**
  large badge); rows from four sources, at most 5 each, then «Ещё N»: unmarked lessons («Проведено»
  / «Пропуск» as a standard group, «Отметить» for a group), student requests («Ответить»), works to
  review («Проверить»), debts («Открыть»). A row: a 40 px tonal icon circle (a debt — error
  container), what is to do, «who · detail», the action tonal. The first-run steps («С чего
  начать», progress, «Скрыть») close the list until done or hidden; nothing to do — a compact empty
  state. Compact (*ours*): a row is one line with a chevron; one action runs it, two (an unmarked
  lesson) open a `tb-dialog kind="sheet"` with both.
- **«Занятия сегодня»**: time (Label Large, tabular figures), who, status tag; the nearest
  unfinished lesson is the selected row.
- **Figures**: the month block titled with the month («Поступило», «Долг»); «Неделя» — a 2 × 2 grid
  (held lessons, absences, homework given, handed in on time) for Monday–Sunday.

### Nearest lesson hero

`schedule/home/upcoming-lesson-widget.ts` (teacher), `next-lesson-widget.ts` (student): a calendar
event in `tb-hero`.

- The time tile `tb-lesson-time-tile` on the left (primary fill): the day («Сегодня» / «Завтра» /
  «чт, 16.10», Label Large), the start in Display Small emphasized (*ours*: the portal's one hero
  moment; tabular figures, one line, the tile grows on a narrow card), the length; within an hour
  «через N мин», while it runs «Идёт сейчас» and «ещё N мин» (`lesson-clock.ts`).
- Beside it who and the topic, the boards as assist chips (`tb-board-links [chips]` /
  `tb-my-board-links`, `tb-board-chip` in the text colour at 12 %).
- One filled size-M button «Начать урок» / «Войти в урок» (`tb-join-lesson-button [medium]`, a split
  button too; on a narrow card under the tile, full width — `tb-join-wide`). The student's request
  buttons «Перенести» / «Отменить» (standard group, 40 px) are under it across the event and hidden
  while the lesson runs.
- No visible title (`h2.tb-sr-only` «Следующее занятие»); no «Расписание» link. When the lesson ends
  the widget asks the home page to reload.

## Schedule (teacher)

`features/schedule/teacher/schedule-page.ts`: the calendar is the main pane (FullCalendar, week /
month; toolbar with owner filter chips in one row — those that do not fit are in the «Ещё N»
menu — and the time-zone chip «Часовой пояс портала»); the
supporting pane holds the mini-month (`ui/mini-month.ts`, **M3** docked date picker: weeks from
Monday, a dot under a day with lessons, the shown day filled; *ours:* no input, a click only moves
the calendar), «Запросы учеников» and «Нерабочее время» (rows with «⋮»: «Изменить», «Удалить…»).

- **Calendar grid in the manner of Google Calendar** (*ours*, M3 has no calendar grid; classes are
  set through the `*Class` options of `ui/schedule-calendar.ts`, styles `tb-cal-*` in `styles.scss`):
  the grid fills the free height of the pane (`fillHeight` of `ui/schedule-calendar.ts`: the half-hour
  rows of the week and the weeks of the month are stretched, never below their height by content —
  on a low screen the pane scrolls as before; a phone is unchanged),
  the grid (not the toolbar) in a card with 16 dp corners and an outline-variant frame
  (`viewClass`), pale grid lines (outline-variant at 55 %), a time column without a border and with label-small
  hours, a header of the weekday over a large day number (today's in `primary`, no circle: the days
  are not buttons), lessons as 8 dp cards with a 1 px gap of the card colour, a month with `primary`
  bold number of today, pills and a `primary` «ещё N» link, an `error` now line with a dot.
- **Lesson states in the grid** (`styles.scss`): planned — filled (the student's label container on
  the teacher's calendar), held — success-container, missed — error-container, cancelled —
  surface-container-highest, on-surface-variant, struck through; a held / missed / cancelled lesson
  of a coloured student keeps its status container plus a 4 px stripe of the colour at its start;
  **unmarked** past lesson — a 2 px solid error outline (`tb-lesson--unmarked`); **requested
  change** — a 2 px dashed outline (`tb-lesson--request`); busy / off time — outline /
  outline-variant, hatched; overlapping or touching periods are one block (one hatching, the captions
  of both).
- **Drag to move:** the dropped lesson waits with a 2 px primary outline and, over an 88 %
  surface-container-lowest veil, a standard group of **M3E** extra-small icon buttons (32 dp, 20 dp
  icon, 18 dp apart, 8 dp pressed corners): ✓ «Перенести» filled and wide (40 dp), ✕ «Отменить
  перенос» tonal; on a card narrower than 6 rem both are 32 dp and 4 px apart; the dragged card lies
  above its neighbours; the move is saved only on ✓.
- **Lesson form** (`lesson-dialog.ts`, `form`): repeat Once / every 1–4 weeks, optional end date,
  Only this / This and following; bulk actions show affected and protected occurrences first
  (completed, charged and individually changed lessons are kept).
- **Compact** (`ui/schedule-agenda.ts`): the screens «Повестка» / «Неделя» / «Месяц» (a connected
  group; «⋮» leads to «Нерабочее время», a screen with a back arrow); the agenda is a week strip
  (seven days, ‹ ›, today and the chosen day marked) over the day's list; a row is one line (time,
  who, status tag); unmarked lessons get «Проведено» / «Пропуск» (standard group, tonal, with icons)
  under the row; the jump chip «Не отмечено занятий: N» leads to them. Week and month recreate the
  calendar to apply the view; filter chips wrap; support sections are contained with 16 dp corners.

### Lesson card

One content component in `schedule/ui` for teacher and student in a `tb-dialog kind="sheet"` (§11).

- **Header:** the headline is who (student or group name); trailing ✎ (planned lessons only) and
  «⋮». One status tag at the top of the body when the lesson is not planned.
- **Body** — one `tb-list`, a fact per row with an icon: `schedule` date · time (second line
  «перенесено с …»); `topic`; `videocam` the room with tonal «Начать урок» (the student «Войти в
  урок»); `dashboard` board chips; `event_busy` the cancel reason.
- **«Итог»** (`fact_check`, a past one-student lesson, teacher): the toggle «Проведено | Пропуск» —
  **M3** connected group, single-select, selection optional: nothing selected until marked; a press
  saves at once (the toggle is disabled while saving); a press on the selected one clears the mark;
  an error is a snackbar and the choice returns. *Ours:* the width of a list row, icons `check` and
  `person_remove`.
- **Group lesson:** the subtitle «Участники» (Title Medium) and a `tb-list` of avatar, name and
  attendance tag. A student's request is a tertiary-container row (**M3**: tertiary for small items
  needing attention) with «Ответить».
- **Footer**, one state — one action: not started or one student past — none (Esc, scrim, «✕» from
  medium); group past — «Отметить посещаемость»; cancelled — «Восстановить» (an overlap is
  `confirm.safe`).
- **«⋮»:** «Отменить занятие…» opens its own `form` (reason, «по инициативе ученика», «списать
  оплату», for a series the single choice «Только это / Это и следующие» with the count);
  «Удалить…» — `confirm.danger` for one lesson, for a series an `alert` with the same scope list
  and count; the card closes before either opens. «Снять отметку» only for group lessons.
- **Student:** the same facts and their own actions («Войти в урок», «Перенести | Отменить» as a
  standard group), without ✎, «⋮» and marks.

### Requests

`request-answer-dialog.ts` (`form`): the connected toggle «Согласовать | Отклонить» (default
«Согласовать») and one confirm button whose label and colour follow it; the new time and «Засчитать
как пропуск» only when agreeing; «move anyway» is `confirm.safe`. The student's
`change-request-dialog.ts` (`form`) never disables its confirm button: a hint says what is missing.

## Students and groups

List-detail of one route (`/teacher/students[/:studentId]`, `/teacher/groups/:groupId`; «Ученики» is
active on both, `NavItem.alsoActive`).

- **List** — one `tb-list` in the fixed pane: header «Ученики» + «N учеников · M групп» (current
  ones; the total hidden on compact), the search, filter chips «Все · Группы · Должники N · Без
  мессенджера N · Отключённые» («Отключённые» — students without access and archived groups). From
  expanded the header, search and chips stay and only the list scrolls. Students by name, then
  groups (group icon in the lead). A row: avatar / icon; the name links to the card; supporting
  «nearest lesson · аванс N» (a group: members · nearest lesson; «нет занятий» without lessons in 4
  weeks; balances from billing, messengers from notifications, lessons from schedule — a failed read
  drops only its part); trail — one status: the debt in error (Title Medium, read «Долг N») or the
  tag «Приглашён» / «Отключён» / «В архиве»; no «⋮» in the row. The open card's row is current.
  Nothing open — «Выберите ученика или группу».
- **Creation:** «Новый ученик» (`form`) starts with the connected choice «Ученик · Группа» (the
  group choice opens the group form) and asks only the name and contacts; after it the card opens on
  «Профиль» with the invitation link over it. «Новая группа» asks the name and the students
  («Создать»); the card opens on «Профиль».
- **Card header** (`tb-card-head`, shared by both cards): a 72 px avatar or group tile in the colour
  (secondary-container without one, *ours*); the name (h2, Headline Small; on one pane the page
  header carries it); «с сентября 2025» (Body Medium, on-surface-variant); tags — status (not for an
  active student), messengers or «Без мессенджера» (warn), «Аванс N» (success) / «Долг N» (danger).
  Student actions: tonal «Написать» (`tb-broadcast-dialog [to]`) and «Оплата» (`tb-payment-dialog`),
  filled «Занятие» (`tb-lesson-dialog [studentId]`: who fixed, default topic and length); a
  deactivated student keeps only «Оплата»; on compact all three tonal, equal width. Group actions:
  tonal «Написать» (`[toGroup]`, hidden without members), filled «Занятие» (`[groupId]`), «⋮» «В
  архив…» / «Вернуть из архива»; an archived group has neither action.
- **Student tabs** (`card-tabs.ts`, `?tab=`): «Обзор» — «Ближайшие занятия» (3 of 60 days, «Ещё
  запланировано: N»), «Задания» (open ones, works to review first; 5 + «Ещё открытых: N»), «Баланс»
  (figure, price, last 3 operations), «Связь» (`tb-student-channels`, `tb-room-link`); «Занятия» —
  «Предстоящие» and «Прошедшие» (half a year each way, «Показать ранее»; a group lesson shows the
  student's own attendance; cancelled rows inactive); «Задания» — all, open first, then accepted
  with the grade (20 + «Показать ещё»); «Оплаты» — four tonal tiles (balance, charged, paid, price)
  and the ledger «История» (`tb-ledger-list`); «Профиль» — «Данные ученика» (name *, e-mail, phone,
  note, default topic, colour; tonal «Сохранить», enabled when something differs, and «Отмена» shown
  only then), «Цена занятия» (`tb-student-price-card`, the one place to change it), «Видеовстреча»
  (`tb-room-panel`, saved at once), «Вход в кабинет» (login, link validity, «Новое приглашение» /
  «Сбросить пароль», disable / reactivate access). *Ours* (**M3** has no in-place edit pattern):
  fields stay editable instead of a read view with a pencil. A payment or lesson from the header
  re-reads the balance and the lessons.
- **Group tabs** (`GROUP_TABS`): «Обзор» (lessons, «Связь»), «Занятия», «Задания» (every member's,
  name first), «Участники» (members with links, status, «Убрать из группы: имя» saved at once; a
  multiselect of other students and tonal «Добавить»), «Профиль» (name *, default topic, colour;
  «Цена занятия»; «Видеовстреча», not for an archived group).
- `/teacher/billing/students/:id` redirects to `/teacher/students/:id?tab=payments`.

## Homework (teacher)

Three panes of one route (`/teacher/homework[/tasks/:taskId | /:assignmentId]`,
`features/homework/teacher/`):

- **List** (fixed pane): the connected group «На проверку · Активные · Готовые» with counts, the
  search always above the list; tonal rows — a work: avatar, student, «задание · сдано …», the
  «Просрочено» tag; «Ждут сдачи» under them; an assignment row: icon (a board icon when on a board),
  title link + «кому · до dd.MM.yyyy HH:mm» (three names, then «и ещё N»), the progress tag
  (`assignmentProgress`: «Не выдано» secondary, «На проверке: N» warn, «Принято» success, «Выдано» /
  «Принято N из M» primary) and «⋮» («Открыть», «Изменить», «Проверить работы», «Открыть доску»,
  «Удалить…»).
- **Detail** (flexible pane): the work or the assignment, blocks on the pane under uppercase labels;
  the students of an assignment (avatar, name link, «Сдано … / Не сдано», status; «Добавить» opens
  «Выдать ещё ученикам»); files as rows (type icon, name button that downloads or opens a PDF / a
  picture in a tab, size, red «×»).
- **Review side sheet** (`review-sheet.ts`, extra-large, standard side sheet ≤ 400 dp): the AI draft
  with the tertiary tag «Черновик ИИ» and «Вставить», the comment, quick phrases as chips, «На
  доработку» tonal + «Принять» filled, «Дальше: <student>». The rail collapses to 96 dp here
  (`RailState`). Medium and compact: list or detail with a back arrow; the review form under the
  answer on medium.
- **Floating toolbar** (compact, **M3** floating toolbar, sizes *ours*): a surface-container-high
  pill, 64 dp, 16 dp from the edges (plus safe area), elevation 2, with the AI button, the comment
  button, «На доработку» and «Принять»; the comment, draft, phrases and grade live in a bottom sheet
  from the comment button; the bottom bar is hidden on this screen (`RailState.bottomBarHidden`).
- **AI requests** («Последние запросы»): rows with the feature icon, feature + status tag,
  «dd.MM.yyyy HH:mm · model · N с» with the error under it, tokens as the amount; 10, then «Показать
  ещё».

### Assignment editor

A main flexible pane (title, recipients and deadline, Markdown Text / Preview, textbooks and files,
videos) and a supporting sheet with the AI request (prompt library, search and save, sources,
generate / error / retry, draft Remove / Insert / Replace). From **M3:** the supporting-pane
canonical layout. *Ours:* the AI pane shares the width equally with the editor from expanded and is
a modal right drawer below; main content precedes AI in reading order; one Markdown field at every
width; the header keeps «Выдать / Сохранить» (filled) and «… и разместить на доске» (tonal); the AI
never changes text without Insert / Replace; its state survives closing the pane; leaving with
changes asks first.

## Payments (teacher)

`features/billing/teacher/billing-overview-page.ts`: a flexible pane and from medium a supporting
pane «По ученикам».

- **Header:** the month with ‹ › and tonal «Отчёт за месяц» (`monthly-report-page.ts`, nested route:
  one flexible pane, persistent title, back and month picker, tonal figures, labelled report
  tables).
- **Figures** `tb-ops-figures`: four tonal tiles — «Поступило», «Начислено за занятия», «Долг»
  (error container), «Авансы», each with a note («11 оплат»).
- **«Операции»:** the filter group «Все · Оплаты · Занятия · Пропуски» and the «Ученик» select; the
  journal is a `tb-list` — kind icon, student avatar, «Занятие · Анна Смирнова» + «date, time ·
  status», the amount (`+` payment `tb-positive`, `−` charge, `0 ₽` absence without charge); the
  name links to the card's «Оплаты». The month, figures and filters stay above the scroll.
- **Supporting pane:** «Должники» (debt in `tb-negative`, tonal «Напомнить»), «Авансы
  заканчиваются» (≤ 2 lessons left, *ours*; 5 rows), «По неделям» (bars, today's week lighter),
  «Все в Учениках».
- **Compact:** month, arrows and the report link in the page (no overflow menu), figures in a
  two-column grid, chips wrap, supporting pane and student filter hidden, the FAB records payments.
- **Ledger of a student** (`tb-ledger-list`): icon, operation + status tag, «date · topic or
  comment», the amount and «×» for the teacher; 20, then «Показать ещё».

## Materials

`/teacher/materials?tab=boards|textbooks` (`features/materials`): one flexible pane, no card around
it — the title, the connected group «Доски N · Учебники N» (under the title on compact), a wrapping
toolbar of `tb-search-field` (364 px on a computer, full width on compact), filter chips («Все · На
портале · Внешние · Ученик или группа»; textbooks «Все · Учебники · Рабочие тетради · Другое ·
Ученик или группа») and the sort menu («Сначала изменённые / По названию / Сначала новые»), then
the `tb-material-grid` of `tb-material-card`s (§10).

- «Ученик или группа» shows a member select kept in `?student=` / `?group=`; «Создать» leads to
  `?tab=…&create=board|textbook`; `/teacher/boards` and `/teacher/textbooks` redirect to the tabs.
- *Isolation (AGENTS.md §4.2.6):* `features/materials` only composes `BoardsFeed`
  (`@features/boards/parts`) and `TextbooksFeed` (`@features/textbooks/parts`); each owns its API,
  cards, «⋮» and dialogs and takes search, filter, sort and member as inputs. Both stay mounted (the
  inactive one `hidden`) so both counts are known.
- Card «⋮»: boards «Резервные копии», «Изменить», «Удалить…»; textbooks their own.
- **Student** (`/cabinet/materials`, `MyMaterialsPage`): the same feed without actions
  (`MyBoardsFeed` / `MyTextbooksFeed`, no «⋮», no member select, no create), chips «Все · На
  портале · Внешние» / by kind; `/cabinet/boards`, `/cabinet/textbooks` redirect.

## Settings (teacher)

`/teacher/settings[/:category]` (`features/settings/settings-categories.ts`), list-detail with
`medium="two"`: the categories as a list of tonal two-line rows (40 px tonal icon circle, name,
«what it holds»; the chosen one secondary-container with an emphasized name and the icon circle on
the surface; group outer corners 16 px) in the fixed pane, the chosen category beside it as a stack
of sections (from expanded `/teacher/settings` shows «Мой аккаунт»).

- Categories: «Мой аккаунт» (`account`), «Портал» (`portal`), «Расписание и календарь» (`calendar`:
  time zone, Google Calendar, calendar feed), «Звонки» (`calls`), «Мессенджеры» (`messengers`:
  failed deliveries first with a count badge on the item, then bots, own messengers, bot abilities,
  students' messengers, what to send), «Оплаты» (`payments`: default price), «ИИ-помощник» (`ai`:
  model, usage, prompt library, system prompts), «Данные» (`data`).
- Old addresses redirect: `?open=<fold>`, `?google=` (→ calendar), `?drive=` (→ data),
  `/teacher/account`, `/teacher/calls`, `/teacher/ai`, the messenger tabs of «Уведомления».
- **«Портал»:** three tonal sections — Identity (name, logo), Appearance (base and custom colour,
  nine schemes with samples, contrast), Preview; from a 48 em container Identity and Appearance
  stack on the left and Preview spans both rows on the right (*ours*). The preview follows the
  draft; an explicit save applies it. Help opens `teacher/appearance`.

## Student cabinet

- **Home** (`student-home.ts`): a feed in `tb-panes`, header «Привет, <имя>» with «Следующее занятие
  … · Заданий к сдаче: N» (hidden on compact). From expanded two columns (1.8fr / 1fr, *ours*),
  below one column in the same order. Lead: the hero, «Сдать» (`tb-my-deadlines-widget`: open tasks,
  nearest first, «Открыть» or tonal «Исправить» for a returned one), «Проверено недавно» (last 3),
  the welcome and «connect messenger» cards. Side: «Оплачено N занятий» (`tb-my-balance-widget`:
  Display Small balance ÷ price, the balance, a 4 dp bar full at 8 lessons — *ours*; a debt or no
  price — the balance alone) and the lesson materials (one board and one textbook card in 12–15 rem
  columns, hidden when none). No FAB.
- **Schedule:** week / month calendar and a supporting pane (mini-month, upcoming lessons,
  requests); compact starts with the day agenda. Upcoming rows on a phone: icon, time and details, a
  chevron that opens the lesson card; «Войти в урок» above the request pair.
- **Homework** (`my-homework-page.ts` + `my-task-page.ts`): list-detail of one route; the list pane
  — the connected group «Сдать · На проверке · Готовые» with counts (the first non-empty chosen),
  the search, rows (icon, title link, «до …» red when overdue, status tag); the detail — the task
  with the teacher's feedback and the answer form.
- **Payments:** tonal balance / charged / paid / price figures and the journal with filter chips,
  receipts in their rows.
- **«Мой аккаунт»** (`/cabinet/account`): account, «Мессенджеры», «Что присылать в мессенджеры» in
  one stack; the «connect» card and reminder lead here.

## Admin

- Shell (`admin-layout.ts`, `ADMIN_MENU`): `/admin` → «Состояние»; `/admin/events` → the journal's
  «События» (`?view=events`); `/admin/diagnostics` → «Состояние».
- **«Состояние»** (`status-page.ts`): a feed of tiles in a fixed order — services, event queue,
  diagnostics | system, resources, last backup, portal address; two columns from expanded. Header
  «Версия … · работает …» and the action «Собрать диагностику». The queue tile counts pending
  events and failed deliveries and links «Разобрать в журнале».
- **«Журнал»** (`journal-page.ts`): filter chips «Логи · События · Ошибки» (`?view=`), «Ещё
  фильтры» for period and level; «Логи» and «Ошибки» are list-detail (message, request code, stack
  trace; with nothing open the temporary log levels; «К списку» on compact); «События» is a wide
  page with resubmit of stuck events.
- **«Интеграции»** and **«Настройки»** (`/admin/integrations[/:section]`,
  `/admin/settings[/:section]`): list-detail with `tb-pane-nav` (two-line items, a tonal icon
  circle, a badge with unsaved changes); headings and «Сохранить и перезапустить» in the persistent
  pane heading; settings grouped by catalog sections and saved together; `?open=<section>`
  redirects. «Копии» is the teacher's backups section in a pane (rows: database icon, date + «kind ·
  size», «⋮» «Восстановить…», «Скачать», «Удалить…»).

## Call window

ADR-0030; styles in «Built-in calls» of `styles.scss`.

- **Where:** `CallHost` in the root component above the routes, so a call goes on across layouts and
  the board editor; one call per tab (`CallSession`).
- **Pre-join** (`tb-dialog kind="form"`): the camera preview (16:9, `--tb-shape-lg`; initials while
  the camera is off), microphone and camera toggles under it, device fields only when there are
  several; «Отмена», «Войти». Notes when the current call will end.
- **Full window** — fixed over the page (`role="dialog"`, title focused, Esc minimizes),
  surface-container; header: title (Title Large emphasized), time and people (Body Medium,
  on-surface-variant). Stage (`call-layout.ts`): alone — own tile centred with «Пока в комнате
  только вы»; two — the other on the stage, own tile floating in a corner (`call-self.ts`, elevation
  2; dragged or moved with arrows, remembered); three and more — a square grid (`gridSize`, at most
  two columns on a phone); a shared screen — on the stage with everyone in a strip.
- **Tiles** — `--tb-shape-xl`, surface-container-highest; own camera mirrored, screens not; a 3 px
  primary outline on the speaker; the name in an inverse-surface pill (Label Medium) with a crossed
  microphone and a weak-connection icon; initials in a primary-container circle.
- **Toolbar** — the **M3E** floating toolbar: a surface-container-high pill, elevation 2; buttons 56
  px (48 on a phone, 44 in the mini window), round; a switched-off microphone or camera turns
  error-container with `mic_off` / `videocam_off`, and it and an active screen share become a
  rounded square (**M3E** selected icon button: 56 px CornerLarge 16 px; 48 and 44 px CornerMedium
  12 px — *ours* for sizes M3 lacks) on `--tb-spring-fast-spatial`; pressed 12 / 8 px;
  `aria-pressed` on every toggle. «Выйти из звонка» — a wider red button with `call_end`. No
  tooltips (they cover the video). The settings menu (gear) lies above the window: «Микрофон»,
  «Камера», «Обработка звука» (three switches), «Связь» → «Сведения о связи» — a `tb-dialog
  kind="alert"` of «label — value» lists (Title Medium headings, values right-aligned, tabular
  figures), refreshed every 2 s. No screen sharing on phones.
- **Mini window** — on a computer 20 rem, surface-container-high, `--tb-shape-xl`, elevation 3, in a
  corner (dragged by its top line and snapped, or «Переместить окно звонка»; remembered); shows a
  shared screen, the speaker or a camera; compact toolbar. On a phone a full-width pill above the
  bottom bar; the FAB moves above it.
- **States** — «Подключение…» (the loading indicator, `role="status"`), «Связь прервалась,
  переподключаемся…» (warning container), the end with its reason (`role="alert"`), «Закрыть» and
  «Войти снова»; blocked sound — an info message with «Включить звук». Joins and leaves in a polite
  live region.
