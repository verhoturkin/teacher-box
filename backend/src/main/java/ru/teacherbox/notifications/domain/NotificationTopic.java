package ru.teacherbox.notifications.domain;

/**
 * What a notification is about, in the groups a recipient can mute in messengers (the personal
 * area always shows everything). Messages from the teacher cannot be muted.
 */
public enum NotificationTopic {
    HOMEWORK,
    SCHEDULE,
    REMINDERS,
    BILLING,
    ACCOUNT,
    MESSAGES;

    public static NotificationTopic of(NotificationKind kind) {
        return switch (kind) {
            case HOMEWORK_ASSIGNED, HOMEWORK_SUBMITTED, HOMEWORK_REVIEWED -> HOMEWORK;
            case HOMEWORK_DUE_SOON, SCHEDULE_REMINDER -> REMINDERS;
            case LESSON_RECORDED, LESSON_CANCELLED, PAYMENT_RECORDED, PAYMENT_VOIDED -> BILLING;
            case SCHEDULE_LESSON_PLANNED, SCHEDULE_LESSON_MOVED, SCHEDULE_LESSON_CANCELLED, SCHEDULE_REQUEST,
                    SCHEDULE_REQUEST_ANSWERED -> SCHEDULE;
            case STUDENT_ACTIVATED, SCHEDULE_CALENDAR -> ACCOUNT;
            case MESSAGE -> MESSAGES;
        };
    }

    public boolean isMutable() {
        return this != MESSAGES;
    }
}
