package ru.teacherbox.shared.chat;

import java.util.Objects;
import java.util.UUID;
import ru.teacherbox.shared.i18n.Language;
import ru.teacherbox.shared.security.Role;

/**
 * Who talks to the bot: the teacher or a current student whose messenger account is connected to
 * the portal.
 *
 * @param language the language the user chose in the interface: the bot answers in it (ADR-0036)
 */
public record ChatUser(UUID id, Role role, Language language) {

    public ChatUser {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(language, "language");
    }

    /** A user who reads Russian, the source language. */
    public ChatUser(UUID id, Role role) {
        this(id, role, Language.RU);
    }

    public boolean isTeacher() {
        return role == Role.TEACHER;
    }

    public boolean isStudent() {
        return role == Role.STUDENT;
    }
}
