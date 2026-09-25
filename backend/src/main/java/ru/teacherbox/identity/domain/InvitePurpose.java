package ru.teacherbox.identity.domain;

/** What accepting an invitation does. */
public enum InvitePurpose {
    /** First sign-up: the student chooses login and password. */
    ACTIVATION,
    /** Forgotten password: the student sets a new password, the login stays. */
    PASSWORD_RESET
}
