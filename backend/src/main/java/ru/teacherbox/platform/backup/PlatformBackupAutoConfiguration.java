package ru.teacherbox.platform.backup;

import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.shared.reset.DataReset;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Backups in {@code <data-dir>/backups} on a schedule and on demand. */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class,
        afterName = "org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration")
@EnableConfigurationProperties(BackupProperties.class)
public class PlatformBackupAutoConfiguration {

    @Bean
    BackupService backupService(JdbcClient jdbc, PlatformProperties platform, BackupProperties properties,
            InstanceTimeZone timeZone, ObjectProvider<BuildProperties> build, Clock clock) {
        BuildProperties info = build.getIfAvailable();
        return new BackupService(jdbc, platform.dataDir(), properties, timeZone,
                info == null ? null : info.getVersion(), clock);
    }

    @Bean
    @ConditionalOnMissingBean
    Restarter restarter(ConfigurableApplicationContext context) {
        return new Restarter(() -> SpringApplication.exit(context, () -> Restarter.EXIT_CODE), System::exit,
                Duration.ofSeconds(1));
    }

    @Bean
    RestoreService restoreService(BackupService backups, PlatformProperties platform,
            ObjectProvider<PasswordConfirmation> passwords, Restarter restarter, BackupProperties properties,
            Clock clock) {
        return new RestoreService(backups, platform.dataDir(), passwords, restarter, properties.restart(),
                clock.instant());
    }

    @Bean
    ResetService resetService(BackupService backups, RestoreService restores, ObjectProvider<DataReset> resets,
            ObjectProvider<PlatformTransactionManager> transactions, JdbcClient jdbc, PlatformProperties platform) {
        return new ResetService(backups, restores, resets, transactions, jdbc, platform.dataDir());
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
                backups.create(BackupKind.SCHEDULED);
            } catch (RuntimeException e) {
                log.error("Scheduled backup failed", e);
            }
        }
    }
}
