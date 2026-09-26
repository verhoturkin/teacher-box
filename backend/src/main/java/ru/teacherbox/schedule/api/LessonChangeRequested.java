package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A student asks to move or cancel a lesson.
 *
 * @param proposedStartsAt new time for {@link ChangeKind#RESCHEDULE}
 * @param late             the request comes later than the cancellation policy allows
 */
public record LessonChangeRequested(
        UUID requestId,
        UUID lessonId,
        UUID studentId,
        ChangeKind kind,
        Instant startsAt,
        @Nullable Instant proposedStartsAt,
        @Nullable String comment,
        boolean late,
        Instant occurredAt) {
}
