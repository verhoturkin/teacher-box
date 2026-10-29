# Screens

How each screen of Teacher Box is composed. The rules every screen follows — tokens, colour,
navigation, panes, buttons, fields, lists, dialogs — are in [`design-system.md`](design-system.md)
(§ numbers below point there); module behaviour is in `docs/modules/<m>.md`. Marks as in the design
system: **M3** — published by Material 3, *ours* — a portal decision. A change to a screen updates
this page in the same commit.

## Frame by role

| Role | Destinations (rail and bottom bar) | Rail bottom group | Notes |
|---|---|---|---|
| Teacher | «Сегодня» (home), «Расписание», «Ученики», «Задания», «Материалы», «Оплаты» | «Настройки», «Справка», «Аккаунт» | bar: Главная · Расписание · Задания · Ученики · Оплаты; «Создать» (§6) |
| Student | «Главная», «Расписание», «Задания», «Материалы», «Оплаты» | «Справка», «Аккаунт» | all five in the bar; inbox in the bell; «Аккаунт» → `/cabinet/account` |
| Admin | «Состояние», «Журнал», «Интеграции», «Копии», «Настройки» | «Справка», «Аккаунт» | all five in the bar; «Аккаунт» → `/admin/account` |

- Bar order: `TEACHER_BOTTOM_NAV` / `STUDENT_BOTTOM_NAV` / `ADMIN_BOTTOM_NAV`, filled up from the
  menu. The student's «Задания» carries the **M3** large badge with the open tasks (`OpenTasks`,
  re-read after each navigation; by the label in the expanded rail, on the icon elsewhere; a
  screen-reader line «Заданий к сдаче: N»).
- Installed app: the service worker caches only the shell; without a network the app opens the
  frameless page `/offline` «Нет связи» (empty state + «Повторить»), data is never cached.
