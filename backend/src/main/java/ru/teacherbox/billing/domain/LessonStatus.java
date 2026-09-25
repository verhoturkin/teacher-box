package ru.teacherbox.billing.domain;

/** Outcome of a lesson in the log. */
public enum LessonStatus {
    /** The lesson took place; charged. */
    CONDUCTED,
    /** The student missed the lesson without notice; charged. */
    MISSED,
    /** Cancelled or recorded by mistake; not charged. */
    CANCELLED;

    public boolean isCharged() {
        return this != CANCELLED;
    }
}
