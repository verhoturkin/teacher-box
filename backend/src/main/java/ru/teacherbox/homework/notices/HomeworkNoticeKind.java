package ru.teacherbox.homework.notices;

import ru.teacherbox.shared.notice.NoticeKind;

/** What the homework notifies about; the names are known to {@code notifications} (preferences, icons). */
enum HomeworkNoticeKind implements NoticeKind {
    HOMEWORK_ASSIGNED,
    HOMEWORK_SUBMITTED,
    HOMEWORK_REVIEWED,
    HOMEWORK_DUE_SOON,
    HOMEWORK_REMINDER
}
