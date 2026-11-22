package ru.teacherbox.schedule.api;

/** What a lesson was for one of its students (ADR-0072). */
public enum LessonOutcome {
    /** Not marked yet: ahead, or the teacher has not marked it. */
    PLANNED,
    ATTENDED,
    /** Missed without notice: charged. */
    MISSED,
    /** A lesson with the student alone cancelled late and charged as missed. */
    LATE_CANCELLED,
    /** Told in time that they would not come to a group lesson: not charged. */
    EXCUSED,
    /** The lesson was cancelled. */
    CANCELLED
}
