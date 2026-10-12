package ru.teacherbox.schedule.application;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ScheduleProperties.class)
class ScheduleConfiguration {

    @Bean
    FlywayMigrationInitializer scheduleMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "schedule");
    }
}
