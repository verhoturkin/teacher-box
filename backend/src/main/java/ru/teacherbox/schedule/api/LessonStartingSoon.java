package ru.teacherbox.schedule.api;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Reminder: a lesson starts soon.
 *
 * @param before     how long before the start the reminder is sent
 * @param lastBefore this is the last reminder before the lesson (the teacher gets only this one)
 */
public record LessonStartingSoon(
        UUID lessonId,
        UUID studentId,
        Instant startsAt,
        int durationMinutes,
        @Nullable String topic,
        @Nullable String meetingUrl,
        Duration before,
        boolean lastBefore,
        Instant occurredAt) {
}
