# Today (teacher home)

`features/home/teacher-home.ts`: one flexible pane titled with the date (the nav label stays
«Сегодня»); the summary line drops empty parts and hides on compact.

- **Three stacks** in a fixed order that is also the reading order: lead (`today-lessons.ts` and
  the push offer), queue (`todo-queue.ts`), figures (month + `week-figures.ts`, Monday–Sunday).
  Extra-large 3 columns (1.25 : 1 : 0.8), large 2 (figures under the queue, lead spans both rows),
  otherwise 1; an empty stack hides.
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
- The current or nearest unfinished lesson is the **expanded row** (secondary-container, the M3
  selected list item): the start, its state from `lesson-clock.ts` («Идёт · ещё 25 мин» with an
  error-coloured dot; «Через 40 мин» within the hour, the duration beyond it; another day —
  «Завтра» / «чт, 16.10»), «до 15:00»; the avatar, name, title and topic; one board chip — the
  board of the student or group changed last (`tb-board-links [latest]`, `updatedAt`); the join
  button (`tb-join-lesson-button`, default size — *M3*: the sketch's 48 px is no M3 button size)
  only when the lesson has `joinUrl`, «Начать урок», «Войти в урок» while it runs. On a phone-wide
  card (≤ 30rem, container query) the button is full width at the end (`tb-join-wide`); wider it
  ends the head line (board 4). When the lesson ends the card asks the home page to reload.
- A nearest lesson of another day follows today's rows, expanded with its day. No lessons today
  but one later: the same card titled «Ближайшее занятие» with that one row (decision of 432.2:
  no second widget for this case). No lesson at all: no card.

## Nearest lesson hero

`schedule/home/next-lesson-widget.ts` (the student's home): a lesson in `tb-hero`
([design-system §7](../design-system.md)).

- The time tile (`schedule/ui/lesson-time-tile.ts`) uses a display style — *ours*: the portal's one
  hero moment; one line, the tile grows on a narrow card. It counts down within the hour and shows
  the time left while the lesson runs (`lesson-clock.ts`).
- One join button (`tb-join-lesson-button [medium]`), full width under the tile on a narrow card
  (`tb-join-wide`). The student's requests sit under it and hide while the lesson runs.
- No visible title (a screen-reader `h2`) and no schedule link. When the lesson ends the widget asks
  the home page to reload.
