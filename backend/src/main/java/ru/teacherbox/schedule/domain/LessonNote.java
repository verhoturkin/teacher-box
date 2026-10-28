package ru.teacherbox.schedule.domain;

import java.time.Instant;
import java.util.UUID;

/** The teacher's private note about one student's part in a lesson; the student never sees it. */
public record LessonNote(UUID lessonId, UUID studentId, String note, Instant updatedAt) {
}
