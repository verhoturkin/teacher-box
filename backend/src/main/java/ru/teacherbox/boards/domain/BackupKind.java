package ru.teacherbox.boards.domain;

/** How a copy of a board was made. */
public enum BackupKind {
    /** By the daily job, for a board changed since its last daily copy. */
    DAILY,
    /** By the teacher, or before a restore. */
    MANUAL
}
