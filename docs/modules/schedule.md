# schedule

Lessons with optional weekly repetition (student or group), attendance, student reschedule/cancel requests, reminders,
calendar feeds (ICS), Google Calendar sync, teacher off-time. Depends on: `shared`, `identity::api`,
`meetings::api` (room links). Schema `schedule`. ADRs: [0008](../adr/0008-schedule.md),
[0011](../adr/0011-groups-and-group-lessons.md), [0012](../adr/0012-meetings-and-boards.md),
[0053](../adr/0053-lesson-title-and-topic.md).

## Rules

- **Time:** a lesson stores its start as `Instant`; its repeat rule stores weekday, local time and dates in
  `TEACHERBOX_TIMEZONE` (DST does not shift lessons). The UI gets the zone from `GET /api/me/schedule/settings`.
- **Repetition:** Once or every 1–4 weeks, configured in the lesson form, with optional inclusive end date.
  `OccurrenceGeneration` extends the 84-day rolling horizon (`TEACHERBOX_SCHEDULE_HORIZON`) nightly.
  Only-this edits preserve the immutable original occurrence date and mark an exception. This-and-following
  uses that original date as its boundary, ends the old rule and replaces untouched future occurrences.
  Completed, charged, cancelled and individually edited lessons remain. Once keeps the selected lesson
  and stops later repetition. Tombstones prevent deleted occurrences from regenerating. Unique
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
  than `TEACHERBOX_SCHEDULE_LATE_CANCELLATION` (24 h) is marked late — the teacher decides if it counts as missed.
  In a group lesson an early «Не приду» is accepted at once (excused); a move moves it for everyone. A teacher
  edit of a lesson with an open request makes it `OUTDATED`.
- **Availability:** the student sees the teacher's busy time without names (lessons, Google busy, off-time)
  and cannot ask to move onto it; the teacher may override. Off-time (`off_times`): one-off ranges or weekly
  windows, periods computed on the fly.
- **Reminders:** every 5 min `LessonReminders` publishes `LessonStartingSoon` for intervals
  `TEACHERBOX_SCHEDULE_REMINDERS` (`24h,1h`), only the nearest if several are due; reset on reschedule.
- **ICS feed:** `/api/public/schedule/<token>.ics` (256-bit token, hash stored, shown once): the teacher's feed
  has all lessons with names, a student's — own lessons (incl. group ones, group name instead of names).
  Written in the language of the feed's owner (0.11.1, ADR-0036: `CalendarTexts`); Google events — in the
  teacher's language when a lesson is synced (events already in Google change with the lesson).
- **Google Calendar:** OAuth web flow with the teacher's own client (env vars win over UI), scope
  `calendar.app.created` (+ optional `calendar.freebusy`), own «Teacher Box» calendar, one-way sync every minute
  (`GoogleSyncJob`), network calls outside transactions; `invalid_grant` → `GoogleCalendarDisconnected`.
  Redirect via `Portal.link`. Proxy `TEACHERBOX_SCHEDULE_GOOGLE_PROXY`.
- `joinUrl` of a lesson = its own link or the link of the student's/group's room from `MeetingRooms` (an external
  link or the portal link of the built-in call, ADR-0030).

## Contract (`schedule::api`)

Events: `LessonScheduled`, `LessonRepeatScheduled`, `LessonRepeatStopped`, `LessonRescheduled`, `ScheduledLessonCancelled`,
`LessonRestored`, `LessonDeleted`, `LessonStartingSoon`, `LessonChangeRequested`, `LessonChangeResolved`,
`LessonCompleted`, `LessonCompletionRevoked`, `LessonSummaryShared`, `GoogleCalendarDisconnected`; enums `CancelledBy`, `ChangeKind`.
Lesson events carry `groupId` and participants; `LessonScheduled`, `LessonStartingSoon` and
`LessonCompleted` carry `title` (`null` = default), the first two also `topic`.
Consumers: `billing` (completion), `notifications` (all).
Repeat events aggregate notifications; generation itself does not notify per occurrence. Deprecated
`SeriesScheduled`/`SeriesStopped` records and listeners only drain durable publications from older versions.

