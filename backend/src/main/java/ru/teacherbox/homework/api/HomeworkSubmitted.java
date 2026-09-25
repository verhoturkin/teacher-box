package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;

/** A student handed in (or re-submitted) a task; the teacher should review it. */
public record HomeworkSubmitted(
        UUID taskId,
        UUID assignmentId,
        UUID studentId,
        String title,
        Instant occurredAt) {
}
