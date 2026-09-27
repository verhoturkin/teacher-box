package ru.teacherbox.identity.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The name or the members of a group changed (also when a deactivated student left the group).
 *
 * @param memberIds students of the group after the change
 * @param addedIds  students who joined the group
 * @param removedIds students who left the group
 */
public record GroupChanged(UUID groupId, String name, List<UUID> memberIds, List<UUID> addedIds,
        List<UUID> removedIds, Instant occurredAt) {

    public GroupChanged {
        memberIds = List.copyOf(memberIds);
        addedIds = List.copyOf(addedIds);
        removedIds = List.copyOf(removedIds);
    }
}
