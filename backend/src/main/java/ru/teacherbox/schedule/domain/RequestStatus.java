package ru.teacherbox.schedule.domain;

/** State of a student's request; only {@link #PENDING} requests can change. */
public enum RequestStatus {
    PENDING,
    APPROVED,
    DECLINED,
    /** Withdrawn by the student. */
    WITHDRAWN,
    /** The teacher changed the lesson in another way before answering. */
    OUTDATED
}
