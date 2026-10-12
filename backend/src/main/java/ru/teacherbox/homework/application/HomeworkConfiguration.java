package ru.teacherbox.homework.application;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(HomeworkProperties.class)
class HomeworkConfiguration {

    @Bean
    FlywayMigrationInitializer homeworkMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "homework");
    }
}
