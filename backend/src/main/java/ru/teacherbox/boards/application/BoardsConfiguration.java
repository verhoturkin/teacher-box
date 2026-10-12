package ru.teacherbox.boards.application;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(BoardsProperties.class)
class BoardsConfiguration {

    @Bean
    FlywayMigrationInitializer boardsMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "boards");
    }
}
