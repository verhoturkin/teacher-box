package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A single lesson was planned (lessons of a series are announced by {@link SeriesScheduled}).
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds participants of the lesson
 */
public record LessonScheduled(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant startsAt,
        int durationMinutes,
        @Nullable String topic,
        Instant occurredAt) {

    public LessonScheduled {
        studentIds = List.copyOf(studentIds);
    }
}
