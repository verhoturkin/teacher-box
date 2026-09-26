package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;

/** A marked outcome was withdrawn (the lesson is planned again or gets another outcome). */
public record LessonCompletionRevoked(UUID completionId, UUID lessonId, UUID studentId, Instant occurredAt) {
}
