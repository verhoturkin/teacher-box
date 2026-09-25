package ru.teacherbox.platform.backup;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Backups in {@code <data-dir>/backups} on a schedule and on demand. */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class,
        afterName = "org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration")
@EnableConfigurationProperties(BackupProperties.class)
public class PlatformBackupAutoConfiguration {

    @Bean
    BackupService backupService(JdbcClient jdbc, PlatformProperties platform, BackupProperties properties,
            InstanceTimeZone timeZone, Clock clock) {
        return new BackupService(jdbc, platform.dataDir(), properties, timeZone, clock);
    }

    @Bean
    ScheduledBackup scheduledBackup(BackupService backups) {
        return new ScheduledBackup(backups);
    }

    /** Runs only when scheduling is enabled ({@code teacherbox.scheduling.enabled}). */
    static class ScheduledBackup {

        private static final Logger log = LoggerFactory.getLogger(ScheduledBackup.class);

        private final BackupService backups;

        ScheduledBackup(BackupService backups) {
            this.backups = backups;
        }

        @Scheduled(cron = "${teacherbox.backup.cron:0 30 3 * * *}", zone = "${teacherbox.timezone:Europe/Moscow}")
        void run() {
            try {
                backups.create();
            } catch (RuntimeException e) {
                log.error("Scheduled backup failed", e);
            }
        }
    }
}
