package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher answered a student's request.
 *
 * @param startsAt start of the lesson after the answer (the new time of an approved move)
 * @param charged  an approved cancellation is charged as a missed lesson
 */
public record LessonChangeResolved(
        UUID requestId,
        UUID lessonId,
        UUID studentId,
        ChangeKind kind,
        boolean approved,
        Instant startsAt,
        boolean charged,
        @Nullable String comment,
        Instant occurredAt) {
}
