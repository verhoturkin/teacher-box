# schedule

Lessons with optional weekly repetition (student or group), attendance, student reschedule/cancel requests, reminders,
calendar feeds (ICS), Google Calendar sync, teacher off-time. Depends on: `shared`, `identity::api`,
`meetings::api` (room links), `textbooks::api` (lesson plans), `homework::api` (lesson homework;
roadmap 11). Schema `schedule`.
ADRs: [0008](../adr/0008-schedule.md),
[0011](../adr/0011-groups-and-group-lessons.md), [0012](../adr/0012-meetings-and-boards.md),
[0053](../adr/0053-lesson-title-and-topic.md).

**Outline** — read only the section you need (`grep -n '^##'`, then Read with offset/limit):

- **Rules** — time, lessons, repetition, attendance, requests, reminders, calendars; start here.
- **Contract (`schedule::api`)** — facade and events for other modules (billing, notifications).
- **Data** — tables of the `schedule` schema.
- **REST and bot** — endpoints with roles and messenger bot actions.
- **Frontend** — schedule screens and components.
- **Unified repetition contract (ADR-0049)** — Once / weekly repetition, occurrence and scope rules;
  read when touching recurring lessons.

## Rules

- **Time:** a lesson stores its start as `Instant`; its repeat rule stores weekday, local time and dates in
  the instance time zone (DST does not shift lessons; `InstanceTimeZone`, read per call — the
  teacher changes it in the portal, ADR-0056). The UI gets the zone from
  `GET /api/me/schedule/settings`.
- **Repetition:** Once or every 1–4 weeks, configured in the lesson form, with optional inclusive end date.
  `OccurrenceGeneration` extends the rolling horizon (the teacher's lesson rules, 12 weeks by
  default) nightly; a shorter horizon removes no lessons, a longer one fills series up on the next
  run.
  Only-this edits preserve the immutable original occurrence date and mark an exception. This-and-following
  uses that original date as its boundary, ends the old rule and replaces untouched future occurrences.
  Completed, charged, cancelled, individually edited and prepared (with a plan, 461.2, or
  homework, 462.1) lessons remain. Once keeps the selected lesson and stops later repetition.
  Tombstones prevent deleted occurrences from regenerating. Unique
  `(series_id, series_date)` remains an internal occurrence key; `repeat_rules` is generation metadata.
- **Title and topic** (0.41.0, ADR-0053): `title` (≤ 500) names the lesson and repeats with
  its rule; `topic` (≤ 500) is what this lesson covers — only on `lessons`, never copied by a
  series or a this-and-following edit (only the selected lesson gets it). An empty title is not
  stored: calendars, ICS, Google, the bot and notifications show the student's or the group's
  name instead. ICS / Google put the title into the event name and «Тема: …» into the
  description.
- **Overlaps:** one teacher → any overlap is a conflict `409 schedule.overlap`; the UI asks and retries with
  `allowOverlap`.
- **Participants** (`lesson_participants`): one for an individual lesson; a group series uses the current
  members; `GroupChanged` updates only future planned lessons; `GroupArchived` stops series and cancels future
  lessons.
- **Outcome:** after the start the teacher marks «Проведено» / «Пропуск»; for a group — per participant
  (attended, missed — paid, excused — not paid). Each mark publishes `LessonCompleted` with a `completionId`;
  correcting it publishes `LessonCompletionRevoked`. Lesson statuses: scheduled, conducted, missed, cancelled;
  a not-held lesson can be deleted or restored.
- **Student requests:** move (with proposed time) or cancel; the teacher approves or declines in one dialog:
  a connected toggle «Согласовать | Отклонить» (default approve) and one confirm button that follows it (primary / red); the new time of a move and
  «Засчитать как пропуск» show only for an approval, a busy time asks «Всё равно перенести». Cancelling later
  than the late cancellation window (lesson rules, 24 h by default) is marked late — the teacher
  decides if it counts as missed.