- «Аккаунт» (avatar + name, last in the bottom group and in the ☰ drawer) replaces the avatar
  menu of the top bar, which keeps only the bell (and the teacher's search). The teacher's leads
  to `/teacher/settings/account`.
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
  the tab's content — the only part that scrolls (*ours*); the sheet has no side padding, the tabs
  and the scrolled content carry the 24 dp (16 on compact) gutter, so the scrollbar sits at the
  sheet's edge. The two tabs are `tb-tabs--fixed`: equal width, centred labels on every width.
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
- Beside it who, the title and the topic (each when set), the boards as assist chips (`tb-board-links [chips]` /
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
  the toolbar: «Сегодня» is the M3 outlined button, the arrows are standard icon buttons (40 dp, no
  container), the period is Headline Small (a phone keeps Title Medium), the views stay a connected
  button group,
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

- **Header:** the headline is the lesson title, or who (student or group name) when it has none; trailing ✎ (planned lessons only) and
  «⋮». One status tag at the top of the body when the lesson is not planned.
- **Body** — one `tb-list`, a fact per row with an icon: `schedule` date · time (second line
  «перенесено с …»); `topic` the topic, when set; `videocam` the room with tonal «Начать урок» (the student «Войти в
  урок»); `dashboard` board chips; `event_busy` the cancel reason.
- **«Итог»** (`fact_check`, a past one-student lesson, teacher): the toggle «Проведено | Пропуск» —
  **M3** connected group, single-select, selection optional: nothing selected until marked; a press
  saves at once (the toggle is disabled while saving); a press on the selected one clears the mark;
  an error is a snackbar and the choice returns; a mark is told by the snackbar
  «Отмечено: пропуск · Отменить» (6 s, no confirmation) — «Отменить» puts the previous state back.
  *Ours:* the width of a list row, icons `check` and
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
- **Summary** (teacher, `schedule/teacher/lesson-summary-section.ts` inside
  `lesson-details-dialog.ts`, 0.41.0): under the facts, only for a lesson that has started and is
  not cancelled (an individual lesson marked «Пропуск» has none; a future lesson has none), the
  fields in place — no dialog of its own. «Что прошли» — four lines of Markdown, prefilled with the
  lesson topic while no summary is saved, hint «Видно ученикам этого занятия.»; when the AI feature
  is on, a text button «Черновик» in the field header opens a small panel with «Коротко своими
  словами» and «Составить»: the draft comes from the topic, the words and the titles of the
  assignments created that day for the lesson's students (assignments are not bound to lessons —
  *ours*) and replaces the prefilled topic or follows the text already there. «Тема следующего
  занятия» — two lines, the hint that it goes to the next lesson's empty topic. Below, end-aligned:
  tonal «Сохранить» (enabled when something differs from the saved summary) and filled «Отправить
  ученику» / «Отправить ученикам» (a group; disabled while «Что прошли» is empty) — saves, then
  sends; the snackbar «Итоги сохранены» / «Итоги отправлены» follows and the card stays open.
  Private notes are no longer written; the old ones are read in the student's «История». *Ours:*
  the layout, the 16 px gap above the section and the texts.
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
  ones; the total hidden on compact), the search, filter chips «Все · Группы · Отключённые»
  («Отключённые» — students without access and archived groups; the chip is kept in the address as
  `?filter=`; an old `?filter=debtors|noMessenger` opens «Все»). The debt stays in the row
  trail. From
  expanded the header, search and chips stay and only the list scrolls. Students by name, then
  groups (group icon in the lead). A row (`tb-list--clamp`): avatar / icon; the name links to the
  card; supporting «nearest lesson · аванс N» (a group: «N участников» — the count, not the names,
  «Пока никого» without members — · nearest lesson; «нет занятий» without lessons in 4
  weeks; balances from billing, messengers from notifications, lessons from schedule — a failed read
  drops only its part); trail — one status: the debt in error (Title Medium, read «Долг N») or the
  tag «Приглашён» / «Отключён» / «В архиве», as wide as its own row and absent when empty
  (`tb-list--own-trail`); no «⋮» in the row. The open card's row is current.
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
  filled «Занятие» (`tb-lesson-dialog [studentId]`: who fixed, default title and length); a
  deactivated student keeps only «Оплата»; on compact all three tonal, equal width. Group actions:
  tonal «Написать» (`[toGroup]`, hidden without members), filled «Занятие» (`[groupId]`), «⋮» «В
  архив…» / «Вернуть из архива»; an archived group has neither action.
