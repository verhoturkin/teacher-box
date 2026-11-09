package ru.teacherbox.billing.application;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.teacherbox.billing.domain.BillingCurrency;
import ru.teacherbox.shared.persistence.MigrationConnection;
import ru.teacherbox.shared.persistence.ModuleMigrations;

@Configuration(proxyBeanMethods = false)
class BillingConfiguration {

    @Bean
    FlywayMigrationInitializer billingMigrations(MigrationConnection connection) {
        return ModuleMigrations.initializer(connection, "billing");
    }

    @Bean
    BillingCurrency billingCurrency(BillingCurrencySetting setting) {
        return new BillingCurrency(setting::current);
    }
}
