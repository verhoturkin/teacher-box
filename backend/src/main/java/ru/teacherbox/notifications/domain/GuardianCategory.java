package ru.teacherbox.notifications.domain;

import java.util.Optional;

/**
 * The groups of a child's notices a guardian gets (ADR-0069), each on until the guardian switches it off. A
 * notice of any other kind — a new task, a message from the teacher, a video room — reaches the student only.
 */
public enum GuardianCategory {
    /** Lessons recorded or cancelled with a charge, payments recorded or voided: the balance and the debt. */
    PAYMENTS,
    /** Lesson reminders, new, moved and cancelled lessons, the teacher's answer to a change request. */
    LESSONS,
    /** A task's deadline is near, or the teacher reminds of a task not handed in. */
    HOMEWORK_DEADLINES,
    /** The teacher accepted or returned a task. */
    REVIEWED_WORK;

    /** The category a notice of this kind goes to guardians in; empty if guardians do not get it. */
    public static Optional<GuardianCategory> of(NotificationKind kind) {
        return Optional.ofNullable(switch (kind) {
            case LESSON_RECORDED, LESSON_CANCELLED, PAYMENT_RECORDED, PAYMENT_VOIDED -> PAYMENTS;
            case SCHEDULE_REMINDER, SCHEDULE_LESSON_PLANNED, SCHEDULE_LESSON_MOVED, SCHEDULE_LESSON_CANCELLED,
                    SCHEDULE_REQUEST_ANSWERED -> LESSONS;
            case HOMEWORK_DUE_SOON, HOMEWORK_REMINDER -> HOMEWORK_DEADLINES;
            case HOMEWORK_REVIEWED -> REVIEWED_WORK;
            case HOMEWORK_ASSIGNED, HOMEWORK_SUBMITTED, SCHEDULE_REQUEST, SCHEDULE_CALENDAR, LESSON_SUMMARY,
                    MEETING_LINK, CALL_SUMMONED, STUDENT_ACTIVATED, BACKUP_FAILED, BACKUP_UPLOAD_FAILED,
                    MESSAGE -> null;
        });
    }
}
