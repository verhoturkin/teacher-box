package ru.teacherbox.meetings.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The teacher sent the link of a room to the students.
 *
 * @param groupId    the group of a group room, {@code null} for a student's room
 * @param studentIds who gets the link: the student or the current members of the group
 */
public record MeetingLinkShared(UUID ownerId, @Nullable UUID groupId, List<UUID> studentIds, String joinUrl,
        Instant occurredAt) {

    public MeetingLinkShared {
        studentIds = List.copyOf(studentIds);
    }
}
