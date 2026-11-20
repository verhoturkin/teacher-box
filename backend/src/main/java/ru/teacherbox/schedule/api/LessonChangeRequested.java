package ru.teacherbox.schedule.api;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A student asks to move or cancel a lesson; in a group lesson a cancellation means that the student
 * will not come.
 *
 * @param groupId          the group of a group lesson, {@code null} for a lesson with one student
 * @param proposedStartsAt new time for {@link ChangeKind#RESCHEDULE}
 * @param late             the request comes later than the cancellation policy allows
 * @param accepted         accepted at once: a timely notice that the student will not come to a
 *                         group lesson (no answer of the teacher is needed)
 * @param guardianId       the guardian who asked on the child's behalf (ADR-0069); {@code null}: the student
 */
public record LessonChangeRequested(
        UUID requestId,
        UUID lessonId,
        UUID studentId,
        @Nullable UUID groupId,
        ChangeKind kind,
        Instant startsAt,
        @Nullable Instant proposedStartsAt,
        @Nullable String comment,
        boolean late,
        boolean accepted,
        Instant occurredAt,
        @Nullable UUID guardianId) {

    /** A request the student sent themselves. */
    public LessonChangeRequested(UUID requestId, UUID lessonId, UUID studentId, @Nullable UUID groupId,
            ChangeKind kind, Instant startsAt, @Nullable Instant proposedStartsAt, @Nullable String comment,
            boolean late, boolean accepted, Instant occurredAt) {
        this(requestId, lessonId, studentId, groupId, kind, startsAt, proposedStartsAt, comment, late, accepted,
                occurredAt, null);
    }

    /** The subject of the teacher's notification, for the buttons of the bot (ADR-0013). */
    public static final String CHAT_SUBJECT = "change-request";
}
