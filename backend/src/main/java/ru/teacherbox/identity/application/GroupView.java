package ru.teacherbox.identity.application;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import ru.teacherbox.identity.domain.AccountStatus;
import ru.teacherbox.identity.domain.StudentGroup;
import ru.teacherbox.identity.domain.User;

/** A group as the teacher sees it: members with their names. */
public record GroupView(
        UUID id,
        String name,
        List<Member> members,
        @Nullable Instant archivedAt,
        Instant createdAt,
        long version) {

    public record Member(UUID id, String displayName, AccountStatus status) {
    }

    static GroupView of(StudentGroup group, Map<UUID, User> students) {
        List<Member> members = group.memberIds().stream()
                .map(students::get)
                .filter(Objects::nonNull)
                .map(student -> new Member(student.id(), student.profile().displayName(), student.status()))
                .toList();
        return new GroupView(group.id(), group.name(), members, group.archivedAt(), group.createdAt(),
                group.version());
    }
}
