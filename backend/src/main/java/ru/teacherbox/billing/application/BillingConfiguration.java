package ru.teacherbox.billing.application;

import javax.sql.DataSource;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(BillingProperties.class)
class BillingConfiguration {

    @Bean
    FlywayMigrationInitializer billingMigrations(DataSource dataSource) {
        return ModuleMigrations.initializer(dataSource, "billing");
    }

    @Bean
    BillingCurrency billingCurrency(BillingProperties properties) {
        return new BillingCurrency(properties.currency());
    }
}
