package ru.teacherbox.schedule.domain;

/** State of the connection to the teacher's Google Calendar. */
public enum GoogleStatus {
    NOT_CONNECTED,
    CONNECTED,
    /** Google no longer accepts the authorization (revoked or expired): connect again. */
    NEEDS_RECONNECT
}
