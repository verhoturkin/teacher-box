package ru.teacherbox.schedule.notices;

import ru.teacherbox.shared.notice.NoticeKind;

/** What the schedule notifies about; the names are known to {@code notifications} (preferences, icons). */
enum ScheduleNoticeKind implements NoticeKind {
    SCHEDULE_LESSON_PLANNED,
    SCHEDULE_LESSON_MOVED,
    SCHEDULE_LESSON_CANCELLED,
    SCHEDULE_REMINDER,
    SCHEDULE_REQUEST,
    SCHEDULE_REQUEST_ANSWERED,
    SCHEDULE_CALENDAR,
    LESSON_SUMMARY
}
