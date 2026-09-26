package ru.teacherbox.schedule.domain;

/** Attendance of one participant of a lesson (ADR-0011). */
public enum Attendance {
    /** The lesson has not been marked for the student yet. */
    EXPECTED,
    ATTENDED,
    /** Missed without notice (or a charged late cancellation): charged as a missed lesson. */
    MISSED,
    /** Told in time that they would not come: not charged. */
    EXCUSED;

    /** The student is charged for the lesson. */
    public boolean isCharged() {
        return this == ATTENDED || this == MISSED;
    }
}
