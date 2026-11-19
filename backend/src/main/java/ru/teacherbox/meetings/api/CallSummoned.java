package ru.teacherbox.meetings.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * «Позвать»: the teacher called the students who are not in the built-in call of a running lesson.
 *
 * @param groupId    the group of a group room, {@code null} for a student's room
 * @param studentIds who is called: those not in the call and not called a few minutes ago
 * @param joinUrl    the absolute address of the call, {@code null} while the portal address is unknown
 */
public record CallSummoned(UUID ownerId, @Nullable UUID groupId, List<UUID> studentIds, @Nullable String joinUrl,
        Instant occurredAt) {

    public CallSummoned {
        studentIds = List.copyOf(studentIds);
    }
}
