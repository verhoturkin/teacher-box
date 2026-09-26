package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A planned lesson was cancelled.
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds participants of the lesson
 * @param charged    the late cancellation is charged as a missed lesson ({@link LessonCompleted} follows)
 * @param byRequest  {@code true} if the teacher approved the student's request
 */
public record ScheduledLessonCancelled(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant startsAt,
        CancelledBy cancelledBy,
        @Nullable String reason,
        boolean charged,
        boolean byRequest,
        Instant occurredAt) {

    public ScheduledLessonCancelled {
        studentIds = List.copyOf(studentIds);
    }
}
