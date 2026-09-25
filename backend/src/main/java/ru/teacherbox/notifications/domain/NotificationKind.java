package ru.teacherbox.notifications.domain;

/** What a notification is about (used by the UI for icons). */
public enum NotificationKind {
    HOMEWORK_ASSIGNED,
    HOMEWORK_SUBMITTED,
    HOMEWORK_REVIEWED,
    HOMEWORK_DUE_SOON,
    LESSON_RECORDED,
    LESSON_CANCELLED,
    PAYMENT_RECORDED,
    PAYMENT_VOIDED,
    STUDENT_ACTIVATED,
    MESSAGE
}
