package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A lesson of one student in a period (ADR-0072).
 *
 * @param groupId       the group of a group lesson; {@code null} — a lesson with the student alone
 * @param outcome       what the lesson was for this student
 * @param cancelledBy   who cancelled a {@link LessonOutcome#CANCELLED} or {@link LessonOutcome#LATE_CANCELLED}
 *                      lesson; {@code null} otherwise
 * @param summary       «Что прошли», shared by the whole lesson; with a {@code planId} only the deviations from
 *                      the plan, {@code null} — all by the plan (466.3)
 * @param planId        the lesson plan of the lesson ({@code textbooks}); {@code null} — none
 * @param assignmentIds the homework of the lesson ({@code homework})
 */
public record JournalLesson(UUID lessonId, Instant startsAt, int durationMinutes, @Nullable String title,
        @Nullable String topic, @Nullable UUID groupId, LessonOutcome outcome, @Nullable CancelledBy cancelledBy,
        @Nullable String summary, @Nullable UUID planId, List<UUID> assignmentIds) {

    public JournalLesson {
        assignmentIds = List.copyOf(assignmentIds);
    }
}
