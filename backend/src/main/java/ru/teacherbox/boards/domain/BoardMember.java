package ru.teacherbox.boards.domain;

import java.util.Objects;
import java.util.UUID;

/** A student or a group a board is bound to; a board has any number of them. */
public record BoardMember(MemberType type, UUID id) {

    public BoardMember {
        Objects.requireNonNull(type);
        Objects.requireNonNull(id);
    }

    public static BoardMember student(UUID studentId) {
        return new BoardMember(MemberType.STUDENT, studentId);
    }

    public static BoardMember group(UUID groupId) {
        return new BoardMember(MemberType.GROUP, groupId);
    }
}
