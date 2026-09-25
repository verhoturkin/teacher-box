package ru.teacherbox.identity.api;

/** Lifecycle of a student account. */
public enum StudentStatus {
    /** Created by the teacher, invitation not accepted yet. */
    INVITED,
    /** Has credentials and may sign in. */
    ACTIVE,
    /** Access revoked by the teacher; the history is kept. */
    DEACTIVATED
}
