package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A lesson moved to another time or got another duration.
 *
 * @param groupId    the group of a group lesson, {@code null} for a lesson with one student
 * @param studentIds participants who are expected at the lesson
 * @param requestedBy the student whose request the teacher approved ({@link LessonChangeResolved} is
 *                    published as well), {@code null} if the teacher moved the lesson
 */
public record LessonRescheduled(
        UUID lessonId,
        @Nullable UUID groupId,
        List<UUID> studentIds,
        Instant previousStartsAt,
        Instant startsAt,
        int durationMinutes,
        @Nullable UUID requestedBy,
        Instant occurredAt) {

    public LessonRescheduled {
        studentIds = List.copyOf(studentIds);
    }
}