- **Student tabs** (`card-tabs.ts`, `?tab=`): «Обзор» — «Ближайшие занятия» (3 of 60 days, M3 two-line
  items: «Сегодня, 15:00–16:00» / title · topic, the nearest lead in primary container; «Ещё
  запланировано: N»), «Задания» (open ones, works to review first; 5 + «Ещё открытых: N»), «Баланс»
  (figure, price, last 3 operations), «Связь» (`tb-student-channels`, `tb-room-link`); «Занятия» —
  «Предстоящие» (`GET …/upcoming`: a series is one row «Каждый вт и чт, 15:00 · 60 мин» over
  «title · с 3 ноября · до 25 декабря · ещё 12», one-off lessons and exceptions — «Перенесено на …»,
  cancelled (inactive, tag), «изменено отдельно» — their own rows, the nearest lead in primary
  container; the text button «Показать все даты» / «Свернуть даты» swaps in every date of 180 days)
  and the feed «История» of held lessons
  (`GET …/history`, 20 per page, «Показать ещё»): date, topic, the outcome tag (a group lesson shows
  the student's own attendance), «Что прошли» (Markdown), «Что дальше» and the old read-only
  «Заметка для себя» (written before 0.41.0) when filled; «Задания» — all, open first, then accepted
  with the grade (20 + «Показать ещё»); «Оплаты» — four tonal tiles (balance, charged, paid, price)
  and the ledger «История» (`tb-ledger-list`); «Профиль» — «Данные ученика» (name *, e-mail, phone,
  note, default topic, colour; tonal «Сохранить», enabled when something differs, and «Отмена» shown
  only then), «Цена занятия» (`tb-student-price-card`, the one place to change it), «Видеовстреча»
  (`tb-room-panel`, saved at once), «Вход в кабинет» (login, link validity, «Новое приглашение» /
  «Сбросить пароль», disable / reactivate access). *Ours* (**M3** has no in-place edit pattern):
  fields stay editable instead of a read view with a pencil. A payment or lesson from the header
  re-reads the balance and the lessons.
- **Group tabs** (`GROUP_TABS`): «Обзор» (lessons, «Связь»), «Занятия» (the same feed without
  private notes), «Задания» (every member's,
  name first), «Участники» (members with links, status, «Убрать из группы: имя» saved at once; a
  multiselect of other students and tonal «Добавить»), «Профиль» (name *, default topic, colour;
  «Цена занятия»; «Видеовстреча», not for an archived group).
- `/teacher/billing/students/:id` redirects to `/teacher/students/:id?tab=payments`.

## Homework (teacher)

One route (`/teacher/homework[/tasks/:taskId | /:assignmentId]`, `features/homework/teacher/`)
with three screens: the list on the full width of the window, the assignment and the work, each a
page of its own with «back» (`tb-page-header [back]`) to the list — no list pane beside a detail
(339.1). The «?» help button is in the list header and the editor only.

- **Header**: «Задания», «?», the filled «Новое задание» (a phone: the extended FAB «Новое»).
- **View switch** (339.2): the connected group «Списком · По ученикам» (`view_list` / `grid_view`) in
  the header actions before the main button; kept in the address as `?view=journal`. «По ученикам»
  (`journal-view.ts`) replaces the search, the filter group and the review strip with: `‹ 27 октября
  — 2 ноября ›` (icon buttons «Предыдущая неделя» / «Следующая неделя»), the same «Кому» select
  (a phone: the chip with a menu), a legend, and the grid — the first column the students (avatar
  and name on `surface container`, sticky), a column per assignment due in the week (the title is
  a link; «до пт 04.09»), a cell per student as a 48 dp button with an icon and a label coloured
  by the role (success / warning / error containers; `surface container` for «ждём»; a dashed
  outline for «не выдано»), and «3 из 4 сдано» last. A cell: «проверить» → the work and its review
  sheet; «не выдано» → «Выдать ещё» with the student chosen; the rest → the assignment. The grid
  scrolls sideways with the student column fixed.
- **Review strip** «Ждут проверки · N» (shown while a work waits; follows the search and «Кому»):
  up to three cards on `surface container` (avatar, student, «сдано сегодня, 09:12» / «вчера, …» /
  «dd.MM HH:mm», the «С опозданием» tag when handed in after the due date, the assignment title, the
  «Тест 8 из 10» tag when the assignment has a quiz, tonal «Проверить» → the work and its review
  sheet), then a dashed card «Ещё N работ ждут сдачи», and the text button «Проверить все подряд →»
  (opens the oldest work; a decision opens the next one). On a phone the cards (15 rem) scroll
  sideways.
- **Toolbar** (`tb-toolbar`): `tb-search-field` (title and student, kept in the address as `?q=`),
  the «Кому» select (groups, then students; «Все» clears it; `?who=student:<id>|group:<id>`) and the
  connected group «Активные · Черновики · Готовые» with counts. A phone: `tb-filter-chips` instead
  of the group, the select stays under the search.
- **Table** (`p-table` `tb-cards`; from medium): «Активные» grouped by the due date —
  «Просрочено · N» (error colour), «На этой неделе» (up to the next Monday), «Позже»,
  «Без срока» — the heading is a label above its rows; «Черновики» and «Готовые» are one run (20
  rows and «Показать ещё» for the finished ones, 333.1). Columns: «Задание» (icon, a board icon when
  on a board; title link; material
  icons with counts — textbooks, files, questions, videos, a board without a number), «Кому»
  (person / group icon, two names, from three — the first one and «и ещё N»), «Срок» (dd.MM HH:mm,
  the year only when it is not the current one; the error colour when overdue and not handed in),
  «Сдали» (a two-part bar — accepted, waiting for review — and «3 из 4» handed in), the status tag
  (`assignmentProgress`: «Не выдано» secondary, «На проверке: N» warn, «Принято» success, «Выдано» /
  «Принято N из M» primary) and «⋮» («Создать копию» — a draft «<title> (копия)» with the text,
  files, textbooks and videos, whose editor opens; 0.36.0). A phone: the same rows are a segmented
  list (`tb-list`) under the group labels — title, «кому · до …», the bar, the tag and «⋮». The
  header of the open assignment has the same «⋮» after «Изменить» and «Удалить…».
- **Assignment / work page**: blocks on the pane under uppercase labels; the students of an
  assignment (avatar, name link, «Сдано … / Не сдано», status; «Добавить» opens «Выдать ещё
  ученикам»); files as rows (type icon, name button that downloads or opens a PDF / a picture in a
  tab, size, red «×»).
- **Review side sheet** (`review-sheet.ts`, extra-large, standard side sheet ≤ 400 dp): the AI draft
  with the tertiary tag «Черновик ИИ» and «Вставить», the comment, quick phrases as chips, «На
  доработку» tonal + «Принять» filled, «Дальше: <student>». The rail collapses to 96 dp here
  (`RailState`) and the work page keeps the pane beside the sheet. Below extra-large the review form
  is under the answer.
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

**Questions** (0.39.0): a «Вопросы» card under the videos (`question-section.ts`): a question is a card
(type, text, type fields, points, explanation) with up/down/delete; «Добавить вопрос» picks the type; a total
«Вопросов: N, баллов: M»; «Как проходит тест» — when to show the key and the attempts. Accepted answers of a short
answer are rows with «Добавить ответ»; server errors show in one message above the questions. After a student starts
the quiz the card is read-only with a note. The AI pane has a «Что готовить» switch: «Задание» or «Вопросы» (the draft
cards with the key, «Добавить в конец» / «Заменить все»).

**Quiz review:** the review page shows «Тест: N из M» under the answer — the best attempt's questions, wrong first,
with the student's answer, the key and «Засчитать» / «Не засчитывать»; the grade field is filled with «N из M» until
the teacher types one. The assignment page lists «Ошибки по вопросам» («4 из 6»).

## Payments (teacher)

`features/billing/teacher/billing-overview-page.ts`: a flexible pane and from medium a supporting
pane «По ученикам».

- **Header:** the month with ‹ › and tonal «Отчёт за месяц» (`monthly-report-page.ts`, nested route:
  one flexible pane, persistent title, back and month picker, tonal figures, labelled report
  tables); the report's toolbar has tonal «Скачать CSV» (download icon) next to the month picker —
  the whole journal of the report's month, no chip or student (`operations.csv`, saved by
  `FileSaver`). The payments header has no «⋮».