- **Free times:** the move dialogs (student's request, teacher's answer, teacher's edit of a lesson) show
  the free windows of the chosen day, e.g. «9:00–11:30» (`tb-free-times`: consecutive starts of
  `GET /api/me|teacher/schedule/free-times` collapsed, the end = last start + lesson length); a
  window fills in its start, the date picker stays the main control, and a teacher's typed time that
  fits no window gets the hint «Это время занято».
- **Working hours** (405.3): one range of every day in the teacher's zone (lesson rules
  `workStart` / `workEnd`, `HH:mm`, default 08:00–21:00, the end after the start). Free times start
  at `workStart` and the whole lesson ends by `workEnd` (`TeacherAvailability.freeTimes` adds the time
  after the end as busy for `SlotFinder`); the time grid of `ui/schedule-calendar.ts` shows them,
  rounded out to whole hours and widened to lessons outside them. A manual time outside them stays
  possible; per-weekday windows are roadmap/08.
  In a group lesson an early «Не приду» is accepted at once (excused); a move moves it for everyone. A teacher
  edit of a lesson with an open request makes it `OUTDATED`.
- **Requests from a parent** (ADR-0069, 454.2): a guardian asks on a child's behalf, by the same
  `ChangeRequestService.request` and rules — the request is the child's (`student_id`), its sender
  is `requested_by` (V8; the student for older rows). `RequestView` adds `guardianId` /
  `guardianName` (`null` when the student asked); `LessonChangeRequested.guardianId` makes the
  teacher's notice say «Запрос от родителя (Анна).», the teacher's bot list «— запрос от родителя
  (Анна)». The answer (`LessonChangeResolved`) is one notice to the child; `notifications` copies it
  to the guardians (category lessons), so the asking parent gets it once.
- **Availability:** the student sees the teacher's busy time without names (lessons, Google busy, off-time)
  and cannot ask to move onto it; the teacher may override. Off-time (`off_times`): one-off ranges or weekly
  windows, periods computed on the fly.
- **Reminders:** every 5 min `LessonReminders` publishes `LessonStartingSoon` for the reminder
  intervals of the lesson rules (24 h and 1 h by default), only the nearest if several are due;
  reset on reschedule.
- **Lesson rules** (ADR-0056, `LessonRulesService`, read per call): default duration, late
  cancellation, reminders, horizon, working hours. `GET/PUT /api/teacher/schedule/settings`
  (`defaultDurationMinutes` 15–480, `lateCancellationMinutes` 0 – 7 d, `reminderMinutes` ≤ 3 of
  15 min – 7 d, `horizonWeeks` 4–26, `workStart` before `workEnd`; otherwise 422
  `schedule.settings-*-invalid`). Values imported
  from the old variables keep the old limits until the teacher changes them.
- **ICS feed:** `/api/public/schedule/<token>.ics` (256-bit token, hash stored, shown once): the teacher's feed
  has all lessons with names, a student's — own lessons (incl. group ones, group name instead of
  names), a guardian's (ADR-0069, 452.1) — every lesson of their current children once, titled
  «Маша — Занятие» («Маша, Петя — Занятие группы «Б1»» when siblings share it; calendar «Занятия
  детей — …»); a guardian without current children (all deactivated) gets 404, like a deactivated
  student.
  Written in the language of the feed's owner (0.11.1, ADR-0036: `CalendarTexts`); Google events — in the
  teacher's language when a lesson is synced (events already in Google change with the lesson).
- **Google Calendar:** OAuth web flow with the teacher's own client (env vars win over UI), scope
  `calendar.app.created` (+ optional `calendar.freebusy`), own «Teacher Box» calendar, one-way sync every minute
  (`GoogleSyncJob`), network calls outside transactions; `invalid_grant` → `GoogleCalendarDisconnected`.
  The code exchange, token refresh, revoke and Google error mapping are `shared.http.GoogleOAuth` (shared
  with `platform` backups); `GoogleApi` keeps the Calendar calls and its own exceptions.
  Redirect via `Portal.link`. Proxy `TEACHERBOX_SCHEDULE_GOOGLE_PROXY` (administrator setting, live:
  read per request).
  The OAuth client id and secret are the teacher's (Settings → Lessons), imported once from the old
  variables.
