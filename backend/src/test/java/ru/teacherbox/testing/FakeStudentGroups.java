package ru.teacherbox.testing;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.shared.Ids;

/** In-memory {@link StudentGroups} for module tests that do not bootstrap the identity module. */
public final class FakeStudentGroups implements StudentGroups {

    private final Map<UUID, GroupSummary> groups = new ConcurrentHashMap<>();

    /** Registers a current group and returns its id. */
    public UUID addGroup(String name, UUID... memberIds) {
        UUID id = Ids.newId();
        groups.put(id, new GroupSummary(id, name, List.of(memberIds), false));
        return id;
    }

    public void setMembers(UUID groupId, List<UUID> memberIds) {
        groups.computeIfPresent(groupId, (id, g) -> new GroupSummary(id, g.name(), memberIds, g.archived()));
    }

    public void archive(UUID groupId) {
        groups.computeIfPresent(groupId, (id, g) -> new GroupSummary(id, g.name(), g.memberIds(), true));
    }

    @Override
    public Optional<GroupSummary> findGroup(UUID groupId) {
        return Optional.ofNullable(groups.get(groupId));
    }

    @Override
    public List<GroupSummary> findGroups(Collection<UUID> groupIds) {
        return groupIds.stream().map(groups::get).filter(Objects::nonNull).toList();
    }

    @Override
    public List<GroupSummary> groupsOf(UUID studentId) {
        return groups.values().stream()
                .filter(group -> !group.archived() && group.memberIds().contains(studentId))
                .toList();
    }
}
