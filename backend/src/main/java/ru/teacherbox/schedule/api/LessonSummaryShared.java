package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The teacher sent the summary of a lesson to its participants (the explicit «Отправить ученику» action,
 * never an autosave). The text itself is read by the students in the lesson card.
 *
 * @param studentIds participants of the lesson
 * @param startsAt   start of the lesson
 */
public record LessonSummaryShared(
        UUID lessonId,
        List<UUID> studentIds,
        UUID teacherId,
        Instant startsAt,
        Instant occurredAt) {

    public LessonSummaryShared {
        studentIds = List.copyOf(studentIds);
    }
}
