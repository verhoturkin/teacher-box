package ru.teacherbox.schedule.domain;

/** A planned lesson either takes place (conducted or missed by the student) or is cancelled. */
public enum LessonStatus {
    SCHEDULED,
    CONDUCTED,
    MISSED,
    CANCELLED;

    /** The outcome is marked and the lesson is charged. */
    public boolean isCompleted() {
        return this == CONDUCTED || this == MISSED;
    }
}
