package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;

/**
 * A lesson moved to another time or got another duration.
 *
 * @param byRequest {@code true} if the teacher approved the student's request
 *                  ({@link LessonChangeResolved} is published as well)
 */
public record LessonRescheduled(
        UUID lessonId,
        UUID studentId,
        Instant previousStartsAt,
        Instant startsAt,
        int durationMinutes,
        boolean byRequest,
        Instant occurredAt) {
}
