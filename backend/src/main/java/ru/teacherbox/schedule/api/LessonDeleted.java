package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher deleted a lesson that was not held (a planned or cancelled one, nobody charged).
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds students who were expected at the lesson
 * @param planned    the lesson was planned, not cancelled: the students still expected it
 */
public record LessonDeleted(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant startsAt,
        boolean planned,
        Instant occurredAt) {

    public LessonDeleted {
        studentIds = List.copyOf(studentIds);
    }
}
