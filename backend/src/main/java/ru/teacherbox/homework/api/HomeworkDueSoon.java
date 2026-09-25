package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.UUID;

/** An unfinished task is due soon (sent once per task). */
public record HomeworkDueSoon(
        UUID taskId,
        UUID assignmentId,
        UUID studentId,
        String title,
        Instant dueAt,
        Instant occurredAt) {
}