- `joinUrl` of a lesson = its own link or the link of the student's/group's room from `MeetingRooms` (an external
  link or the portal link of the built-in call, ADR-0030).

## Contract (`schedule::api`)

Events: `LessonScheduled`, `LessonRepeatScheduled`, `LessonRepeatStopped`, `LessonRescheduled`, `ScheduledLessonCancelled`,
`LessonRestored`, `LessonDeleted`, `LessonStartingSoon`, `LessonChangeRequested`, `LessonChangeResolved`,
`LessonCompleted`, `LessonCompletionRevoked`, `LessonSummaryShared`, `GoogleCalendarDisconnected`; enums `CancelledBy`, `ChangeKind`.
Lesson events carry `groupId` and participants; `LessonScheduled`, `LessonStartingSoon` and
`LessonCompleted` carry `title` (`null` = default), the first two also `topic`.
Consumers: `billing` (completion); the schedule itself (`notices/`, below).
Repeat events aggregate notifications; generation itself does not notify per occurrence. The
deprecated `SeriesScheduled`/`SeriesStopped` records stay only so that the event registry can read
publications written before 0.29.0; nothing listens to them since ADR-0061.

**Notices (`notices/`, ADR-0061, 380.2):** the schedule writes its own notifications.
`ScheduleNotices` listens to the module's events synchronously (`@EventListener`, in the
transaction that published them) and publishes `shared.notice.NoticeRequested` for each recipient:
the texts in every language (`ScheduleNoticeTexts`, formats `ScheduleNoticeFormats`), a kind of
`ScheduleNoticeKind`, the link (`/cabinet/schedule`, `/teacher/schedule`, a shared summary and a
student's reminder — `/cabinet/schedule?lesson=<id>`, a lost calendar —
`/teacher/settings?open=calendar`), the bot subject of an unanswered request
(`LessonChangeRequested.CHAT_SUBJECT`) and the room of a reminder (`joinUrl`: the «Подключиться»
button in messengers; the text has no address — 429.1).
`notifications` picks the recipient's language and delivers. The texts are compared with what
`notifications` wrote before (`notices/schedule.txt`, `ScheduleNoticesGoldenTest`).

## Data

`repeat_rules`, `repeat_exceptions`, `lessons`, `lesson_participants`, `lesson_assignments`,
`change_requests`, `lesson_notes`, `reminders_sent`, `feeds`,
`off_times`, `google_connection`, `google_events`, `google_oauth_states`, `settings` (one row,
ADR-0056: default duration in minutes, late cancellation, reminders, horizon — ISO-8601, empty =
default; filled once from `.env` by `ScheduleSettingsImport`, read by `LessonRulesService`).

Lesson summary (0.37.0): `lessons.summary` (4000, Markdown, shown to the participants), `next_plan` (1000) and
`summary_updated_at`; `lesson_notes (lesson_id, student_id, note, updated_at)` — the teacher's private note per
student, never shown to students. Since 0.41.0 nothing writes notes (the endpoint is gone): the old ones are
only read — in the lesson details and the student's history feed, teacher only. The summary is saved by its own
`UPDATE` without the lesson `version`, so it never conflicts with time edits; last write wins. Allowed only for
a lesson that has started and is not `CANCELLED`, and not for an individual `MISSED` one — the same for the
share action (errors `schedule.lesson-cancelled`, `schedule.lesson-not-started`, `schedule.lesson-missed`,
`schedule.summary-too-long`). Series edits do not touch them; deleting a lesson deletes its notes. Saving a non-empty `next_plan` copies it (cut to 500 characters, our
decision) into the topic of the next planned lesson of the same student (or the same group) if that topic is empty;
a filled topic is never overwritten, the title is never touched.
Calendar lists, ICS and Google carry none of these fields.

