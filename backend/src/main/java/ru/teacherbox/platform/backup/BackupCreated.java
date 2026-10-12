package ru.teacherbox.platform.backup;

import ru.teacherbox.platform.backup.BackupService.BackupInfo;

/** A new backup is in {@code <data-dir>/backups}; published synchronously, listeners must return quickly. */
public record BackupCreated(BackupInfo backup, BackupKind kind) {
}
