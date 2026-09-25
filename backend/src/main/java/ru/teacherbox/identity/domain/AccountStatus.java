package ru.teacherbox.identity.domain;

/** Lifecycle of an account. The teacher account is always {@link #ACTIVE}. */
public enum AccountStatus {
    INVITED,
    ACTIVE,
    DEACTIVATED
}
