# Today (teacher home)

`features/home/teacher-home.ts`: one flexible pane titled with the date (the nav label stays
«Сегодня»); the summary line drops empty parts and hides on compact.

- **Three stacks** in a fixed order that is also the reading order: lead (hero +
  `today-lessons.ts`), queue (`todo-queue.ts`), figures (month + `week-figures.ts`, Monday–Sunday).
  Extra-large 3 columns (1.25 : 1 : 0.8), large 2 (figures under the queue, lead spans both rows),
  otherwise 1; an empty stack hides.
- **Queue:** four sources — unmarked lessons, requests, works to review, debts — at most 5 rows
  each, then «more N». Compact (*ours*): one line per row; one action runs at once, two (an unmarked
  one-student lesson) open a sheet with both.
- **First-run steps** replace the queue until done or hidden: student, messenger, AI (`GET
  /api/teacher/ai/status` → `enabled`), lesson. Finished steps hide; the price belongs to the [setup
  wizard](settings.md#first-run-setup).
- Today's lessons select the nearest unfinished one. The push offer (`tb-push-onboarding-card`,
  dismissal kept on the device) ends the lead column, as on the student home.

## Nearest lesson hero

`schedule/home/upcoming-lesson-widget.ts` (teacher), `next-lesson-widget.ts` (student): a lesson in
`tb-hero` ([design-system §7](../design-system.md)).

- The time tile (`schedule/ui/lesson-time-tile.ts`) uses a display style — *ours*: the portal's one
  hero moment; one line, the tile grows on a narrow card. It counts down within the hour and shows
  the time left while the lesson runs (`lesson-clock.ts`).
- One join button (`tb-join-lesson-button [medium]`), full width under the tile on a narrow card
  (`tb-join-wide`). The student's requests sit under it and hide while the lesson runs.
- No visible title (a screen-reader `h2`) and no schedule link. When the lesson ends the widget asks
  the home page to reload.