## Data

`repeat_rules`, `repeat_exceptions`, `lessons`, `lesson_participants`, `change_requests`, `lesson_notes`, `reminders_sent`, `feeds`,
`off_times`, `google_connection`, `google_events`, `google_oauth_states`.

Lesson summary (0.37.0): `lessons.summary` (4000, Markdown, shown to the participants), `next_plan` (1000) and
`summary_updated_at`; `lesson_notes (lesson_id, student_id, note, updated_at)` — the teacher's private note per
student, never shown to students. They are saved by their own `UPDATE` without the lesson `version`, so they never
conflict with time edits; last write wins. Allowed only for a lesson that has started and is not `CANCELLED`, and
not for an individual `MISSED` one — the same for the share action (errors `schedule.lesson-cancelled`,
`schedule.lesson-not-started`, `schedule.lesson-missed`, `schedule.summary-too-long`, `schedule.not-a-participant`). Series edits do not touch
them; deleting a lesson deletes its notes. Saving a non-empty `next_plan` copies it (cut to 500 characters, our
decision) into the topic of the next planned lesson of the same student (or the same group) if that topic is empty;
a filled topic is never overwritten, the title is never touched.
Calendar lists, ICS and Google carry none of these fields.

## REST and bot

`/api/teacher/schedule/**` (lessons, requests, unmarked, summary — besides today's counters it has
`weekConducted` and `weekMissed`, lessons marked as held / missed in the current Monday–Sunday week of the instance
time zone, for the Today page (239.1); `off-times`, `google`;
`GET lessons?from&to` takes `studentId` — the student's lessons, group lessons included — or `groupId` for the
student card (237.1); both at once → `schedule.filter-invalid`, an unknown id → an empty list),
`/api/me/schedule/**` (lessons, requests, busy, feed, settings, summary), public ICS feed and Google callback.
Bot actions (`schedule/chat`): schedule, mark lessons, answer requests (teacher); lesson change, my requests
(student).
After «Проведено» (or an attendance mark that leaves the lesson conducted) the mark-lessons dialog offers
«Записать итоги» / «Пропустить»: the next text message (≤ 4000 characters) is saved with `updateSummary` (the
portal's «Что дальше» is kept), then «Отправить ученику(ам)» (`shareSummary`) / «Готово». The marking is
audited at once through `AuditLog.bot`, the final step by the dialog (`lesson-summary-shared` /
`lesson-summary-written`); a changed or refused lesson ends with a short «не получилось» answer.
`PUT lessons/{id}/summary` (`summary`, `nextPlan`; blank clears) and `PUT lessons/{id}/notes/{studentId}` (`note`)
return the lesson details: `GET lessons/{id}` of the teacher has `summary`, `nextPlan`, `summaryUpdatedAt`, `notes[]`;
`GET /api/me/schedule/lessons/{id}` has `summary` only (a lesson the student is not in is 404); lists have none.
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

`features/schedule/`: `teacher/` (calendar — FullCalendar, unified lesson/repeat dialog, off-time, requests),
`student/` (week/month calendar and a supporting pane with mini-month, upcoming lessons and requests; compact
agenda with week/day navigation and week/month switches, lesson bottom sheet on compact (16 px between details and actions) and centered
`tb-dialog` on medium and wider screens, matching the teacher), `ui/` (lesson actions, `lesson-card.ts`), `home/` widgets,
`schedule-labels.ts`. The teacher's time zone, `teacher/google-calendar-panel.ts` and `ui/calendar-feed-panel.ts` sit in
the settings category «Расписание и календарь» (`/teacher/settings/calendar`, 0.22.0), not on the schedule page. A new lesson gets the default topic of the chosen student or group
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
