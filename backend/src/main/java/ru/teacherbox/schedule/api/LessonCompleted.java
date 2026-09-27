package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher marked the attendance of a student at a lesson; the lesson is charged to the student.
 * A group lesson publishes one event per charged participant.
 *
 * @param completionId id of this charge: a corrected mark gets a new id and the old one is
 *                     revoked by {@link LessonCompletionRevoked}
 * @param groupId      the group of a group lesson (charged at the group price), {@code null} otherwise
 * @param date         date of the lesson in the instance time zone
 * @param missed       the student missed the lesson or cancelled too late
 */
public record LessonCompleted(
        UUID completionId,
        UUID lessonId,
        UUID studentId,
        @Nullable UUID groupId,
        LocalDate date,
        int durationMinutes,
        @Nullable String topic,
        boolean missed,
        Instant occurredAt) {
}
