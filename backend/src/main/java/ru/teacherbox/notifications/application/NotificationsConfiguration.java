package ru.teacherbox.notifications.application;

import javax.sql.DataSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(NotificationsProperties.class)
class NotificationsConfiguration {

    @Bean
    FlywayMigrationInitializer notificationsMigrations(DataSource dataSource) {
        return ModuleMigrations.initializer(dataSource, "notifications");
    }
}