- **Figures** `tb-ops-figures`: four tonal tiles — «Поступило», «Начислено за занятия», «Долг»
  (error container), «Авансы», each with a note («11 оплат»).
- **«Операции»:** the filter group «Все · Оплаты · Занятия · Пропуски» and the «Ученик» select; the
  journal is a `tb-list` — kind icon, student avatar, «Занятие · Анна Смирнова» + «date, time ·
  status», the amount (`+` payment `tb-positive`, `−` charge, `0 ₽` absence without charge); the
  name links to the card's «Оплаты». The month, figures and filters stay above the scroll. The
  month, the kind and the student are kept in the address (`?month=&kind=&student=`, written with
  `replaceUrl`): «Назад» from a card and a reload bring the same journal back.
- **Supporting pane** (on compact the «Должники» block moves into the main pane under the figures,
  hidden when nobody owes): «Должники» (debt in `tb-negative`, tonal «Напомнить»), «Авансы
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
портале · Внешние»; textbooks «Все · Учебники · Рабочие тетради · Другое») and the sort menu
(«Сначала изменённые / По названию / Сначала новые»), then
the `tb-material-grid` of `tb-material-card`s (§10).

- «Создать» leads to `?tab=…&create=board|textbook`; old `?student=` / `?group=` are ignored;
  `/teacher/boards` and `/teacher/textbooks` redirect to the tabs.
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
of sections (from expanded `/teacher/settings` shows «Мой аккаунт»). A form changed and not saved
asks «Отменить изменения?» before another category or page opens (design-system «Dialogs»).

