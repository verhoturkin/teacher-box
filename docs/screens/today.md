# Today (teacher home)

`features/home/teacher-home.ts`: one flexible pane titled with the date (the nav label stays
«Сегодня»); the summary line drops empty parts and hides on compact.

- **Three stacks** in a fixed order that is also the reading order: lead (`today-lessons.ts` and
  the push offer), queue (`todo-queue.ts`), figures (month + `week-figures.ts`, Monday–Sunday).
  From large (sketch «Главная учителя — варианты», board D, 450.2) two panes, the M3
  fixed-and-flexible layout: a flexible lead pane — the lesson hero (`tb-today-lessons
  part="hero"`), then the other rows (`part="rest"`) with the push offer and the queue in two equal
  columns (a column that shows nothing gives its width to the other, 457.1) — and a fixed 412 dp
  figures pane on surface container (28 dp corners, 16 dp padding:
  *ours*, the sketch); 24 dp between them (**M3** spacer). Below large one column in the reading
  order, the expanded row inside the list; an empty stack hides. The sketch's bar chart of the week
  is not built: the summary has week totals only, no days.
- **Queue:** two cards, each with its own count badge (M3 large badge, error): «Отметить занятия»
  (unmarked lessons with «Проведено | Пропуск» in place, then the change requests — schedule work
  too) and «Проверить работы» (the review queue). At most 5 rows per source, then «more N». A card
  with nothing to do hides; when both are empty one compact empty state («Срочных дел нет») stands
  instead (*ours*: not while the first-run steps show). No debt rows: the month card keeps the total
  debt and the debtor count. Compact (*ours*): the same two cards in one column, one line per row;
  one action runs at once, two (an unmarked one-student lesson) open a sheet with both.
- **First-run steps** stand under the two cards until done or hidden: student, messenger, AI (`GET
  /api/teacher/ai/status` → `enabled`), lesson. Finished steps hide; the price belongs to the [setup
  wizard](settings.md#first-run-setup).
- The push offer (`tb-push-onboarding-card`, dismissal kept on the device) ends the lead column, as
  on the student home.

## Lessons today

`home/today-lessons.ts` (sketches `docs/sketches/today/`, 432): no hero card on the teacher's Today
since 0.57.0 — the lesson is shown once.

- Rows in start order, one line each: time, avatar, name and the outcome chip (scheduled lessons
  say nothing). The rows are a segmented list (`tb-list`).
- The current or nearest unfinished lesson is the **expanded row** (primary-container, the
  colour of the old hero and of the portal, *ours* after the user's review in 0.57.0): the
  start, its state from `lesson-clock.ts` («Идёт · ещё 25 мин» with an error-coloured dot;
  «Через 40 мин» within the hour, the duration beyond it; another day — «Завтра» /
  «чт, 16.10»), «до 15:00»; the avatar, name, title and topic; one board chip — the
  board of the student or group changed last (`tb-board-links [latest]`, `updatedAt`); the join
  button (`tb-join-lesson-button`, default size — *M3*: the sketch's 48 px is no M3 button size)
  only when the lesson has `joinUrl`, «Начать урок», «Войти в урок» while it runs. On a phone-wide
  card (≤ 30rem, container query) the button is full width at the end (`tb-join-wide`); wider it
  ends the head line (board 4). When the lesson ends the card asks the home page to reload.
- **«Позвать»** (432.3, boards 1 and 4): while the lesson runs in the portal's own room (its
  `joinUrl` is `/call/…`), `tb-call-summon` (`@features/meetings/parts`) asks
  `GET /api/teacher/meetings/calls` now and every 10 s (450.1); when the presence is known (`OK`, no
  external link) and somebody is not in the room, a Body Small line with `person_off` — «Ира ещё не
  в звонке» (the first word of the name) or «Ещё не в звонке: 2 из 3» for a group — and an
  extra-small text button «Позвать» / «Позвать остальных» (`tb-button-xs`) that sends them a notice;
  snackbar «Ученику отправлено приглашение» / «Приглашение отправлено, учеников: N». Everybody in
  and the teacher not: `video_call` and «Ира ждёт в звонке» / «Все ждут в звонке», no button; the
  teacher in too: no line. On a phone the
  line follows the board chip on its own row, apart from the join button; wider it ends the board's
  row. A Telemost or other external link, calls off or the media server down — no line.
- **The hero** (from large, board D; 457.1 variant C, an **M3** card: content, then actions): one
  primary-container card (28 dp, *ours*: the sketch) in three blocks.
  - Content: the time tile (`schedule/ui/lesson-time-tile.ts`: the day or «Идёт сейчас», the
    start, the countdown or «ещё 25 мин»), the 64 dp avatar, the name in Headline Medium
    emphasized with «Название · тема» and «до 15:00» (Body Medium) under it.
  - While the lesson runs, the wavy progress bar of the elapsed time (`tb-wavy-progress`,
    «Прошло 35 из 60 мин» as its name).
  - The action row: the board chip and the presence line of `tb-call-summon [hero]` (Body
    Medium) at the start; at the end a **standard** button group (12 dp) — while somebody is not
    in the portal's room a medium tonal «Позвать», then «Начать урок» / «Войти в урок» in the
    medium size (`tb-button-m`), the primary action last (**M3**: the trailing edge). Not the
    sketch's connected group: **M3** keeps those for toggles, never with a primary button. The
    row wraps, so on a narrow hero the buttons go down, still at the end; an empty row hides.
  20 dp between the content's parts, 16 dp between the blocks, 12 dp in the action row (*ours*).
  Below large the expanded row above stays as it is.
- A nearest lesson of another day follows today's rows, expanded with its day. No lessons today
  but one later: the same card titled «Ближайшее занятие» with that one row (decision of 432.2:
  no second widget for this case). No lesson at all: no card.

## Nearest lesson hero

`schedule/home/next-lesson-widget.ts` (the student's home): a lesson in `tb-hero`
([design-system §7](../design-system.md)).

- The time tile (`schedule/ui/lesson-time-tile.ts`) uses a display style — *ours*: the portal's one
  hero moment; one line, the tile grows on a narrow card. It counts down within the hour and shows
  the time left while the lesson runs (`lesson-clock.ts`).
- While the lesson runs, the wavy bar of the elapsed time (`tb-wavy-progress`, «Прошло 5 из 60
  мин») spans the bottom of the card, as on the teacher's hero (457.1).
- The lesson title (group name, title or «Занятие») is Headline Small emphasized
  (`.tb-lesson-event__name`) — the teacher's hero name is Headline Medium emphasized; the student's
  card is narrower (457.5).
- One join button (`tb-join-lesson-button [medium]`), full width under the tile on a narrow card
  (`tb-join-wide`). The student's requests sit under it and hide while the lesson runs.
- While the lesson runs in the portal's room, `tb-teacher-waiting` (`@features/meetings/parts`,
  450.1) asks `GET /api/me/meetings/calls` now and every 10 s and, while the teacher is in the room
  of the lesson (the student's own or the group's), shows `video_call` and «Учитель ждёт в звонке»
  under the boards.
- No visible title (a screen-reader `h2`) and no schedule link. When the lesson ends the widget asks
  the home page to reload.
