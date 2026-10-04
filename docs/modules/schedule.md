# schedule

Lessons and weekly series (student or group), attendance, student reschedule/cancel requests, reminders,
calendar feeds (ICS), Google Calendar sync, teacher off-time. Depends on: `shared`, `identity::api`,
`meetings::api` (room links). Schema `schedule`. ADRs: [0008](../adr/0008-schedule.md),
[0011](../adr/0011-groups-and-group-lessons.md), [0012](../adr/0012-meetings-and-boards.md).

## Rules

- **Time:** a lesson stores its start as `Instant`; a series stores weekdays, local time and dates in
  `TEACHERBOX_TIMEZONE` (DST does not shift lessons). The UI gets the zone from `GET /api/me/schedule/settings`.
- **Series:** lessons are created ahead up to `TEACHERBOX_SCHEDULE_HORIZON` (84 days) and extended nightly
  (`SeriesExtension`). A series never changes in place: a change from a date ends the old series the day before
  and starts a new one; future lessons of the old one are removed except individually moved ones. Unique
  `(series_id, series_date)`.
- **Overlaps:** one teacher → any overlap is a conflict `409 schedule.overlap`; the UI asks and retries with
  `allowOverlap`.
- **Participants** (`lesson_participants`): one for an individual lesson; a group series uses the current
  members; `GroupChanged` updates only future planned lessons; `GroupArchived` stops series and cancels future
  lessons.
- **Outcome:** after the start the teacher marks «Проведено» / «Пропуск»; for a group — per participant
  (attended, missed — paid, excused — not paid). Each mark publishes `LessonCompleted` with a `completionId`;
  correcting it publishes `LessonCompletionRevoked`. Lesson statuses: scheduled, conducted, missed, cancelled;
  a not-held lesson can be deleted or restored.
- **Student requests:** move (with proposed time) or cancel; the teacher approves or declines. Cancelling later
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
- **Google Calendar:** OAuth web flow with the teacher's own client (env vars win over UI), scope
  `calendar.app.created` (+ optional `calendar.freebusy`), own «Teacher Box» calendar, one-way sync every minute
  (`GoogleSyncJob`), network calls outside transactions; `invalid_grant` → `GoogleCalendarDisconnected`.
  Redirect via `Portal.link`. Proxy `TEACHERBOX_SCHEDULE_GOOGLE_PROXY`.
- `joinUrl` of a lesson = its own link or the student's/group's room from `MeetingRooms`.

## Contract (`schedule::api`)

Events: `LessonScheduled`, `SeriesScheduled`, `SeriesStopped`, `LessonRescheduled`, `ScheduledLessonCancelled`,
`LessonRestored`, `LessonDeleted`, `LessonStartingSoon`, `LessonChangeRequested`, `LessonChangeResolved`,
`LessonCompleted`, `LessonCompletionRevoked`, `GoogleCalendarDisconnected`; enums `CancelledBy`, `ChangeKind`.
Lesson events carry `groupId` and participants. Consumers: `billing` (completion), `notifications` (all).

## Data

`series`, `lessons`, `lesson_participants`, `change_requests`, `reminders_sent`, `feeds`, `off_times`,
`google_connection`, `google_events`, `google_oauth_states`.

## REST and bot

`/api/teacher/schedule/**` (lessons, series, requests, unmarked, summary, `off-times`, `google`),
`/api/me/schedule/**` (lessons, requests, busy, feed, settings, summary), public ICS feed and Google callback.
Bot actions (`schedule/chat`): schedule, mark lessons, answer requests (teacher); lesson change, my requests
(student).

## Frontend

`features/schedule/`: `teacher/` (calendar — FullCalendar, lesson dialog, series, off-time, requests),
`student/` (my schedule, bottom sheet on the phone), `ui/` (lesson actions), `home/` widgets,
`schedule-labels.ts`.
