package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A single lesson was planned (lessons of a series are announced by {@link SeriesScheduled}). */
public record LessonScheduled(
        UUID lessonId,
        UUID studentId,
        Instant startsAt,
        int durationMinutes,
        @Nullable String topic,
        Instant occurredAt) {
}
