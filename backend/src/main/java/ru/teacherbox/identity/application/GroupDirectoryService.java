package ru.teacherbox.identity.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GroupSummary;
import ru.teacherbox.identity.api.StudentGroups;
import ru.teacherbox.identity.domain.StudentGroup;
import ru.teacherbox.identity.persistence.GroupRepository;

@Service
@Transactional(readOnly = true)
class GroupDirectoryService implements StudentGroups {

    private final GroupRepository groups;

    GroupDirectoryService(GroupRepository groups) {
        this.groups = groups;
    }

    @Override
    public Optional<GroupSummary> findGroup(UUID groupId) {
        return groups.findById(groupId).map(GroupDirectoryService::summary);
    }

    @Override
    public List<GroupSummary> findGroups(Collection<UUID> groupIds) {
        return groups.findByIds(groupIds).stream().map(GroupDirectoryService::summary).toList();
    }

    @Override
    public List<GroupSummary> groupsOf(UUID studentId) {
        return groups.findCurrentByMember(studentId).stream().map(GroupDirectoryService::summary).toList();
    }

    private static GroupSummary summary(StudentGroup group) {
        return new GroupSummary(group.id(), group.name(), group.memberIds(), group.isArchived());
    }
}
