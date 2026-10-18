package ru.teacherbox.platform.backup;

/** Why a backup was made (ADR-0014). */
public enum BackupKind {
    /** By the schedule ({@code TEACHERBOX_BACKUP_CRON}). */
    SCHEDULED,
    /** By the teacher or the administrator. */
    MANUAL,
    /** The state before another backup was restored; stays on the server only. */
    BEFORE_RESTORE,
    /** The state before a full reset; stays on the server only. */
    BEFORE_RESET;

    /** Copied to Google Drive (ADR-0037). */
    public boolean isCopiedToDrive() {
        return this == SCHEDULED || this == MANUAL;
    }
}
