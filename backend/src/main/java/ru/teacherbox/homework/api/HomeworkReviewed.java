package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher reviewed a submission.
 *
 * @param accepted {@code true} if accepted, {@code false} if returned for revision
 */
public record HomeworkReviewed(
        UUID taskId,
        UUID assignmentId,
        UUID studentId,
        String title,
        boolean accepted,
        @Nullable String grade,
        Instant occurredAt) {
}
