package ru.teacherbox.platform.backup;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Backups of the database and files ({@code TEACHERBOX_BACKUP_*}).
 *
 * @param cron schedule in the instance time zone; {@code -} disables automatic backups
 * @param keep how many backups to keep (older ones are deleted after a new backup)
 */
@ConfigurationProperties("teacherbox.backup")
public record BackupProperties(
        @DefaultValue("0 30 3 * * *") String cron,
        @DefaultValue("7") int keep) {

    public BackupProperties {
        if (keep < 1) {
            throw new IllegalArgumentException("teacherbox.backup.keep must be at least 1");
        }
    }
}
