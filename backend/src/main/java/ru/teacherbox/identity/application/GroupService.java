package ru.teacherbox.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.teacherbox.identity.api.GroupArchived;
import ru.teacherbox.identity.api.GroupChanged;
import ru.teacherbox.identity.api.GroupCreated;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.StudentGroup;
import ru.teacherbox.identity.domain.StudentGroup.MembersChange;
import ru.teacherbox.identity.domain.User;
import ru.teacherbox.identity.persistence.GroupRepository;
import ru.teacherbox.identity.persistence.UserRepository;
import ru.teacherbox.shared.Ids;
import ru.teacherbox.shared.error.BusinessRuleException;
import ru.teacherbox.shared.error.NotFoundException;

/** Groups of students managed by the teacher (ADR-0011). */
@Service
public class GroupService {

    private final GroupRepository groups;
    private final UserRepository users;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public GroupService(GroupRepository groups, UserRepository users, ApplicationEventPublisher events, Clock clock) {
        this.groups = groups;
        this.users = users;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public GroupView create(String name, List<UUID> memberIds) {
        requireCurrentStudents(memberIds);
        Instant now = clock.instant();
        StudentGroup group = StudentGroup.create(Ids.newId(), name, memberIds, now);
        groups.insert(group);
        events.publishEvent(new GroupCreated(group.id(), group.name(), group.memberIds(), now));
        return view(group);
    }

    @Transactional(readOnly = true)
    public List<GroupView> list() {
        List<StudentGroup> all = groups.findAll();
        Map<UUID, User> students = students(all.stream().flatMap(group -> group.memberIds().stream()).toList());
        return all.stream().map(group -> GroupView.of(group, students)).toList();
    }

    @Transactional(readOnly = true)
    public GroupView get(UUID groupId) {
        return view(load(groupId));
    }

    /**
     * Renames the group and replaces its members; new members must be current students.
     *
     * @throws OptimisticLockingFailureException if the group was changed after {@code expectedVersion}
     */
    @Transactional
    public GroupView update(UUID groupId, String name, List<UUID> memberIds, long expectedVersion) {
        StudentGroup group = load(groupId);
        if (group.version() != expectedVersion) {
            throw new OptimisticLockingFailureException("Group " + groupId + " was modified");
        }
        Set<UUID> newcomers = new HashSet<>(memberIds);
        newcomers.removeAll(group.memberIds());
        requireCurrentStudents(newcomers);
        Instant now = clock.instant();
        List<UUID> before = group.memberIds();
        boolean renamed = group.rename(name, now);
        MembersChange change = group.changeMembers(memberIds, now);
        if (renamed || !group.memberIds().equals(before)) {
            groups.update(group);
        }
        if (renamed || !change.isEmpty()) {
            events.publishEvent(new GroupChanged(group.id(), group.name(), group.memberIds(), change.added(),
                    change.removed(), now));
        }
        return view(group);
    }

    @Transactional
    public GroupView archive(UUID groupId) {
        StudentGroup group = load(groupId);
        Instant now = clock.instant();
        group.archive(now);
        groups.update(group);
        events.publishEvent(new GroupArchived(group.id(), now));
        return view(group);
    }

    @Transactional
    public GroupView unarchive(UUID groupId) {
        StudentGroup group = load(groupId);
        group.unarchive(clock.instant());
        groups.update(group);
        return view(group);
    }

    /** A deactivated student leaves all current groups. */
    @Transactional
    public void removeStudent(UUID studentId) {
        Instant now = clock.instant();
        for (StudentGroup group : groups.findCurrentByMember(studentId)) {
            group.removeMember(studentId, now);
            groups.update(group);
            events.publishEvent(new GroupChanged(group.id(), group.name(), group.memberIds(), List.of(),
                    List.of(studentId), now));
        }
    }

    private void requireCurrentStudents(Collection<UUID> studentIds) {
        Set<UUID> unique = Set.copyOf(studentIds);
        long current = users.findStudentsByIds(unique).stream()
                .filter(student -> student.status() != AccountStatus.DEACTIVATED)
                .count();
        if (current != unique.size()) {
            throw new BusinessRuleException("group.member-invalid",
                    "Members must be students who have not been deactivated");
        }
    }

    private StudentGroup load(UUID groupId) {
        return groups.findById(groupId).orElseThrow(() -> new NotFoundException("group.not-found", "Group not found"));
    }

    private GroupView view(StudentGroup group) {
        return GroupView.of(group, students(group.memberIds()));
    }

    private Map<UUID, User> students(Collection<UUID> ids) {
        return users.findStudentsByIds(Set.copyOf(ids)).stream()
                .collect(Collectors.toMap(User::id, Function.identity()));
    }
}
