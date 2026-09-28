package ru.teacherbox.platform.portal;

import java.time.Clock;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import ru.teacherbox.platform.core.PlatformCoreAutoConfiguration;
import ru.teacherbox.platform.storage.PlatformStorageAutoConfiguration;
import ru.teacherbox.shared.files.FileStorage;
import ru.teacherbox.shared.persistence.ModuleMigrations;

/** The portal's name, address, color and logo ({@code shared.portal.Portal}) in the schema {@code platform}. */
@AutoConfiguration(after = {PlatformCoreAutoConfiguration.class, PlatformStorageAutoConfiguration.class},
        afterName = "org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration")
@EnableConfigurationProperties(PortalProperties.class)
public class PlatformPortalAutoConfiguration {

    @Bean
    FlywayMigrationInitializer platformMigrations(DataSource dataSource) {
        return ModuleMigrations.initializer(dataSource, "platform");
    }

    @Bean
    PortalDataReset portalDataReset(JdbcClient jdbc) {
        return new PortalDataReset(jdbc);
    }

    @Bean
    PortalService portalService(JdbcClient jdbc, PortalProperties properties, FileStorage files, Clock clock) {
        return new PortalService(new PortalSettingsRepository(jdbc), properties, files, clock);
    }
}
