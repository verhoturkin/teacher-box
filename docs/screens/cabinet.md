# Student cabinet

Routes under `/cabinet`. Boards: `docs/sketches/homework/` and `docs/sketches/settings/` 7–9, 12.

## Home

`features/home/student-home.ts`: two columns from expanded (1.8fr / 1fr, *ours*), one below in the
same order. Lead: the [hero](today.md#nearest-lesson-hero), due tasks (`tb-my-deadlines-widget`),
recently reviewed, welcome, messenger and push offers. Side: «paid lessons» (`tb-my-balance-widget`:
balance ÷ price, a bar full at 8 lessons — *ours*; a debt or no price shows the balance alone). The
lesson materials are not on the home page: they stay in the lesson and in «Материалы». No FAB.

## Schedule

`schedule/student/my-schedule-page.ts`: the teacher's grid ([schedule](schedule.md)) with a
supporting pane — mini-month, upcoming lessons, requests, history and the calendar subscription;
compact starts with the day agenda, and there the sections have no tonal block of their own: titles
and list items stand on the page — the items are tonal (`surface-container`, not the white
lowest container; the lowest one only on the wide tonal pane), the subscription is the plain
outlined card. The history shows
only the shared summary (no plan, no private note). The «lesson summary»
notification opens `/cabinet/schedule?lesson=<id>`, the lesson's card. The card ends with the
read-only «План урока» of a prepared lesson ([schedule](schedule.md#lesson-plan)): text, textbook
pages to open or download, videos with the player.

## Homework

`MyHomeworkPage` + `MyTaskPage` (`features/homework/student/`): list-detail of one route; compact
and medium are two pages (boards 37 → 25). Only the panes scroll, never the window.

- **List:** returned / to do / handed in, empty groups hidden; a tag only once handed in or
  returned. On one pane a «nearest» card leads (*ours*: the oldest returned task, else the nearest
  deadline).
- **To do** (board 8): the unsent answer is kept on the device. Materials and the test card form a
  right column; on one pane (boards 10, 25) one column with the answer last, docked at the bottom on
  compact.
- **Reviewed is the same task in its state** (boards 24, 27, 38): no right column, no deadline or
  tag, the task folds under the result. Accepted ends with «next task» (first returned, else open).
  Returned prefills the next attempt with the last answer (a device draft wins).
- **Test** (`quiz-section.ts`, `quiz-player.ts`; boards 23, 26; `tb-dialog kind="screen"`): a pane
  inside the frame from medium, full screen on compact. Answers save themselves; finishing asks only
  when questions are skipped. The card stays while an attempt is open or attempts are left; the
  result shows mistakes only, with the key and explanation as the reveal rule allows.

## Payments

`billing/student/my-billing-page.ts`: figures and the ledger; receipts open from their rows. Hidden
by the teacher (452.3): no menu item, no balance on the home page, `/cabinet/billing` leads home.
The same pages serve the parent's [family cabinet](family.md) read-only.

## Account

`/cabinet/account` (`account/account-page.ts` → `AccountPanel` of `identity`): profile, sign-in,
appearance and notifications (`notifications/account/notifications-section.ts`). The teacher's
account category is the same panel.

- **Parents:** a student with parents sees a tile «Родитель: Анна» / «Родители: Анна и Олег» in the
  profile card (`GET /api/me/guardians`, names only; nothing when there are none or the read
  fails). The teacher links parents; the student hides nothing in v1 (ADR-0069).

- **Notifications:** one «where» list of the user's messengers and this device. Without a messenger
  an alert leads to connect; home cards lead here. `link-code-view` opens in a bottom sheet on
  compact, a dialog above.
- **This device** offers «connect» only while the browser is not subscribed (a click: the permission
  prompt needs a gesture), then a switch; an iPhone tab, a blocked site or an unsupported browser
  get a message instead.
- **Layout:** compact — rows where profile and «theme and language» open sub-pages; medium —
  profile, notifications, then sign-in and appearance as a pair.
