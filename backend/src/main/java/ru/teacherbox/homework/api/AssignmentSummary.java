package ru.teacherbox.homework.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An assignment as other modules see it (roadmap 11).
 *
 * @param dueAt      {@code null} — no deadline
 * @param courseId   the course of the assignment; {@code null} — none
 * @param bank       a bank item: an original kept for reuse, never given out and never on a lesson
 * @param studentIds the students it was given to
 */
public record AssignmentSummary(UUID id, String title, @Nullable Instant dueAt, @Nullable UUID courseId, boolean bank,
        List<UUID> studentIds) {
}
