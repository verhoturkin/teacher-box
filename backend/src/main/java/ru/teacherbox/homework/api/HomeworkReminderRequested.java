package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The teacher asked to remind a student of a task that is not handed in (at most once an hour per task). */
public record HomeworkReminderRequested(
        UUID taskId,
        UUID assignmentId,
        UUID studentId,
        String title,
        @Nullable Instant dueAt,
        Instant occurredAt) {
}
