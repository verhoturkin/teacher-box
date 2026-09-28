package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A cancelled lesson is planned again.
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds students expected at the lesson (excused students of a group stay excused)
 */
public record LessonRestored(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant startsAt,
        int durationMinutes,
        Instant occurredAt) {

    public LessonRestored {
        studentIds = List.copyOf(studentIds);
    }
}