Lesson plan (461.2, [roadmap 11](../roadmap/11-courses-and-lesson-plans.md)): `lessons.plan_id`
(unique index `ux_lessons_plan`, null = none) — a working plan of `textbooks`, one per lesson
and a plan on at most one lesson. Saved by its own `UPDATE` without the lesson `version`, like the
summary. A prepared lesson counts as touched: `deleteUntouchedOfSeries` (`and plan_id is null`) and
the «this and following» edit, cancel and delete keep it, like a charged one. Moving keeps the
link; deleting the lesson drops it and leaves the plan in `textbooks` (it cannot listen to
`schedule`). A deleted plan leaves a dangling id: reads answer 404.

Lesson homework (462.1, roadmap 11): `lesson_assignments (assignment_id PK, lesson_id → lessons on
delete cascade, position)` — working assignments of `homework`, many per lesson in the order
linked, an assignment on at most one lesson; no lesson `version`. Loaded with the lesson
(`Lesson.assignmentIds`); a lesson with homework is prepared like one with a plan:
`deleteUntouchedOfSeries` (`and id not in (select lesson_id from schedule.lesson_assignments)`)
and `LessonRepetitionService.protectedLesson` (`Lesson.prepared()`) keep it. Deleting the lesson
drops the links, the assignments stay; a deleted assignment leaves a dangling id.

## REST and bot

