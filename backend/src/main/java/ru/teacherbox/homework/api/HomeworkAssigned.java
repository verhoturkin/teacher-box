package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A student received a homework task. */
public record HomeworkAssigned(
        UUID taskId,
        UUID assignmentId,
        UUID studentId,
        String title,
        @Nullable Instant dueAt,
        Instant occurredAt) {
}
