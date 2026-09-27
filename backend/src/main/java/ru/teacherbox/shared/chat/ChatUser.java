package ru.teacherbox.shared.chat;

import java.util.Objects;
import java.util.UUID;
import ru.teacherbox.shared.security.Role;

/**
 * Who talks to the bot: the teacher or a current student whose messenger account is connected to
 * the portal.
 */
public record ChatUser(UUID id, Role role) {

    public ChatUser {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(role, "role");
    }

    public boolean isTeacher() {
        return role == Role.TEACHER;
    }

    public boolean isStudent() {
        return role == Role.STUDENT;
    }
}