`/api/teacher/schedule/**` (lessons, requests, unmarked, summary — besides today's counters it has
`weekConducted` and `weekMissed`, lessons marked as held / missed in the current Monday–Sunday week of the instance
time zone, for the Today page (239.1); `off-times`, `google`, `settings` (lesson rules);
`GET lessons?from&to` takes `studentId` — the student's lessons, group lessons included — or `groupId` for the
student card (237.1); both at once → `schedule.filter-invalid`, an unknown id → an empty list),
`/api/me/schedule/**` (lessons, requests, busy, feed, settings, summary), public ICS feed and Google callback.
The guardian (`GuardianScheduleController`, 452.1): `/api/guardian/students/{studentId}/schedule/`
`settings`, `summary`, `lessons`, `lessons/{lessonId}`, `history` — the same `ScheduleQueries` as
`/api/me/schedule` after `GuardianAccess.require` (not their child → 404 `student.not-found`, a
student or the teacher → 403); on the child's behalf (454.2) `busy`, `free-times`,
`POST lessons/{lessonId}/requests` (body as `/api/me`), `GET requests` (the child's latest, whoever
sent them), `DELETE requests/{requestId}` (withdraws any unanswered request of the child) — the same
`TeacherAvailability` / `ChangeRequestService` / `ScheduleQueries`; a lesson or request not the
child's → 404; own feed `/api/guardian/schedule/feed` (GET / POST / DELETE, `FeedService` keyed by
the guardian's id).
Bot actions (`schedule/chat`): schedule, mark lessons, answer requests (teacher); lesson change, my requests
(student); «Расписание детей» (`schedule.family`: every child's upcoming lessons under their name,
no join button) and the same lesson change (`schedule.move`, `schedule.cancel`) for a guardian —
with several children the dialog first asks «Для кого?», each step checks the child is still theirs.
After «Проведено» (or an attendance mark that leaves the lesson conducted) the mark-lessons dialog offers
«Записать итоги» / «Пропустить»: the next text message (≤ 4000 characters) is saved with `updateSummary` (the
portal's «Что дальше» is kept), then «Отправить ученику(ам)» (`shareSummary`) / «Готово». The marking is
audited at once through `AuditLog.bot`, the final step by the dialog (`lesson-summary-shared` /
`lesson-summary-written`); a changed or refused lesson ends with a short «не получилось» answer.
`PUT lessons/{id}/summary` (`summary`, `nextPlan`; blank clears) returns the lesson details: `GET lessons/{id}` of the teacher has `summary`, `nextPlan`, `summaryUpdatedAt`, `notes[]`;
`GET /api/me/schedule/lessons/{id}` has `summary` only (a lesson the student is not in is 404); lists have none.
Lesson plan (461.2, `LessonPlanLinks`):
`PUT /api/teacher/schedule/lessons/{id}/plan {planId | null}` returns the details; no `version`;
checked by `textbooks::api.LessonPlans.checkLinkable` — no plan 404
`textbooks.plan-not-found`, a bank original 409 `schedule.bank-item` (mapped from
`textbooks.plan-in-bank`), on another lesson 409 `schedule.plan-linked` (the unique index), a new
plan on a cancelled lesson 422 `schedule.lesson-cancelled` (taking it off is allowed); the same plan
again is a no-op, another plan replaces it. Every lesson view (lists and details, the student's
and the guardian's too) has `planId`. The student of the lesson reads
`GET /api/me/schedule/lessons/{id}/plan` (`id`, `title`, `body`, `textbooks[]` with `pages`,
`videos[]` — `transcript` only with `transcriptShown`) and
`GET …/plan/textbooks/{textbookId}` (the bound pages through `Textbooks.content`, a whole textbook
through `Textbooks.file`, always a download); another student's lesson 404
`schedule.lesson-not-found`, no or a deleted plan 404 `schedule.plan-not-found`, a textbook not in
the plan 404 `schedule.textbook-not-found`, the teacher 403. The guardian — the same under
`/api/guardian/students/{studentId}/schedule/lessons/{id}/plan[/textbooks/{textbookId}]` after
`GuardianAccess.require`.
Lesson homework (462.1, `LessonHomeworkLinks`): `POST /api/teacher/schedule/lessons/{id}/homework
{assignmentId}` and `DELETE …/homework/{assignmentId}` return the details; no `version`. Checked by
`homework::api.Assignments.checkLinkable` — no assignment 404 `assignment.not-found`, a bank
original 409 `schedule.bank-item` (mapped from `homework.bank-item`), on another lesson 409
`schedule.assignment-linked`, a new link on a cancelled lesson 422 `schedule.lesson-cancelled`
(taking it off is allowed); the same assignment again and removing one that is not there are
no-ops. The teacher's lesson views (lists and details) have `assignmentIds`; the student's and the
guardian's have an empty list.
History feeds of held lessons (`CONDUCTED`/`MISSED`, group lessons included, newest first, paged by the
`before` instant = start of the last item, `limit` 1–100, default 20):
`GET /api/teacher/schedule/students/{id}/history`
(date, title, topic, status, attendance, `summary`, `nextPlan`, the student's own private `note`),
`GET /api/teacher/schedule/groups/{id}/history` (same without private notes and attendance) and
`GET /api/me/schedule/history` (own lessons only, `summary` only — no plan, no note).
Lessons ahead, grouped (0.41.0): `GET /api/teacher/schedule/students/{id}/upcoming` (group lessons
included) and `GET /api/teacher/schedule/groups/{id}/upcoming` read up to 400 days of lessons that
have not ended. `series[]` — repeat rules alike but for the weekday (owner, time, duration,
interval, title, end) merged into one item: `weekdays`, `startTime`, `durationMinutes`,
`intervalWeeks`, `since` (the earliest rule start), `endsOn`, `remaining` (regular lessons left,
ungenerated dates up to the end included; `null` without an end), `title`, group, `nextStartsAt`.
`lessons[]` — the rest with `kind`: `ONE_OFF` (no rule), `CANCELLED`, `MOVED`
(`originalStartsAt` set) or `CHANGED` (an individually edited occurrence).
`POST lessons/{id}/summary/share` (204) publishes `LessonSummaryShared(lessonId, studentIds, teacherId, startsAt,
occurredAt)` — only this explicit action, never a plain save; an empty summary is `schedule.summary-empty` (422).
Lesson POST/PUT accept `repeatWeeks` (0–4), `repeatUntil`; PUT/cancel/DELETE accept `scope` (`ONLY`/`FOLLOWING`)
and optional optimistic `version`/`repeatVersion`. The UI supplies versions. `GET lessons/{id}/following`
discloses affected/protected existing lesson IDs and the rule version before a bulk action. Standalone
`/series` CRUD is removed. Student requests always concern one occurrence.

## Frontend

Move confirmation controls remain clickable across adjacent day columns when overlapping lessons narrow the card.
Missed calendar lessons use `error-container` / `on-error-container`, matching debt and overdue-work accents;
status tags outside the calendar retain their warning styling. The teacher home's group attendance action
opens the same attendance dialog as the calendar directly on the home page.

The calendar's styles (FullCalendar's skeleton and classic theme, then
`ui/schedule-calendar.scss`) are the `calendar` style bundle (`calendar.css`), loaded by the two
schedule routes (`withStyleBundle` in `app.routes.ts`), not a part of the initial CSS.

`features/schedule/`: `teacher/` (calendar — FullCalendar, unified lesson/repeat dialog, off-time, requests),
`student/` (week/month calendar and a supporting pane with mini-month, upcoming lessons and requests; compact
agenda with week/day navigation and week/month switches, lesson bottom sheet on compact (16 px between details and actions) and centered
`tb-dialog` on medium and wider screens, matching the teacher), `ui/` (lesson actions, `lesson-card.ts`), `home/` widgets,
`schedule-labels.ts`. The teacher's time zone, `teacher/google-calendar-panel.ts` and `ui/calendar-feed-panel.ts` sit in
the settings category «Занятия» (`/teacher/settings/lessons`, 357.2; `calendar` redirects), not on the schedule page. A new lesson gets the default topic of the chosen student or group
(`teacher/lesson-owner.ts` `followDefaultTopic`, 0.13.0) as its title unless the teacher typed
one; until 334.2 the form has only the title field and keeps the lesson's topic unchanged.
Dragging a lesson in the teacher's calendar (`ui/schedule-calendar.ts`) does not save it: the lesson
waits at the new time with «Перенести» / «Отменить перенос» on its card; only «Перенести» sends the edit.

Lesson card (0.34.0, ADR-0050): the teacher's `teacher/lesson-details-dialog.ts` and the student's sheet in
`student/my-schedule-page.ts` share the content `ui/lesson-card.ts` inside `<tb-dialog kind="sheet">`. A past
lesson with one student has the row «Итог» — a connected single-select toggle «Проведено | Пропуск»: a press
saves at once (`PUT`/`DELETE …/outcome`), a press on the chosen one removes the mark, a failure puts the toggle
back. Every mark (the toggle, the agenda buttons, Today «Нужно сделать», the attendance dialog)
needs no confirmation: the snackbar «Отмечено: пропуск · Отменить» (6 s) calls the correction
endpoint with the previous state (`data-access/lesson-mark-undo.ts`: `DELETE …/outcome`,
`PUT …/outcome` or `PUT …/attendance`; the backend publishes `LessonCompletionRevoked`) and the
list is refreshed.
A past group lesson has «Отметить посещаемость» in the footer and «Снять отметку» in «⋮»; a cancelled one
«Восстановить» (an overlap asks `Confirm.safe`). «Отменить занятие…» (`teacher/lesson-cancel-dialog.ts`) and
«Удалить…» of a series lesson (`teacher/lesson-delete-dialog.ts`) are dialogs of their own with the scope list
«Только это / Это и следующие» (`teacher/lesson-scope.ts`: the count comes from `…/following`, a send waits for
it); a single lesson is deleted by `Confirm.danger`. The card closes before any of them opens.

## Unified repetition contract (ADR-0049)

Since 0.29.0 a lesson owns Once or 1–4-week repetition, with inclusive optional end date.
Occurrence boundaries use immutable original dates, independently from actual moves. Following-scope edits
continue the logical occurrence sequence while anchoring actual time to the edited lesson. Completed, charged
and explicitly edited occurrences are protected; deleted occurrences cannot regenerate. Migration splits every
stored weekday rule using its ISO-week phase without changing lesson UUIDs or integration/billing identities.
The rolling horizon and DST resolution stay unchanged. See [ADR-0049](../adr/0049-lesson-owned-repetition.md).
