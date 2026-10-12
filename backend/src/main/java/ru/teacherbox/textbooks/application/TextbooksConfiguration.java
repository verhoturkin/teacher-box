package ru.teacherbox.textbooks.application;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
class TextbooksConfiguration {

    @Bean
    FlywayMigrationInitializer textbooksMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "textbooks");
    }
}
