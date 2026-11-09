package ru.teacherbox.platform.portal;

import java.time.Clock;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.storage.PlatformStorageAutoConfiguration;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;
import ru.teacherbox.shared.time.InstanceTimeZone;

/**
 * The portal's name, address, color and logo ({@code shared.portal.Portal}) and the teacher's time zone
 * ({@code shared.time.InstanceTimeZone}) in the schema {@code platform}.
 */
@AutoConfiguration(after = {PlatformCoreAutoConfiguration.class, PlatformStorageAutoConfiguration.class},
        afterName = "org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration")
@EnableConfigurationProperties(PortalProperties.class)
public class PlatformPortalAutoConfiguration {

    @Bean
    FlywayMigrationInitializer platformMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "platform");
    }

    @Bean
    PortalDataReset portalDataReset(JdbcClient jdbc) {
        return new PortalDataReset(jdbc);
    }

    @Bean
    PortalSettingsImport portalSettingsImport(JdbcClient jdbc, Clock clock) {
        return new PortalSettingsImport(jdbc, clock);
    }

    @Bean
    PortalTimeZone portalTimeZone(JdbcClient jdbc, ApplicationEventPublisher events, Clock clock) {
        return new PortalTimeZone(jdbc, events, clock);
    }

    /** The teacher's time zone for every module, read from the database on every call (ADR-0056). */
    @Bean
    InstanceTimeZone instanceTimeZone(PortalTimeZone timeZone) {
        return new InstanceTimeZone(timeZone::current);
    }

    @Bean
    PortalService portalService(JdbcClient jdbc, PortalProperties properties, FileStorage files, Clock clock) {
        return new PortalService(new PortalSettingsRepository(jdbc), properties, files, clock);
    }
}
