package ru.teacherbox.identity.api;

import java.util.List;
import java.util.UUID;

/**
 * Public view of a group of students for other modules.
 *
 * @param memberIds students of the group in the order the teacher chose
 * @param archived  the group is no longer offered for new lessons
 */
public record GroupSummary(UUID id, String name, List<UUID> memberIds, boolean archived) {

    public GroupSummary {
        memberIds = List.copyOf(memberIds);
    }
}
