package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A planned lesson was cancelled.
 *
 * @param charged   the late cancellation is charged as a missed lesson ({@link LessonCompleted} follows)
 * @param byRequest {@code true} if the teacher approved the student's request
 */
public record ScheduledLessonCancelled(
        UUID lessonId,
        UUID studentId,
        Instant startsAt,
        CancelledBy cancelledBy,
        @Nullable String reason,
        boolean charged,
        boolean byRequest,
        Instant occurredAt) {
}
