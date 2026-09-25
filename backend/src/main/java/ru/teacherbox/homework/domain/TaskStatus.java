package ru.teacherbox.homework.domain;

/** Progress of one student on one assignment. */
public enum TaskStatus {
    /** Waiting for the student. */
    ASSIGNED,
    /** Handed in, waiting for the teacher. */
    SUBMITTED,
    /** The teacher asked for a revision. */
    RETURNED,
    /** Accepted by the teacher (final, may be reopened by returning it). */
    ACCEPTED;

    /** The student still has to work on it. */
    public boolean isOpen() {
        return this == ASSIGNED || this == RETURNED;
    }
}
