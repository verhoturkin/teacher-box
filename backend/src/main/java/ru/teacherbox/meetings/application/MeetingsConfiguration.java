package ru.teacherbox.meetings.application;

import javax.sql.DataSource;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
class MeetingsConfiguration {

    @Bean
    FlywayMigrationInitializer meetingsMigrations(DataSource dataSource) {
        return ModuleMigrations.initializer(dataSource, "meetings");
    }
}
