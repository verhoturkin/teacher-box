package ru.teacherbox.shared.security;

import java.util.Objects;
import java.util.UUID;
import ru.teacherbox.shared.error.ForbiddenException;

/**
 * Authenticated user of the current request. Controllers receive it as a method parameter.
 */
public record CurrentUser(UUID id, Role role, String displayName) {

    public CurrentUser {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(displayName, "displayName");
    }

    public boolean isTeacher() {
        return role == Role.TEACHER;
    }

    /**
     * Ensures that the user may access data of the given student: either the teacher or the student themself.
     */
    public void requireSelfOrTeacher(UUID studentId) {
        if (!isTeacher() && !id.equals(studentId)) {
            throw new ForbiddenException("access.denied", "Access to another student's data is denied");
        }
    }
}
