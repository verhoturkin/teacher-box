package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher marked the outcome of a lesson; the lesson is charged to the student.
 *
 * @param completionId id of this outcome: a corrected outcome gets a new id and the old one is
 *                     revoked by {@link LessonCompletionRevoked}
 * @param date         date of the lesson in the instance time zone
 * @param missed       the student missed the lesson or cancelled too late
 */
public record LessonCompleted(
        UUID completionId,
        UUID lessonId,
        UUID studentId,
        LocalDate date,
        int durationMinutes,
        @Nullable String topic,
        boolean missed,
        Instant occurredAt) {
}
