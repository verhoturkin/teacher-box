package ru.teacherbox.platform.backup;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.info.BuildProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.core.PlatformProperties;
import ru.teacherbox.platform.backup.drive.CloudBackupService;
import ru.teacherbox.platform.backup.drive.DriveApi;
import ru.teacherbox.platform.backup.drive.DriveConnectionStore;
import ru.teacherbox.platform.backup.drive.DriveIntegrationCheck;
import ru.teacherbox.shared.backup.BackupExclusions;
import ru.teacherbox.shared.http.OutboundHttp;
import ru.teacherbox.shared.http.OutboundProxy;
import ru.teacherbox.shared.portal.Portal;
import ru.teacherbox.shared.reset.DataReset;
import ru.teacherbox.shared.security.PasswordConfirmation;
import ru.teacherbox.shared.time.InstanceTimeZone;

/** Backups in {@code <data-dir>/backups} on a schedule and on demand, their copies in Google Drive. */
@AutoConfiguration(after = PlatformCoreAutoConfiguration.class,
        afterName = "org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration")
@EnableConfigurationProperties(BackupProperties.class)
public class PlatformBackupAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(PlatformBackupAutoConfiguration.class);
    private static final Duration DRIVE_CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration DRIVE_READ_TIMEOUT = Duration.ofSeconds(30);
    /** Until Google answers an upload or starts a download: the whole file goes first. */
    private static final Duration DRIVE_TRANSFER_TIMEOUT = Duration.ofHours(2);

    @Bean
    BackupService backupService(JdbcClient jdbc, PlatformProperties platform, BackupProperties properties,
            InstanceTimeZone timeZone, ObjectProvider<BuildProperties> build, Clock clock,
            ObjectProvider<BackupExclusions> exclusions, ApplicationEventPublisher events) {
        BuildProperties info = build.getIfAvailable();
        return new BackupService(jdbc, platform.dataDir(), properties, timeZone,
                info == null ? null : info.getVersion(), clock, () -> exclusions.orderedStream().toList(), events);
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
    DriveApi driveApi(RestClient.Builder builder, BackupProperties properties) {
        BackupProperties.Google google = properties.google();
        OutboundProxy proxy = OutboundProxy.setting("TEACHERBOX_BACKUP_GOOGLE_PROXY", google.proxy());
        if (proxy != null) {
            log.info("Google Drive is reached through the proxy {}", proxy);
        }
        RestClient.Builder http = builder.clone()
                .requestFactory(OutboundHttp.requestFactory(DRIVE_CONNECT_TIMEOUT, DRIVE_READ_TIMEOUT, proxy));
        RestClient files = builder.clone()
                .requestFactory(OutboundHttp.streamingRequestFactory(DRIVE_CONNECT_TIMEOUT, DRIVE_TRANSFER_TIMEOUT,
                        proxy))
                .build();
        return new DriveApi(http.clone().baseUrl(google.oauthUrl()).build(), http.clone().baseUrl(google.apiUrl()).build(),
                files, google.authorizationUrl(), google.apiUrl(), google.uploadUrl());
    }

    @Bean
    CloudBackupService cloudBackupService(DriveApi api, PlatformProperties platform, JsonMapper json,
            BackupService backups, BackupProperties properties, Portal portal, Clock clock) {
        return new CloudBackupService(api,
                new DriveConnectionStore(platform.dataDir().resolve("google-drive.json"), json), backups, properties,
                portal, clock, Executors.newSingleThreadExecutor(Thread.ofVirtual().name("google-drive").factory()));
    }

    @Bean
    DriveIntegrationCheck driveIntegrationCheck(CloudBackupService drive) {
        return new DriveIntegrationCheck(drive);
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
