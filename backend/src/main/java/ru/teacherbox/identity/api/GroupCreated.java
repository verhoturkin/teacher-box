package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The teacher created a group of students. */
public record GroupCreated(UUID groupId, String name, List<UUID> memberIds, Instant occurredAt) {

    public GroupCreated {
        memberIds = List.copyOf(memberIds);
    }
}