- Categories: «Мой аккаунт» (`account`: account, «Оформление» with theme and language, «Выйти»; also
  the rail's «Аккаунт»), «Портал» (`portal`),
  «Расписание и календарь» (`calendar`:
  time zone, Google Calendar, calendar feed), «Звонки» (`calls`), «Уведомления и мессенджеры»
  (`messengers`, icon `notifications`: failed deliveries first with a count badge on the item, then
  «Уведомления на устройствах» (web push of this device), bots, own messengers, bot abilities,
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
- **Schedule:** week / month calendar, as the teacher's filling the free height of the pane
  (`fillHeight`, see «Schedule (teacher)»), and a supporting pane (mini-month, upcoming lessons,
  requests); compact starts with the day agenda. Upcoming rows on a phone: icon, time and details, a
  chevron that opens the lesson card; «Войти в урок» above the request pair.
  **«История занятий»** — the last section of the supporting pane, before the calendar feed: a
  `tb-list` of held lessons, newest first (icon, date, group · topic, and «Что прошли» — the shared
  summary as Markdown, when there is one; no plan or private note), «Показать ещё» for the next 20.
  The lesson card of a lesson that has started shows the same «Что прошли» under its facts; the
  notification «Итоги урока» links to `/cabinet/schedule?lesson=<id>` and opens that card.
- **Homework** (`my-homework-page.ts` + `my-task-page.ts`): list-detail of one route; the list pane
  — the connected group «Сдать · На проверке · Готовые» with counts (the first non-empty chosen),
  the search, rows (icon, title link, «до …» red when overdue, status tag); the detail — the task
  with the teacher's feedback and the answer form. A task with questions has a «Тест» section above the
  answer form (`quiz-section.ts`): «Начать тест», on wide all questions as cards, on compact one per screen with
  «Назад / Далее / Проверить и сдать»; matching is a select per left part, ordering has up/down buttons; answers
  save themselves; «Сдать тест» asks first. After a submit: «Лучший результат: N из M», attempts left, «Пройти
  ещё раз», and the key with the explanations when the rule allows.
- **Payments:** tonal balance / charged / paid / price figures and the journal with filter chips,
  receipts in their rows.
- **«Мой аккаунт»** (`/cabinet/account`, from «Аккаунт» in the rail / ☰): account,
  «Оформление» (theme, language), «Мессенджеры», «Уведомления на устройствах»
  (web push, ADR-0051), «Что присылать в мессенджеры и на устройства», «Выйти» last, in one
  stack; the «connect» card and reminder lead here.
- **Notifications on devices** (`tb-push-devices-card`, student «Мой аккаунт» and teacher account
  category): «Включить уведомления на этом устройстве» only while this browser is not subscribed
  (a click, the permission prompt needs a gesture), the list of the user's devices (browser · system,
  «это устройство», date, «уведомления не доходят») with «Отключить»; a message instead of the
  button for an iPhone tab («Добавьте на экран Домой»), a blocked site or an unsupported browser.
  The home pages (teacher and student) offer the same in `tb-push-onboarding-card` («Включить» /
  «Не сейчас», remembered on the device) at the end of the lead column.

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
  redirects. «Мой аккаунт» (`/admin/account`, from the rail's «Аккаунт») has the account,
  «Оформление» and «Выйти». «Копии» is the teacher's backups section in a pane (rows: database
  icon, date + «kind · size», «⋮» «Восстановить…», «Скачать», «Удалить…»).

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
