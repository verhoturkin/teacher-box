package ru.teacherbox.shared.security;

/**
 * System roles. There is always exactly one {@link #TEACHER} per instance; the optional {@link #ADMIN}
 * is a technical account without access to students' data (ADR-0010); a {@link #GUARDIAN} (UI «Родитель»)
 * reads the data of their children only (ADR-0069).
 */
public enum Role {
    TEACHER,
    STUDENT,
    ADMIN,
    GUARDIAN
}
