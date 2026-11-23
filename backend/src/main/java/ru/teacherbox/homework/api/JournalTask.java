package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One assignment given to one student (ADR-0072).
 *
 * @param title          the assignment's title
 * @param dueAt          {@code null} — no deadline
 * @param submittedAt    the latest answer; {@code null} — none yet
 * @param reviewedAt     the latest review; {@code null} — none yet
 * @param grade          of an accepted task
 * @param teacherComment the comment of the latest review
 */
public record JournalTask(UUID taskId, UUID assignmentId, String title, Instant assignedAt, @Nullable Instant dueAt,
        Status status, @Nullable Instant submittedAt, @Nullable Instant reviewedAt, @Nullable String grade,
        @Nullable String teacherComment) {

    /** Progress of the task, as {@code homework} keeps it. */
    public enum Status {
        /** Waiting for the student. */
        ASSIGNED,
        /** Handed in, waiting for the teacher. */
        SUBMITTED,
        /** The teacher asked for a revision. */
        RETURNED,
        ACCEPTED
    }

    /** An answer was handed in by the deadline, or there is no deadline. */
    public boolean handedInOnTime() {
        return submittedAt != null && (dueAt == null || !submittedAt.isAfter(dueAt));
    }
}
