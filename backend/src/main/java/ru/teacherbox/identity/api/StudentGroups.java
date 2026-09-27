package ru.teacherbox.identity.api;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read-only access to groups of students for other modules (ADR-0011). */
public interface StudentGroups {

    Optional<GroupSummary> findGroup(UUID groupId);

    /** Summaries of the given groups, archived included; unknown ids are skipped. */
    List<GroupSummary> findGroups(Collection<UUID> groupIds);

    /** Current (not archived) groups the student is a member of. */
    List<GroupSummary> groupsOf(UUID studentId);
}
