package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher answered a student's request.
 *
 * @param groupId  the group of a group lesson, {@code null} for a lesson with one student
 * @param startsAt start of the lesson after the answer (the new time of an approved move)
 * @param charged  an approved cancellation is charged as a missed lesson
 */
public record LessonChangeResolved(
        UUID requestId,
        UUID lessonId,
        UUID studentId,
        @Nullable UUID groupId,
        ChangeKind kind,
        boolean approved,
        Instant startsAt,
        boolean charged,
        @Nullable String comment,
        Instant occurredAt) {
}
