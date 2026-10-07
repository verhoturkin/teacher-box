package ru.teacherbox.textbooks.domain;

import java.util.Objects;
import java.util.UUID;

/** A student or a group a textbook is shared with; a textbook has any number of them. */
public record TextbookMember(MemberType type, UUID id) {

    public TextbookMember {
        Objects.requireNonNull(type);
        Objects.requireNonNull(id);
    }

    public static TextbookMember student(UUID studentId) {
        return new TextbookMember(MemberType.STUDENT, studentId);
    }

    public static TextbookMember group(UUID groupId) {
        return new TextbookMember(MemberType.GROUP, groupId);
    }
}
