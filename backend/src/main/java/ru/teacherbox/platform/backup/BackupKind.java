package ru.teacherbox.platform.backup;

/** Why a backup was made (ADR-0014). */
public enum BackupKind {
    /** By the schedule ({@code TEACHERBOX_BACKUP_CRON}). */
    SCHEDULED,
    /** By the teacher or the administrator. */
    MANUAL,
    /** The state before another backup was restored; not deleted by the rotation. */
    BEFORE_RESTORE,
    /** The state before a full reset; not deleted by the rotation. */
    BEFORE_RESET;

    /** Kept until someone deletes it. */
    boolean isRotated() {
        return this == SCHEDULED || this == MANUAL;
    }
}
