# Students and groups

`features/students/` (`StudentsPage`, `StudentCard`, `GroupCard`): list-detail of one route,
`/teacher/students[/:studentId]` and `/teacher/groups/:groupId`; «Ученики» stays active on both
(`NavItem.alsoActive`). Tags follow the canvas «Ученики — эскизы» (boards `Main`, `States`,
`PhoneTags`; not copied to `docs/sketches/`) and settings board 16.

## List

- Filter chips all / groups / disconnected (`?filter=`; disconnected = students without access and
  archived groups). From expanded only the list scrolls.
- **Tag filter:** a menu chip shown while a list tag exists (free-text tags filter nothing). A value
  in force is `?tag=<valueId>`, unselects «all», hides the groups (they have no tags) and labels the
  chip «tag: value» (a name over 12 characters cut to its first word). On a phone the chip in force
  leads the row with «×» — *ours*: the row scrolls sideways and a filter in force must not hide.
- **Rows:** students by name, then groups (member count, not names). Balances come from billing,
  messengers from notifications, lessons from schedule; a failed read drops only its part. The trail
  is one status (debt or access / archive tag), absent when empty (`tb-list--own-trail`); no «⋮».
  Tags appear neither in rows nor in the card header.

## Creation and header

- The new-student form starts with the choice student / group and asks only name and contacts; the
  card then opens on the profile tab with the invitation link over it. A new group opens on its
  profile.
- `card-head.ts` (both cards): student actions «Итоги за период» (an icon link `summarize` with
  its name in the tooltip, first, a deactivated student too), message, payment and new lesson
  (`tb-lesson-dialog [studentId]`: who fixed, default title and length); a deactivated student
  keeps only the summary and payment.
  Group actions message (hidden without members), new lesson, archive; an archived group has none. A
  payment or lesson made here re-reads the balance and the lessons.
- **Course** (ADR-0071): the page reads `…/textbooks/courses` and `…/course-links` with the roster
  (a failed read leaves no chip and an empty select). The current course is the first header tag
  of the student and the group (`school` icon, secondary). Profile of both has the card «Курс»
  (`CurrentCourseCard`, `@features/textbooks/parts`) between the data and the price: a select
  («Без курса» first) saved when chosen, a refused choice goes back; disabled for a deactivated
  student and an archived group. The new-group form offers «Курс» while courses exist; a refused
  course leaves the new group without one (a toast), the group is kept.
- The student header tag with the balance (debt / prepaid) is shown only on tabs where the balance
  is not visible otherwise: not on Обзор (the balance card) and not on Оплаты; the roster row keeps
  its sum.
- The «Связь» block of Обзор (`student-channels.ts`): with no messenger connected it is one row
  «Мессенджер не подключён» with the action «Отправить ссылку на подключение» (not three rows
  «Не подключён»); with at least one connected, all three messengers are listed and the button
  stays below.

## Student tabs (`card-tabs.ts`, `CARD_TABS`, `?tab=`)

`/teacher/billing/students/:studentId` redirects to `?tab=payments`.

- **Lessons** (`schedule/teacher/student-lessons-tab.ts`): upcoming (`GET …/upcoming`) shows a
  series as one row with its rule and range, exceptions as rows of their own, and can expand to
  every date of 180 days; history (`GET …/history`, pages of 20) shows the shared summary and the
  old read-only private note. A group lesson shows the student's own attendance.
- **Tags** (`StudentTagsTab`, always present): a list tag saves on choosing, a free-text tag (max
  120) on blur or Enter, blank clears. The whole set goes in one `PUT …/tags`; a failure restores
  the old value. «What the AI will see» lists the AI tags the student has.
- **Profile** (`student-profile-tab.ts`): the price card is the one place to change a student's
  price; the video room saves at once. *Ours* (**M3** has no in-place edit pattern): fields stay
  editable instead of a read view with a pencil.
- **Parents** (`student-guardians-card.ts`, ADR-0069), between the video room and «Вход в
  кабинет»: a segmented list of up to two parents (avatar, name, state — «Приглашение до …»,
  «Входит как …», a reset link), «Новое приглашение» / «Сбросить пароль» and «Отвязать» as icon
  buttons at the end of a row; «Отвязать» asks first (danger confirmation: the last child unlinked
  deactivates the parent). The tonal «Пригласить родителя» (hidden at two parents and for a
  deactivated student) opens a form dialog: segmented buttons «Нового» / «Уже в портале» (only
  when the portal has a parent not linked to this student — a sibling's), a name or a select;
  a new parent gets the link at once in `invite-link-dialog.ts` (`forGuardian`). Under the list,
  while a parent is linked, the settings tile «Оплаты видит только родитель»
  (`billing/teacher/payments-visibility-switch.ts`, `GET/PUT …/billing/students/{id}/visibility`)
  saves at once and reloads when a parent is linked or unlinked.

## Group tabs (`GROUP_TABS`)

The lessons feed without private notes; assignments of every member; members (removal saved at
once); profile without a video room for an archived group.

## Period summary (`student-summary-page.ts`, 465.2)

`/teacher/students/:studentId/summary?from&to` (roadmap 11 «AI», ADR-0072), back to the card.

- **Period**: «С» / «По» date fields in `tb-toolbar`; the last full month without `?from&to`; a
  choice of both days replaces the address. An end before the start or more than 6 months (as
  `ai.period-invalid`: `LocalDate.plusMonths` with the day clamped) shows an error message and
  reads nothing; «Печать» is disabled then. An unknown student — an empty state.
- **Facts**, two columns from a 56 rem pane, one below: `PeriodLessonsCard`
  (`@features/schedule/parts`, `GET …/schedule/students/{id}/report`): figures held and missed,
  a line with excused / cancelled by the student / late cancellations when any, every lesson with
  its outcome tag and «Что прошли»; `PeriodTasksCard` (`@features/homework/parts`, `GET
  …/homework/students/{id}/report`): set, handed in (on time · late), accepted, returned, every
  task (a link) with set / due dates, lateness and grade. Each card has its own load state.
- **Итоги с ИИ** (only when the AI is on; `PeriodSummaryPanel`, `@features/ai/parts`): optional
  wishes (≤ 4000), the student's AI tags as chips, the model pick and «Составить с ИИ» → `POST
  …/ai/period-summary`; errors under the wishes (`ai.period-empty`, `ai.period-invalid`, limits).
  The draft is an editable textarea with «Копировать» (clipboard, a toast); «Составить заново»
  replaces it. Nothing is saved or sent.
- **Print** (design-system §7 «Print»): the header, fields and buttons are `tb-no-print`; the paper
  gets the heading «<имя>: итоги с … по …», both fact cards and the draft rendered as Markdown.
