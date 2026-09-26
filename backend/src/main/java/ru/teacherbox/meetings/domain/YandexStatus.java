package ru.teacherbox.meetings.domain;

public enum YandexStatus {
    NOT_CONNECTED,
    CONNECTED,
    /** The token was revoked or expired: the teacher connects the account again. */
    NEEDS_RECONNECT
}
